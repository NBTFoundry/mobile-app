// SPDX-License-Identifier: MPL-2.0
import { randomBytes } from 'node:crypto';
import { changeSetting, installPackage, listApps, pairPhone, removeApp, StoppedFollowing,
  type Follow } from '../src/protocol/actions';
import { atCarIp, pairHosts, reachManager, listenerHosts, type OpeningEvent } from '../src/protocol/opening';
import { CarError, CarSession, LinkError, type Link, type LinkRequest, type LinkResponse } from '../src/protocol/session';
import { bodyDigest, canonicalText, pairingCode } from '../src/protocol/signing';
import { SoftwareKey, verifyWith } from './support/softwareKey';

/** A fake listener that checks nonces and signatures as the car does. */
class FakeCar implements Link {
  nonces = new Set<string>();
  seen: LinkRequest[] = [];
  statuses: string[] = [];
  down = new Set<string>();
  constructor(readonly key: SoftwareKey, public handler: (r: LinkRequest) => [number, string]) {}

  private nonce() {
    const n = randomBytes(32).toString('hex');
    this.nonces.add(n);
    return n;
  }

  async request(r: LinkRequest): Promise<LinkResponse> {
    if (this.down.has(r.host)) throw new LinkError('refused');
    this.seen.push(r);
    if (r.route === '/v1/nonce') return { status: 200, nonce: this.nonce(), body: 'NBT-REQ-1\n' };
    const nonce = r.headers['X-NBT-Nonce']!;
    if (!this.nonces.delete(nonce)) return { status: 403, nonce: this.nonce(), body: 'ERR auth\n' };
    const body = r.body?.kind === 'text' ? Buffer.from(r.body.text, 'ascii') : Buffer.alloc(0);
    const size = r.body?.kind === 'file' ? r.body.size : body.length;
    const digest = r.body?.kind === 'file' ? 'ab'.repeat(32) : bodyDigest(body);
    const text = canonicalText(r.method, r.route, r.host, nonce, size, digest);
    if (!verifyWith(this.key.publicKey, text, r.headers['X-NBT-Signature']!)) {
      return { status: 403, nonce: this.nonce(), body: 'ERR auth\n' };
    }
    const [status, reply] = r.route === '/v1/status' ? [200, this.statuses.shift() ?? 'STATUS\twaiting\tWaiting\n']
      : this.handler(r);
    return { status, nonce: this.nonce(), body: reply };
  }
}

const HOST = '172.16.222.1:8080';
const follow = (states: string[] = []): Follow & { states: string[] } => ({
  states, cancel: { cancelled: false }, wait: async () => undefined,
  onStatus: s => states.push(s.state),
});

