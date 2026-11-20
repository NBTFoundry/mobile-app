// SPDX-License-Identifier: MPL-2.0
/**
 * Contract test: the app's TypeScript protocol, with a software key, against the real host
 * worker and door (scripts/host_car.py). Car-side confirmations come from the harness, as
 * the driver would give them on the car. Run: yarn test:contract
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { changeAutostart, changeSetting, clearAppLog, installPackage, listApps, pairPhone, readAppLog,
  readAutostart, readSettings, readSystemLog, removeApp, wake, type Follow } from '../src/protocol/actions';
import { listFiles, removeFile, sendFile } from '../src/protocol/files';
import { reachManager } from '../src/protocol/opening';
import { CarError, CarSession } from '../src/protocol/session';
import { SoftwareKey } from '../tests/support/softwareKey';
import { nodeLink } from './nodeLink';

function check(condition: unknown, what: string): asserts condition {
  if (!condition) throw new Error(`contract failed: ${what}`);
  console.log(`ok - ${what}`);
}

const freePort = () => new Promise<number>(resolve => {
  const server = createServer().listen(0, '127.0.0.1', () => {
    const port = (server.address() as { port: number }).port;
    server.close(() => resolve(port));
  });
});

async function main() {
  const [port, doorPort] = [await freePort(), await freePort()];
  // Stands in for the car's sloginfo.
  const sloginfo = path.join(tmpdir(), `nbt-contract-sloginfo-${process.pid}`);
  writeFileSync(sloginfo, '#!/bin/sh\necho "slog: iDrive started"\n', { mode: 0o700 });
  const car = spawn('python3', [path.join(__dirname, 'host_car.py'), '--port', String(port), '--door-port', String(doorPort), ...(process.env.CONTRACT_VERBOSE ? ['--verbose'] : [])],
    { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, NBT_TEST_SLOGINFO: sloginfo } });
  const lines = createInterface({ input: car.stdout! })[Symbol.asyncIterator]();
  const next = async () => String((await lines.next()).value ?? '');
  let queue = Promise.resolve('');
  const driver = (command: string) => {
    queue = queue.then(async () => {
      car.stdin!.write(command + '\n');
      return (await next()).replace(/^= /, '');
    });
    return queue;
  };
  try {
    const ready = (await next()).split(' ');
    check(ready[0] === 'READY', 'the host car started');
    const [workerHost, doorHost] = [ready[1]!, ready[2]!];
    const key = new SoftwareKey();
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, Math.min(ms, 200)));
    const follow = (onStatus: Follow['onStatus'] = () => undefined): Follow => ({ cancel: { cancelled: false }, wait, onStatus });
    const worker = new CarSession(nodeLink, key, workerHost);
    const door = new CarSession(nodeLink, key, doorHost);

    check(await driver('PHONE OPEN') === 'OK', 'the car opens its pairing window');
    let shown = '';
    const paired = await pairPhone(worker, 'Contract phone', key.publicKey, digits => {
      shown = digits;
      void driver('confirm');
    }, follow());
    check(/^\d{6}$/.test(shown), 'the phone derived the six digits the car showed');
    check(!('state' in paired) && paired.bssid === '02:11:22:33:44:55' && paired.address === workerHost,
      'pairing returns the car identity and address');
    check((await listApps(worker)).length === 0, 'an empty car lists no applications');

    const other = new SoftwareKey();
    const stranger = new CarSession(nodeLink, other, workerHost);
    const refused = await listApps(stranger).catch(e => e);
    check(refused instanceof CarError && refused.status === 403, 'an unpaired key is refused');

    const file = await driver('pack test v1 1 bg|Background|red|red,blue');
    const bytes = readFileSync(file);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let approved = false;
    let progress = 0;
    const installed = await installPackage(worker, { uri: pathToFileURL(file).href, size: statSync(file).size, sha256 },
      sent => (progress = sent), follow(status => {
        if (process.env.CONTRACT_VERBOSE) console.log(`  status ${status.state}: ${status.message}`);
        if (status.state === 'verified' && !approved) {
          approved = true;
          void driver('approve').then(reply => process.env.CONTRACT_VERBOSE && console.log(`  approve: ${reply}`));
        }
      }));
    check(progress === bytes.length, 'the upload reported its progress to the end');
    check(installed.state === 'installed', 'a package confirmed on the car is installed');
    const apps = await listApps(worker);
    check(apps.length === 1 && apps[0]!.id === 'test' && apps[0]!.sequence === '1', 'the car lists the installed application');

    check((await readSettings(worker, 'test'))[0]?.value === 'red', 'settings read the declared default');
    await changeSetting(worker, 'test', 'bg', 'blue');
    check((await readSettings(door, 'test'))[0]?.value === 'blue', 'a setting changes at once and the door sees it');
    const invalid = await changeSetting(worker, 'test', 'bg', 'green').catch(e => e);
    check(invalid instanceof CarError, 'an undeclared value is refused');
    const off = await readAutostart(worker, 'test');
    check(off?.on === false && !off.paused, 'Start with the car is off after install');
    await changeAutostart(door, 'test', true);
    check((await readAutostart(worker, 'test'))?.on === true, 'Start with the car switches on from the door');
    await changeAutostart(worker, 'test', false);
    check((await readAutostart(door, 'test'))?.on === false, 'and off from the worker');

    const appLog = await readAppLog(door, 'test');
    check(appLog.size === 0 && appLog.tail === '', 'an application that never ran has an empty log');
    const systemLog = await readSystemLog(worker);
    check(systemLog.tail === 'slog: iDrive started\n' && readFileSync(new URL(systemLog.uri), 'ascii') === systemLog.tail,
      'the system log is saved to a file and its end shown');
    await clearAppLog(door, 'test');
    check((await readAppLog(worker, 'test')).size === 0, 'an application log is cleared');
    const unknown = await readAppLog(worker, 'missing').catch(e => e);
    check(unknown instanceof CarError && unknown.status === 400, 'an unknown application has no log');

    // An application's files (bridge 1.5): sent, listed and deleted with no prompt on the car.
    const gamesPackage = await driver('pack games v1 1 files=sfc,smc|1|4');
    const gamesBytes = readFileSync(gamesPackage);
    let gamesApproved = false;
    const games = await installPackage(worker, { uri: pathToFileURL(gamesPackage).href, size: gamesBytes.length,
      sha256: createHash('sha256').update(gamesBytes).digest('hex') }, () => undefined, follow(status => {
      if (status.state === 'verified' && !gamesApproved) {
        gamesApproved = true;
        void driver('approve');
      }
    }));
    check(games.state === 'installed', 'an application that takes files is installed');
    const empty = await listFiles(worker, 'games');
    check(empty.count === 0 && empty.files.length === 0 && empty.extensions.join() === 'sfc,smc'
      && empty.largest === 1048576 && empty.quota === 4194304 && empty.free > 0, 'its files list its policy and no files');
    const none = await listFiles(worker, 'test').catch(e => e);
    check(none instanceof CarError && none.status === 404 && none.code === 'app', 'an application without files has none');
    const rom = path.join(tmpdir(), `nbt-contract-${process.pid}.sfc`);
    writeFileSync(rom, Buffer.alloc(3000, 7));
    const romFile = { uri: pathToFileURL(rom).href, size: 3000, sha256: createHash('sha256').update(readFileSync(rom)).digest('hex') };
    let sent = 0;
    await sendFile(worker, 'games', 'Game One.sfc', romFile, n => (sent = n));
    check(sent === 3000, 'a file is sent to the end');
    const one = await listFiles(worker, 'games');
    check(one.count === 1 && one.used === 3000 && one.files[0]?.name === 'Game One.sfc' && one.files[0]?.size === 3000,
      'the car lists the file it stored');
    const wrongType = await sendFile(worker, 'games', 'notes.txt', romFile, () => undefined).catch(e => e);
    check(wrongType instanceof CarError && wrongType.status === 400 && wrongType.code === 'type',
      'a file of a type the application does not take is refused');
    const big = path.join(tmpdir(), `nbt-contract-${process.pid}-big.sfc`);
    writeFileSync(big, Buffer.alloc(1048577, 1));
    const tooBig = await sendFile(worker, 'games', 'Big.sfc', { uri: pathToFileURL(big).href, size: 1048577,
      sha256: createHash('sha256').update(readFileSync(big)).digest('hex') }, () => undefined).catch(e => e);
    check(tooBig instanceof CarError && tooBig.status === 413 && tooBig.code === 'size',
      'a file larger than the application allows is refused before its bytes');
    rmSync(rom);
    rmSync(big);
    await removeFile(worker, 'games', 'Game One.sfc');
    check((await listFiles(worker, 'games')).count === 0, 'a file is deleted at once');
    const gone = await removeFile(worker, 'games', 'Game One.sfc').catch(e => e);
    check(gone instanceof CarError && gone.status === 404 && gone.code === 'missing', 'a file already deleted is missing');
    let gamesAsked = false;
    const gamesRemoved = await removeApp(worker, 'games', follow(status => {
      if (status.state === 'waiting' && !gamesAsked) {
        gamesAsked = true;
        void driver('confirm');
      }
    }));
    check(gamesRemoved.state === 'removed', 'the application that takes files is uninstalled');

    check(await wake(door) === 'off', 'the door answers off while Open from phone is off');
    check(await driver('SET manager phone_open on') === 'OK', 'Open from phone is switched on at the car');
    check(await wake(door) === 'opening', 'the door accepts a wake request');
    const reached = await reachManager(worker, door, () => undefined, { cancelled: false }, wait);
    check(reached === worker, 'an open manager is reached directly');

    const declined = await removeApp(worker, 'test', follow(status => {
      if (status.state === 'waiting') void driver('decline');
    }));
    check(declined.state === 'cancelled', 'an uninstall declined on the car is reported as cancelled');
    let asked = false;
    const removed = await removeApp(worker, 'test', follow(status => {
      if (status.state === 'waiting' && !asked) {
        asked = true;
        void driver('confirm');
      }
    }));
    check(removed.state === 'removed', 'an uninstall confirmed on the car removes the application');
    check((await listApps(worker)).length === 0, 'the car no longer lists it');

    check((await driver(`PHONE FORGET ${key.keyId}`)) === 'OK', 'the car forgets the phone');
    const revoked = await listApps(worker).catch(e => e);
    check(revoked instanceof CarError && revoked.status === 403, 'a forgotten phone is refused');
    console.log('contract: all checks passed against the host worker');
  } finally {
    car.stdin!.end('quit\n');
    await new Promise(resolve => car.on('close', resolve));
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
