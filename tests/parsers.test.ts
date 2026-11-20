// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { parseApps, parseAutostart, parsePair, parseSettings, parseStatus, parseWake, errorCode } from '../src/protocol/replies';
import { parseWifiCode } from '../src/protocol/wifiCode';
import { parsePackageHead } from '../src/protocol/packageHeader';

describe('reply parsers', () => {
  it('parses applications and keeps sequences as text', () => {
    expect(parseApps('APPS\t2\ntest\tv2\t18446744073709551615\t1\nclock\t1.0\t3\t0\n')).toEqual([
      { id: 'test', version: 'v2', sequence: '18446744073709551615', running: true },
      { id: 'clock', version: '1.0', sequence: '3', running: false },
    ]);
    expect(parseApps('APPS\t0\n')).toEqual([]);
  });
  it.each([
    'APPS\t1\n', 'APPS\t1\ntest\tv\t1\t2\n', 'APPS\t2\nt\tv\t1\t0\nt\tv\t1\t0\n', 'APPS\t17\n',
    'APPS\t1\ntest\tv\t1\t0', 'APPS\t01\nt\tv\t1\t0\n', 'APPS\t1\nT\tv\t1\t0\n', 'APPS\t1\nt\tv\t1.5\t0\n',
  ])('rejects malformed apps %#', text => expect(() => parseApps(text)).toThrow());

  it('parses settings', () => {
    expect(parseSettings('SETTINGS\t1\nbackground|Background|red|red,blue\n')).toEqual([
      { key: 'background', label: 'Background', value: 'red', choices: ['red', 'blue'] }]);
  });
  it.each([
    'SETTINGS\t1\nbg|Bg|green|red,blue\n', 'SETTINGS\t1\nbg|Bg|red|red,red\n',
    'SETTINGS\t1\nBg|Bg|red|red\n', 'SETTINGS\t1\nbg| Bg|red|red\n',
    'SETTINGS\t1\nbg|Bg|a|a,b,c,d,e,f,g\n', 'SETTINGS\t2\nbg|Bg|a|a\nbg|Bg|a|a\n',
  ])('rejects malformed settings %#', text => expect(() => parseSettings(text)).toThrow());

  it('parses status, including the paired car identity', () => {
    expect(parseStatus('STATUS\tverified\tReview and confirm on the car\n'))
      .toEqual({ state: 'verified', message: 'Review and confirm on the car' });
    expect(parseStatus('STATUS\tpaired\tPhone paired\nCAR\t02:11:22:33:44:55\t172.16.222.1:8080\n'))
      .toEqual({ state: 'paired', message: 'Phone paired', car: { bssid: '02:11:22:33:44:55', address: '172.16.222.1:8080' } });
  });
  it.each([
    'STATUS\tdone\tx\n', 'STATUS\twaiting\n', 'STATUS\twaiting\tx\nCAR\t02:11:22:33:44:55\t1.2.3.4:5\n',
    'STATUS\tpaired\tx\nCAR\t02:11:22:33:44\t1.2.3.4:5\n', 'STATUS\tfailed\tbad\x01\n',
  ])('rejects malformed status %#', text => expect(() => parseStatus(text)).toThrow());

  it('parses pair, wake and errors', () => {
    expect(parsePair('PAIR\tpending\t012345\n')).toBe('012345');
    expect(() => parsePair('PAIR\tpending\t12345\n')).toThrow();
    expect(parseWake('WAKE\tmoving\n')).toBe('moving');
    expect(() => parseWake('WAKE\tsoon\n')).toThrow();
    expect(errorCode('ERR busy\n')).toBe('busy');
    expect(errorCode('<html>')).toBe('unknown');
  });
});

describe('Wi-Fi code', () => {
  it('parses the car format with escapes', () => {
    expect(parseWifiCode('WIFI:T:WPA;S:DIRECT-ab\\;c;P:pass\\:word\\\\x;;'))
      .toEqual({ ssid: 'DIRECT-ab;c', passphrase: 'pass:word\\x' });
  });
  it.each([
    'WIFI:T:WPA;S:x;P:short;;', 'WIFI:T:WEP;S:x;P:longenough;;', 'WIFI:T:WPA;S:;P:longenough;;',
    'http://example.com', 'WIFI:T:WPA;S:x;P:longenough;', 'WIFI:T:WPA;S:x;S:y;P:longenough;;',
    'WIFI:T:WPA;S:x;P:longenough;H:true;;',
  ])('rejects %s', text => expect(() => parseWifiCode(text)).toThrow());
});

function makePackage(manifest: string, payload = 64, signature = 384): Uint8Array {
  const m = Buffer.from(manifest, 'ascii');
  const header = Buffer.alloc(24);
  header.write('NBTMGR1\n', 0, 'ascii');
  header.writeUInt32BE(m.length, 8);
  header.writeUInt32BE(signature, 12);
  header.writeUInt32BE(0, 16);
  header.writeUInt32BE(payload, 20);
  return new Uint8Array(Buffer.concat([header, m, Buffer.alloc(signature), Buffer.alloc(payload)]));
}

