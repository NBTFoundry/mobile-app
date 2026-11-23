#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""Captures the phone app for the README: the debug build on an Android emulator,
paired with the desk car (scripts/host_car.py), driven through uiautomator.

    yarn android                      # once: build and install the debug build
    python3 scripts/capture_screens.py [--serial emulator-5554] [--out docs/assets]

Writes, framed as a phone on a transparent background:
  mobile-car.png      the Car tab, light and dark side by side
  mobile-library.png  Library (light)
  mobile-app.png      an application's page with its settings (dark)
  mobile-pairing.png  pairing: the code to compare with the car (light)
  mobile-install.webp an install, from the request to the car's approval

Starts Metro (`yarn start`'s port) when nothing listens on it. Clears the app's
data on the emulator first. Needs adb, ffmpeg (with libwebp), ImageMagick
(`magick`) and managerd-test from the manager's host build (NBT_MANAGER_DIR,
default ../manager); pngquant is used when present. The packages are synthetic:
an ARM ELF header and zero padding, signed with the desk car's temporary key.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from host_car import MANAGER, HostCar, elf  # noqa: E402

APP_ROOT = Path(__file__).resolve().parents[1]
PACKAGE = 'org.nbtfoundry.manager'
CAR_PORT, DOOR_PORT = 18080, 18081
ADDRESS_HINT = '10.0.2.2:18080'                    # the desk pairing field's placeholder
SCREEN_W, SCREEN_H = 540, 1200                     # half of the Pixel 6's 1080x2400
BEZEL, BODY_RADIUS, SCREEN_RADIUS = 16, 64, 46
BODY = '#1b1e24'
# (file, app, version, sequence, size in bytes, settings)
PACKAGES = [
    ('doom-1.0.18.nbt', 'doom', '1.0.18', 18, 6_100_000,
     ['sound|Sound|on|on,off', 'turn|Sensitivity|normal|low,normal,high', 'run|Run|always|always,hold']),
    ('doom-1.0.19.nbt', 'doom', '1.0.19', 19, 6_120_000,
     ['sound|Sound|on|on,off', 'turn|Sensitivity|normal|low,normal,high', 'run|Run|always|always,hold']),
    ('media-player-0.4.2.nbt', 'media-player', '0.4.2', 7, 1_400_000, ['source|Source|usb|usb,bluetooth']),
    ('test-v1.nbt', 'test', 'v1', 1, 52_000, ['background|Background|blue|blue,red,green,black']),
]


