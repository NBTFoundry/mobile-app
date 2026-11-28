#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""Captures the phone app for the README: the debug build on an Android emulator,
paired with the desk car (scripts/host_car.py), driven through uiautomator.

    yarn android                      # once: build and install the debug build
    python3 scripts/capture_screens.py [--serial emulator-5554] [--out docs/assets]

Writes, framed as a phone on a transparent background:
  mobile-apps.png     the Apps tab, light and dark side by side (with the online catalog
                      when the emulator reaches it)
  mobile-car.png      the Car tab (dark)
  mobile-app.png      an application's page with its update (dark)
  mobile-more.png     More: settings, this phone, About (light)
  mobile-pairing.png  pairing: the code to compare with the car (light)
  mobile-install.webp an install, from the request to the car's approval
With --themes <folder>, also theme-bmw.png, theme-mini.png and theme-supra.png there: the
Apps tab (dark) in each make's theme, for the website's slides.

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
THEMES = ('BMW', 'MINI', 'Supra')                  # as More > Theme names them
ADDRESS_HINT = '10.0.2.2:18080'                    # the desk pairing field's placeholder
SCREEN_W, SCREEN_H = 540, 1200                     # half of the Pixel 6's 1080x2400
BEZEL, BODY_RADIUS, SCREEN_RADIUS = 16, 64, 46
BODY = '#1b1e24'
# (file, app, version, sequence, size in bytes, settings). Doom's sequences are above the online
# catalog's, which the app reads when it opens: the page then offers these packages, not a download.
PACKAGES = [
    ('doom-1.0.18.nbt', 'doom', '1.0.18', 9_000_018, 6_100_000,
     ['sound|Sound|on|on,off', 'turn|Sensitivity|normal|low,normal,high', 'run|Run|always|always,hold']),
    ('doom-1.0.19.nbt', 'doom', '1.0.19', 9_000_019, 6_120_000,
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
        # Whatever the case: labels and tags are shown in capitals.
        for node in self.nodes():
            if label.lower() in ((node.get('text') or '').lower(), (node.get('content-desc') or '').lower()):
                return node
        return None

    def tab(self, label, after=0.8, timeout=15.0):
        """Taps a tab: the lowest thing on screen with that label (a page's title can carry it too).
        Waits for the tabs, which a dialog or the keyboard may still cover."""
        deadline = time.monotonic() + timeout
        while True:
            found = [n for n in self.nodes()
                     if label.lower() in ((n.get('text') or '').lower(), (n.get('content-desc') or '').lower())]
            if found:
                break
            if time.monotonic() > deadline:
                raise SystemExit(f'no tab "{label}"')
            time.sleep(0.4)
        self.tap_node(max(found, key=lambda n: int(re.findall(r'\d+', n.get('bounds'))[1])), after)

    def reach(self, label, swipes=4):
        """Taps `label`, scrolling down to it when it is below the screen."""
        for _ in range(swipes):
            node = self.find(label)
            if node is not None:
                self.tap_node(node, 0.6)
                return
            self.shell('input', 'swipe', '540', '1700', '540', '900', '300')
            time.sleep(0.6)
        self.tap(label)

    def wait(self, label, timeout=20.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            node = self.find(label)
            if node is not None:
                return node
            time.sleep(0.4)
        raise SystemExit(f'"{label}" did not appear')

    def wait_prefix(self, prefix, timeout=20.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if any((n.get('text') or '').startswith(prefix) for n in self.nodes()):
                return
            time.sleep(0.4)
        raise SystemExit(f'nothing starting with "{prefix}" appeared')

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


def result(dev, title, timeout=60.0):
    """Waits until the action `title` finishes in its dialog; returns what it says, and closes it."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        texts = [n.get('text') for n in dev.nodes() if n.get('text')]
        if title in texts and 'Close' in texts:
            detail = texts[texts.index(title) + 1]
            dev.tap('Close')
            return detail
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
              f'exp+manager://expo-development-client/?url={url}', PACKAGE)
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
    dev.tap('‹ Back')


def rename(dev, name):
    dev.tab('Car')
    dev.reach('Rename or forget')
    time.sleep(1.0)
    dev.shell('input', 'keycombination', '113', '29')   # Ctrl+A
    dev.key(67)                                         # Delete
    time.sleep(0.5)
    dev.text(name)
    time.sleep(0.5)
    # The first tap may only reach the keyboard's old layout: until the dialog closes.
    deadline = time.monotonic() + 15
    while True:
        node = dev.find('Save name')
        if node is None:
            break
        if time.monotonic() > deadline:
            raise SystemExit('the name was not saved')
        dev.tap_node(node, 1.5)


def import_packages(dev, files, first=True):
    """Adds `files` to Downloads; a newer version of an application replaces the one there."""
    dev.tab('More')
    dev.reach('Downloads')
    for i, file in enumerate(files):
        dev.tap('Add a file' if first and i == 0 else 'Add file', after=1.5)
        dev.tap(file.name, timeout=30, after=1.0)
        dev.wait_prefix('Package added.')
    dev.tap('‹ Back')


def install(dev, car, app, version):
    """Installs `app` from its page, the package in Downloads, and returns to the tabs."""
    dev.tab('Apps')
    dev.tap(app)
    dev.tap(f'Install {version}')
    dev.wait_prefix('Confirm on the car', timeout=60)
    approve(car)
    if result(dev, f'Install {app} {version}') != 'Installed.':
        raise SystemExit(f'installing {app} {version} failed on the desk car')
    dev.tap('‹ Back')


def theme_shots(dev, shots):
    """The Apps tab (dark) in each make's theme; leaves More open, in the light."""
    dev.night(True)
    for theme in (*THEMES, 'Like the car'):
        dev.tab('More')
        dev.tap('Theme')
        dev.tap(theme)
        if theme in THEMES:
            dev.tab('Apps')
            dev.screenshot(shots / f'theme-{theme.lower()}.png')
    dev.night(False)


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
    Apps tab that lists it."""
    remote = '/sdcard/nbt-capture.mp4'
    dev.tab('Apps')
    dev.tap('media-player', after=1.0)
    dev.sync_clock()
    recorder = subprocess.Popen(dev.adb + ['shell', 'screenrecord', '--time-limit', '40',
                                           '--size', '1080x2400', '--bit-rate', '8000000', remote])
    time.sleep(1.8)
    dev.tap('Install 0.4.2', after=0.2)
    dev.wait_prefix('Confirm on the car', timeout=60)
    time.sleep(2.5)                                  # the driver looks at the car
    approve(car)
    time.sleep(2.5)                                  # the result, read
    if result(dev, 'Install media-player 0.4.2') != 'Installed.':
        raise SystemExit('installing media-player failed on the desk car')
    time.sleep(1.2)
    dev.tap('‹ Back', after=2.5)
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
    parser.add_argument('--themes', type=Path, help='also the Apps tab in each theme, into this folder')
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
                # doom 1.0.19 comes last: it replaces 1.0.18 in the library, as an update to install.
                newer = [file for file in files if file.name == 'doom-1.0.19.nbt']
                import_packages(dev, [file for file in files if file not in newer])
                install(dev, car, 'doom', '1.0.18')
                install(dev, car, 'test', 'v1')
                record_install(dev, car, tmp, frame_parts(tmp), args.out / 'mobile-install.webp')
                import_packages(dev, newer, first=False)

                dev.tab('Apps')
                dev.wait_prefix('1.0.18 ')           # doom's update: from 1.0.18 to 1.0.19
                # With the online catalog, read when the app opened if the emulator reaches it:
                # icons, names, more to get.
                try:
                    dev.wait_prefix('Checked ', timeout=25)
                except SystemExit:
                    print('no catalog: the Apps tab is captured without it')
                dev.screenshot(shots / 'apps-light.png')
                dev.night(True)
                dev.screenshot(shots / 'apps-dark.png')
                dev.tap('doom')
                dev.wait('Troubleshoot')
                dev.screenshot(shots / 'app.png')
                dev.tap('‹ Back')
                dev.tab('Car')
                dev.wait('Health')
                dev.screenshot(shots / 'car.png')
                dev.night(False)
                dev.tab('More')
                dev.wait('Appearance')
                dev.screenshot(shots / 'more.png')
                if args.themes:
                    theme_shots(dev, shots)
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
        for name in ('apps-light', 'apps-dark', 'car', 'app', 'more', 'pairing'):
            frame_still(shots / f'{name}.png', body, tmp / f'framed-{name}.png')
        side_by_side([tmp / 'framed-apps-light.png', tmp / 'framed-apps-dark.png'], args.out / 'mobile-apps.png')
        for name in ('car', 'app', 'more', 'pairing'):
            shutil.copy(tmp / f'framed-{name}.png', args.out / f'mobile-{name}.png')
        for name in ('apps', 'car', 'app', 'more', 'pairing'):
            optimise(args.out / f'mobile-{name}.png')
        if args.themes:
            args.themes.mkdir(parents=True, exist_ok=True)
            for theme in THEMES:
                frame_still(shots / f'theme-{theme.lower()}.png', body, args.themes / f'theme-{theme.lower()}.png')
    print(f'captures in {args.out}')


if __name__ == '__main__':
    main()