describe('signed session', () => {
  const key = new SoftwareKey();

  it('fetches one nonce, then reuses the nonce each reply supplies', async () => {
    const car = new FakeCar(key, () => [200, 'APPS\t1\ntest\tv1\t1\t0\n']);
    const session = new CarSession(car, key, HOST);
    await listApps(session);
    await listApps(session);
    expect(car.seen.map(r => r.route)).toEqual(['/v1/nonce', '/v1/apps', '/v1/apps']);
  });

  it('serializes concurrent requests so no nonce is used twice', async () => {
    const car = new FakeCar(key, () => [200, 'OK\n']);
    const session = new CarSession(car, key, HOST);
    await Promise.all([1, 2, 3].map(() => changeSetting(session, 'test', 'bg', 'red')));
    expect(car.seen.filter(r => r.route === '/v1/nonce')).toHaveLength(1);
    expect(car.seen[1]!.body).toEqual({ kind: 'text', text: 'test\tbg\tred\n' });
  });

  it('turns refusals into fixed codes and recovers a nonce after a link error', async () => {
    let fail = true;
    const car = new FakeCar(key, () => [409, 'ERR busy\n']);
    const link: Link = { request: r => {
      if (r.route === '/v1/apps' && fail) {
        fail = false;
        return Promise.reject(new LinkError('io'));
      }
      return car.request(r);
    } };
    const session = new CarSession(link, key, HOST);
    await expect(listApps(session)).rejects.toBeInstanceOf(LinkError);
    await expect(changeSetting(session, 'test', 'bg', 'red')).rejects.toEqual(new CarError(409, 'busy'));
  });

  it('pairs only when the digits match the nonce and key', async () => {
    const car = new FakeCar(key, r => [202, `PAIR\tpending\t${pairingCode(r.headers['X-NBT-Nonce']!, key.publicKey)}\n`]);
    car.statuses = ['STATUS\twaiting\tWaiting\n', 'STATUS\tpaired\tPhone paired\nCAR\t02:11:22:33:44:55\t172.16.222.1:8080\n'];
    const codes: string[] = [];
    const result = await pairPhone(new CarSession(car, key, HOST), 'Pixel', key.publicKey, c => codes.push(c), follow());
    expect(result).toEqual({ bssid: '02:11:22:33:44:55', address: '172.16.222.1:8080' });
    expect(codes).toHaveLength(1);
    const liar = new FakeCar(key, () => [202, 'PAIR\tpending\t000000\n']);
    await expect(pairPhone(new CarSession(liar, key, HOST), 'Pixel', key.publicKey, () => undefined, follow()))
      .rejects.toThrow('code-mismatch');
  });

  it('follows an install to the car decision', async () => {
    const car = new FakeCar(key, () => [202, 'STATUS\tverified\tReview and confirm on the car\n']);
    car.statuses = ['STATUS\tverified\tReview\n', 'STATUS\tinstalling\tInstalling\n', 'STATUS\tinstalled\tApplication installed\n'];
    const f = follow();
    const result = await installPackage(new CarSession(car, key, HOST),
      { uri: 'file:///p.nbt', size: 900, sha256: 'ab'.repeat(32) }, () => undefined, f);
    expect(result.state).toBe('installed');
    expect(f.states).toEqual(['verified', 'verified', 'installing', 'installed']);
  });

  it('reports the car’s reason for a rejected package', async () => {
    const car = new FakeCar(key, () => [400, 'ERR upload\n']);
    car.statuses = ['STATUS\tfailed\tPackage rejected: this NBT Manager is not newer than the installed one\n'];
    const f = follow();
    const result = await installPackage(new CarSession(car, key, HOST),
      { uri: 'file:///m.nbtr', size: 900, sha256: 'ab'.repeat(32) }, () => undefined, f);
    expect(result).toEqual({ state: 'failed',
      message: 'Package rejected: this NBT Manager is not newer than the installed one' });
    expect(f.states).toEqual(['failed']);
  });

  it('reports a rejection on the car and stops following when asked', async () => {
    const car = new FakeCar(key, () => [202, 'STATUS\twaiting\tConfirm uninstall on the car\n']);
    car.statuses = ['STATUS\tcancelled\tCancelled\n'];
    expect((await removeApp(new CarSession(car, key, HOST), 'test', follow())).state).toBe('cancelled');
    const f = follow();
    f.cancel.cancelled = true;
    await expect(removeApp(new CarSession(car, key, HOST), 'test', f)).rejects.toBeInstanceOf(StoppedFollowing);
  });
});

describe('opening the manager', () => {
  const key = new SoftwareKey();
  const hosts = listenerHosts('172.16.222.1:8080');

  it('talks to the car on the network the phone is on', () => {
    expect(atCarIp('172.16.222.1:8080', '172.16.224.1')).toBe('172.16.224.1:8080');
    expect(atCarIp('172.16.224.1:8080', '')).toBe('172.16.224.1:8080');
    expect(pairHosts('172.16.224.1')).toEqual(['172.16.224.1:8080', '172.16.222.1:8080']);
    expect(pairHosts('')).toEqual(['172.16.222.1:8080', '172.16.224.1:8080']);
  });

  it('wakes through the door and waits for the worker', async () => {
    const car = new FakeCar(key, () => [202, 'WAKE\topening\n']);
    car.down.add(hosts.worker);
    const events: OpeningEvent[] = [];
    let polls = 0;
    const wait = async () => {
      if (++polls === 2) car.down.delete(hosts.worker);
    };
    const session = await reachManager(new CarSession(car, key, hosts.worker), new CarSession(car, key, hosts.door),
      e => events.push(e), { cancelled: false }, wait);
    expect(session.host).toBe(hosts.worker);
    expect(events.map(e => e.kind)).toEqual(['waking', 'opening']);
  });

  it('asks the driver to open it when the car refuses or the door is absent', async () => {
    for (const [reply, reason] of [['WAKE\tmoving\n', 'moving'], [null, 'no-door']] as const) {
      const car = new FakeCar(key, () => [200, reply ?? '']);
      car.down.add(hosts.worker);
      if (!reply) car.down.add(hosts.door);
      const events: OpeningEvent[] = [];
      const wait = async () => {
        car.down.delete(hosts.worker);
      };
      await reachManager(new CarSession(car, key, hosts.worker), new CarSession(car, key, hosts.door),
        e => events.push(e), { cancelled: false }, wait);
      expect(events.at(-1)).toEqual({ kind: 'by-hand', reason });
    }
  });
});