class Device:
    """One emulator through adb: uiautomator lookups, taps, text, screenshots."""

    def __init__(self, serial):
        self.adb = [shutil.which('adb') or 'adb', '-s', serial]

    def run(self, *args, check=True):
        return subprocess.run(self.adb + list(args), check=check, capture_output=True).stdout

    def shell(self, *args):
        return self.run('shell', *args).decode(errors='replace')

    def nodes(self):
        for _ in range(5):
            xml = self.run('exec-out', 'uiautomator', 'dump', '/dev/tty', check=False)
            start, end = xml.find(b'<?xml'), xml.rfind(b'>')
            if start >= 0 and end > start:
                try:
                    return list(ET.fromstring(xml[start:end + 1]).iter('node'))
                except ET.ParseError:
                    pass
            time.sleep(0.5)
        raise SystemExit('uiautomator gave no window hierarchy')

    def find(self, label):
        for node in self.nodes():
            if label in (node.get('text'), node.get('content-desc')):
                return node
        return None

    def wait(self, label, timeout=20.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            node = self.find(label)
            if node is not None:
                return node
            time.sleep(0.4)
        raise SystemExit(f'"{label}" did not appear')

    def tap(self, label, timeout=20.0, after=0.6):
        self.tap_node(self.wait(label, timeout), after)

    def tap_prefix(self, prefix, after=0.6):
        node = next((n for n in self.nodes() if (n.get('text') or '').startswith(prefix)), None)
        if node is None:
            raise SystemExit(f'nothing starts with "{prefix}"')
        self.tap_node(node, after)

    def tap_node(self, node, after):
        x0, y0, x1, y1 = map(int, re.findall(r'\d+', node.get('bounds')))
        self.shell('input', 'tap', str((x0 + x1) // 2), str((y0 + y1) // 2))
        time.sleep(after)

    def text(self, value):
        self.shell('input', 'text', value.replace(' ', '%s'))

    def key(self, *codes):
        self.shell('input', 'keyevent', *map(str, codes))

    def screenshot(self, path, settle=0.8):
        self.sync_clock()
        time.sleep(settle)
        path.write_bytes(self.run('exec-out', 'screencap', '-p'))

    def night(self, on):
        self.shell('cmd', 'uimode', 'night', 'yes' if on else 'no')
        time.sleep(1.5)

    def demo_mode(self, on):
        """A clean status bar: SystemUI demo mode with full signal and battery."""
        def demo(*extra):
            self.shell('am', 'broadcast', '-a', 'com.android.systemui.demo', *extra)
        if not on:
            demo('-e', 'command', 'exit')
            return
        self.shell('settings', 'put', 'global', 'sysui_demo_allowed', '1')
        demo('-e', 'command', 'enter')
        self.sync_clock()
        demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false')
        demo('-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true')
        demo('-e', 'command', 'network', '-e', 'mobile', 'hide')
        demo('-e', 'command', 'notifications', '-e', 'visible', 'false')

    def sync_clock(self):
        """The status bar's clock at the device's time, matching the app's timestamps."""
        self.shell('am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'clock',
                   '-e', 'hhmm', self.shell('date', '+%H%M').strip())


def listening(port):
    try:
        socket.create_connection(('127.0.0.1', port), timeout=1).close()
        return True
    except OSError:
        return False


def start_metro(port, log):
    if listening(port):
        return None
    metro = subprocess.Popen(['yarn', 'expo', 'start', '--dev-client', '--port', str(port)], cwd=APP_ROOT,
                             env=dict(os.environ, CI='1'), stdout=log, stderr=subprocess.STDOUT)
    deadline = time.monotonic() + 120
    while not listening(port):
        if metro.poll() is not None or time.monotonic() > deadline:
            raise SystemExit('Metro did not start')
        time.sleep(1)
    return metro


def make_packages(car, folder):
    """Signed packages the desk car accepts: synthetic executables of realistic size."""
    paths = []
    for name, app, version, sequence, size, settings in PACKAGES:
        executable = folder / f'{app}-{sequence}.elf'
        executable.write_bytes(elf(f'{app} {version}'.encode()) + bytes(size - 128))
        args = [sys.executable, str(MANAGER / 'tools/package.py'), '--app', app, '--version', version,
                '--sequence', str(sequence), '--compat', 'demo-1', '--key', str(car.key),
                '--output', str(folder / name)]
        for setting in settings:
            args += ['--setting', setting]
        subprocess.run(args + [str(executable)], check=True, capture_output=True)
        paths.append(folder / name)
    return paths


PHASES = ('In progress', 'Done', 'Not done', 'Failed')


def result(dev, title, timeout=60.0):
    """Waits until the activity `title` (the newest one) finishes; returns its phase."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        texts = [n.get('text') for n in dev.nodes() if n.get('text')]
        if title in texts:
            phase = next((t for t in texts[texts.index(title) + 1:] if t in PHASES), None)
            if phase and phase != 'In progress':
                return phase
        time.sleep(0.4)
    raise SystemExit(f'"{title}" did not finish')


def approve(car, timeout=30.0):
    """Approves on the desk car once the phone's request is under review."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not car.approve().startswith('ERR'):
            return
        time.sleep(0.3)
    raise SystemExit('nothing to approve on the desk car')


def open_app(dev, metro_port):
    url = f'http://127.0.0.1:{metro_port}'.replace(':', '%3A').replace('/', '%2F')
    dev.shell('am', 'start', '-a', 'android.intent.action.VIEW', '-d',
              f'exp+nbt-manager://expo-development-client/?url={url}', PACKAGE)
    # The development build's menu introduces itself on first launch; its
    # floating tools button is turned off so that no capture shows it.
    dev.tap('Continue', timeout=180)
    dev.shell('input', 'swipe', '540', '2200', '540', '900', '400')
    time.sleep(1)
    dev.tap('Tools button')
    dev.tap('Close', after=1.5)
    dev.wait('Pair a car')


def pair(dev, car, shots):
    dev.tap('Development')
    dev.tap('Development')
    dev.tap(ADDRESS_HINT)                            # the address field, by its placeholder
    dev.text(f'10.0.2.2:{CAR_PORT}')
    dev.key(111)                                     # hide the keyboard
    assert car.command('PHONE OPEN') == 'OK'
    dev.tap('Pair the desk car', after=0.3)
    dev.wait('Check that the car shows the same code, then confirm on the car.')
    dev.screenshot(shots / 'pairing.png')
    assert car.pending('YES').startswith('OK')
    dev.wait('Paired.')


def rename(dev, name):
    dev.tap('Car')
    dev.tap('Manage')
    dev.tap('Switch or manage cars')
    dev.tap('Manage car', after=1.0)
    dev.shell('input', 'keycombination', '113', '29')   # Ctrl+A
    dev.key(67)                                         # Delete
    time.sleep(0.5)
    dev.text(name)
    time.sleep(0.5)
    dev.tap('Save name')
    dev.tap('‹ Back')


def import_packages(dev, files):
    dev.tap('Library')
    for i, file in enumerate(files):
        dev.tap('Add a file' if i == 0 else 'Add file', after=1.5)
        dev.tap(file.name, timeout=30, after=1.0)
        dev.wait('Package added.')


def install(dev, car, app, version, row=None):
    """Installs `app` from its page: the newest package, or the versions list's `row`."""
    dev.tap('Car')
    dev.tap(app)
    if row:
        dev.tap('Package versions')
        dev.tap(row)
    else:
        dev.tap(f'Install {version}')
    dev.wait('Confirm on the car.', timeout=60)
    approve(car)
    if result(dev, f'Install {app} {version}') != 'Done':
        raise SystemExit(f'installing {app} {version} failed on the desk car')


def frame_parts(tmp):
    """The phone body with a hole for the screen, and the screen's rounded mask."""
    w, h = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    body = tmp / 'phone-body.png'
    subprocess.run([
        'magick', '-size', f'{w}x{h}', 'xc:none', '-fill', BODY,
        '-draw', f'roundrectangle 0,0 {w - 1},{h - 1} {BODY_RADIUS},{BODY_RADIUS}',
        '(', '-size', f'{w}x{h}', 'xc:none', '-fill', 'white', '-draw',
        f'roundrectangle {BEZEL},{BEZEL} {BEZEL + SCREEN_W - 1},{BEZEL + SCREEN_H - 1} '
        f'{SCREEN_RADIUS},{SCREEN_RADIUS}', ')',
        '-compose', 'DstOut', '-composite', str(body)], check=True)
    return body


def frame_still(shot, body, dst):
    subprocess.run([
        'magick', str(shot), '-resize', f'{SCREEN_W}x{SCREEN_H}!', '-background', 'none',
        '-gravity', 'center', '-extent', f'{SCREEN_W + 2 * BEZEL}x{SCREEN_H + 2 * BEZEL}',
        str(body), '-compose', 'over', '-composite', '-strip', str(dst)], check=True)


def side_by_side(images, dst, gap=56):
    args = ['magick', '-background', 'none']
    for i, image in enumerate(images):
        if i:
            args += ['(', '-size', f'{gap}x1', 'xc:none', ')']
        args.append(str(image))
    subprocess.run(args + ['-gravity', 'center', '+append', '-strip', str(dst)], check=True)


def optimise(path):
    if shutil.which('pngquant'):
        subprocess.run(['pngquant', '--force', '--skip-if-larger', '--output', str(path), '--', str(path)])


def record_install(dev, car, tmp, body, dst):
    """Records installing media-player from its page, to the car's approval and the
    Car tab that lists it."""
    remote = '/sdcard/nbt-capture.mp4'
    dev.tap('Car')
    dev.tap('media-player', after=1.0)
    dev.sync_clock()
    recorder = subprocess.Popen(dev.adb + ['shell', 'screenrecord', '--time-limit', '40',
                                           '--size', '1080x2400', '--bit-rate', '8000000', remote])
    time.sleep(1.8)
    dev.tap('Install 0.4.2', after=0.2)
    dev.wait('Confirm on the car.', timeout=60)
    time.sleep(2.5)                                  # the driver looks at the car
    approve(car)
    if result(dev, 'Install media-player 0.4.2') != 'Done':
        raise SystemExit('installing media-player failed on the desk car')
    time.sleep(1.8)
    dev.tap('Car', after=2.5)
    dev.shell('pkill', '-INT', 'screenrecord')
    recorder.wait(timeout=20)
    time.sleep(1)
    video = tmp / 'install.mp4'
    dev.run('pull', remote, str(video))
    dev.shell('rm', '-f', remote)
    w, h = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    subprocess.run([
        'ffmpeg', '-loglevel', 'error', '-y', '-i', str(video), '-i', str(body), '-filter_complex',
        f'[0:v]fps=12,scale={SCREEN_W}:{SCREEN_H}:flags=lanczos,format=rgba,'
        f'pad={w}:{h}:{BEZEL}:{BEZEL}:color=0x00000000[s];[s][1:v]overlay=0:0,'
        f'scale={w * 3 // 4}:-1:flags=lanczos,format=yuva420p',
        '-c:v', 'libwebp', '-quality', '72', '-compression_level', '6', '-loop', '0', '-an',
        str(dst)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial', help='the emulator (default: the only one attached)')
    parser.add_argument('--out', type=Path, default=APP_ROOT / 'docs' / 'assets')
    parser.add_argument('--metro-port', type=int, default=8082)
    parser.add_argument('--build', type=Path, default=Path(os.environ.get('NBT_MANAGER_BUILD', MANAGER / 'build')))
    args = parser.parse_args()
    for tool in ('adb', 'ffmpeg', 'magick'):
        if not shutil.which(tool):
            sys.exit(f'{tool} is required')
    if not (args.build / 'managerd-test').exists():
        sys.exit(f'{args.build}/managerd-test is missing: run make test in the manager')
    serial = args.serial
    if not serial:
        devices = [line.split()[0] for line in subprocess.run(['adb', 'devices'], capture_output=True, text=True)
                   .stdout.splitlines()[1:] if line.endswith('\tdevice')]
        if len(devices) != 1:
            sys.exit('attach exactly one emulator, or give --serial')
        serial = devices[0]
    dev = Device(serial)
    if PACKAGE not in dev.shell('pm', 'list', 'packages', PACKAGE):
        sys.exit(f'{PACKAGE} is not installed on {serial}: run yarn android')
    args.out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='nbt-capture-') as temporary:
        tmp = Path(temporary)
        shots = tmp / 'shots'
        shots.mkdir()
        (tmp / 'car').mkdir()
        with open(tmp / 'metro.log', 'wb') as log:
            metro = start_metro(args.metro_port, log)
            car = HostCar(args.build, CAR_PORT, DOOR_PORT, tmp / 'car')
            night = dev.shell('cmd', 'uimode', 'night').strip()
            try:
                files = make_packages(car, tmp)
                dev.run('reverse', f'tcp:{args.metro_port}', f'tcp:{args.metro_port}')
                dev.shell('pm', 'clear', PACKAGE)
                dev.night(False)
                dev.demo_mode(True)
                for file in files:
                    dev.run('push', str(file), f'/sdcard/Download/{file.name}')
                dev.shell('content', 'call', '--method', 'scan_volume', '--uri', 'content://media',
                          '--arg', 'external_primary')

                open_app(dev, args.metro_port)
                pair(dev, car, shots)
                rename(dev, 'My car')
                import_packages(dev, files)
                dev.screenshot(shots / 'library.png')
                install(dev, car, 'doom', '1.0.18', row='1.0.18, Sequence 18, Install')
                install(dev, car, 'test', 'v1')
                record_install(dev, car, tmp, frame_parts(tmp), args.out / 'mobile-install.webp')

                dev.wait('Update available')
                dev.screenshot(shots / 'car-light.png')
                dev.night(True)
                dev.screenshot(shots / 'car-dark.png')
                dev.tap('doom')
                dev.tap('Read settings')
                dev.wait('Sensitivity')
                dev.screenshot(shots / 'app.png')
                dev.night(False)
            finally:
                dev.demo_mode(False)
                dev.shell('cmd', 'uimode', 'night', 'yes' if night.endswith('yes') else 'no')
                for file in PACKAGES:
                    dev.shell('rm', '-f', f'/sdcard/Download/{file[0]}')
                dev.run('reverse', '--remove', f'tcp:{args.metro_port}', check=False)
                car.close()
                if metro:
                    metro.terminate()
                    metro.wait(timeout=10)

        body = frame_parts(tmp)
        for name in ('car-light', 'car-dark', 'library', 'app', 'pairing'):
            frame_still(shots / f'{name}.png', body, tmp / f'framed-{name}.png')
        side_by_side([tmp / 'framed-car-light.png', tmp / 'framed-car-dark.png'], args.out / 'mobile-car.png')
        for name in ('library', 'app', 'pairing'):
            shutil.copy(tmp / f'framed-{name}.png', args.out / f'mobile-{name}.png')
        for name in ('car', 'library', 'app', 'pairing'):
            optimise(args.out / f'mobile-{name}.png')
    print(f'captures in {args.out}')


if __name__ == '__main__':
    main()