describe('package header', () => {
  const sha = createHash('sha256').update('x').digest('hex');
  const manifest = (extra = '', app = 'test', size = 64) => `app=${app}\npackage=${'ab'.repeat(16)}\nversion=v2\n`
    + `sequence=2\nplatform=qnx6.5-armv7le\ncompat=demo-1\nsize=${size}\nsha256=${sha}\n${extra}`;
  it('reads the manifest', () => {
    const file = makePackage(manifest('bridge=1.0\nbridge-uses=\nbridge-optional=show\nsetting=bg|Background|red|red,blue\n'));
    const info = parsePackageHead(file.subarray(0, 2072), file.length);
    expect(info).toMatchObject({ app: 'test', version: 'v2', sequence: '2', compat: 'demo-1', payloadSize: 64 });
    expect(info.settings).toHaveLength(1);
  });
  it('rejects wrong lengths, magic, manager and size mismatches', () => {
    const good = makePackage(manifest());
    expect(() => parsePackageHead(good, good.length + 1)).toThrow();
    expect(() => parsePackageHead(makePackage(manifest(), 64, 256), good.length - 128)).toThrow();
    const wrongMagic = good.slice();
    wrongMagic[0] = 0x58;
    expect(() => parsePackageHead(wrongMagic, good.length)).toThrow();
    const manager = makePackage(manifest('', 'manager'));
    expect(() => parsePackageHead(manager, manager.length)).toThrow();
    const sized = makePackage(manifest('', 'test', 65));
    expect(() => parsePackageHead(sized, sized.length)).toThrow();
  });
});

const COMPONENTS_V1 = ['launcher', 'gui', 'worker', 'plugin_lib', 'plugin_manifest', 'plugin_xml', 'plugin_text',
  'plugin_images'];
const COMPONENTS_V2 = [...COMPONENTS_V1, 'capture_lib'];

/** A manager release as tools/package_release.py writes it. */
function makeRelease(sizes: number[], extra = '', signature = 384, magic = 'NBTRLS1\n'): Uint8Array {
  const sha = createHash('sha256').update('y').digest('hex');
  const components = magic === 'NBTRLS2\n' ? COMPONENTS_V2 : COMPONENTS_V1;
  let text = `version=dev47\nsequence=47\nplatform=qnx6.5-armv7le\ncompat=nbt-evo-dev\n${extra}`;
  components.forEach((name, i) => { text += `${name}_size=${sizes[i]}\n${name}_sha256=${sha}\n`; });
  const m = Buffer.from(text, 'ascii');
  const header = Buffer.alloc(16);
  header.write(magic, 0, 'ascii');
  header.writeUInt32BE(m.length, 8);
  header.writeUInt32BE(signature, 12);
  const payload = sizes.reduce((a, b) => a + b, 0);
  return new Uint8Array(Buffer.concat([header, m, Buffer.alloc(signature), Buffer.alloc(payload)]));
}

describe('manager release header', () => {
  const sizes = [100, 200, 300, 40, 5, 6, 7, 8];
  it('reads a manager release as the application "manager"', () => {
    const file = makeRelease(sizes, 'bridge=1.2|show,status\n');
    const info = parsePackageHead(file.subarray(0, 4096), file.length);
    expect(info).toMatchObject({ app: 'manager', version: 'dev47', sequence: '47', compat: 'nbt-evo-dev',
      payloadSize: 666, settings: [] });
  });
  it('reads an NBTRLS2 manager release with capture_lib and rejects mismatches', () => {
    const file = makeRelease([...sizes, 64], 'bridge=1.3|show,status\n', 384, 'NBTRLS2\n');
    const info = parsePackageHead(file.subarray(0, 4096), file.length);
    expect(info).toMatchObject({ app: 'manager', version: 'dev47', sequence: '47', compat: 'nbt-evo-dev',
      payloadSize: 730, settings: [] });
    const badV2MagicWith8 = makeRelease(sizes, '', 384, 'NBTRLS2\n');
    expect(() => parsePackageHead(badV2MagicWith8, badV2MagicWith8.length)).toThrow();
  });
  it('rejects wrong lengths, a missing component and a bad signature size', () => {
    const good = makeRelease(sizes);
    expect(() => parsePackageHead(good, good.length + 1)).toThrow();
    expect(() => parsePackageHead(good.subarray(0, 100), good.length)).toThrow();
    const short = makeRelease(sizes, '', 256);
    expect(() => parsePackageHead(short, short.length)).toThrow();
    const text = Buffer.from(good).toString('latin1').replace('plugin_images_size=8\n', 'plugin_image_size=8\n');
    const renamed = new Uint8Array(Buffer.from(text, 'latin1'));
    expect(() => parsePackageHead(renamed, renamed.length)).toThrow();
  });
});

describe('parseAutostart', () => {
  it('reads the preference and the pause', () => {
    expect(parseAutostart('AUTOSTART\toff\tready\n')).toEqual({ on: false, paused: false });
    expect(parseAutostart('AUTOSTART\ton\tready\n')).toEqual({ on: true, paused: false });
    expect(parseAutostart('AUTOSTART\ton\tblocked\n')).toEqual({ on: true, paused: true });
    // Paused only matters while it is on.
    expect(parseAutostart('AUTOSTART\toff\tblocked\n')).toEqual({ on: false, paused: false });
  });
  it.each([
    '', 'AUTOSTART\ton\tready', 'AUTOSTART\tyes\tready\n', 'AUTOSTART\ton\n',
    'AUTOSTART\ton\tready\textra\n', 'OK\n',
  ])('rejects malformed replies %#', text => expect(() => parseAutostart(text)).toThrow());
});
