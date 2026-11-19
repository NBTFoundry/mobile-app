#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""A stand-in car on the workstation: the manager's host worker and door, no head unit.

Starts `managerd-test` with a temporary managed root and a temporary apps key, opens a
loopback session (the worker listener) and the door, and optionally forwards both to a
LAN address so a phone's debug build can reach them. Car-side decisions come from stdin,
as the driver gives them on the car; this is a test fixture, not an approval channel.

Commands (one per line, each answered by one line starting with "= "):
  confirm | decline          answer the pending pairing or uninstall
  approve | reject           approve or cancel the reviewed package
  pack <app> <version> <sequence> [<key|label|default|choices> ...] [files=<policy>]
                             build a signed package; files= declares bridge 1.5 `files`
  quit
Any other line is sent to the worker's private channel as is (PHONE STATUS, SET ...).
"""
import argparse
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time

APP_ROOT = Path(__file__).resolve().parents[1]
# The NBTFoundry/manager checkout (NBT_MANAGER_DIR, default ../manager).
MANAGER = Path(os.environ.get('NBT_MANAGER_DIR', APP_ROOT.parent / 'manager'))


def elf(content: bytes, kind: int = 2) -> bytes:
    """A placeholder ARM ELF: an executable, or a shared object (kind 3). Nothing runs it."""
    out = bytearray(128)
    out[:7] = b'\x7fELF\x01\x01\x01'
    out[16:20] = bytes([kind, 0, 0x28, 0])
    out[52:52 + len(content)] = content
    return bytes(out)


def openssl(*args):
    subprocess.run(['openssl', *map(str, args)], check=True, capture_output=True)


def forward(lan: str, port: int, stop: threading.Event):
    """Relays lan:port to 127.0.0.1:port, byte for byte."""
    server = socket.create_server((lan, port))
    server.settimeout(0.5)

    def pipe(src, dst):
        try:
            while data := src.recv(65536):
                dst.sendall(data)
        except OSError:
            pass
        finally:
            for s in (src, dst):
                try:
                    s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

    def serve():
        while not stop.is_set():
            try:
                client, _ = server.accept()
            except TimeoutError:
                continue
            try:
                upstream = socket.create_connection(('127.0.0.1', port), timeout=5)
            except OSError:
                client.close()
                continue
            for a, b in ((client, upstream), (upstream, client)):
                threading.Thread(target=pipe, args=(a, b), daemon=True).start()
        server.close()

    threading.Thread(target=serve, daemon=True).start()


class HostCar:
    def __init__(self, build: Path, port: int, door_port: int, workdir: Path, verbose: bool = False):
        logs = None if verbose else subprocess.DEVNULL
        self.workdir = workdir
        self.root = workdir / 'managed'
        # The layout setup creates (NBTFoundry/installer: core/src/ssh.rs); a first install needs trust/keys.
        for part in ('apps', 'data', 'state/manager', 'trust/apps', 'trust/keys', 'manager/slots/0', 'manager/slots/1'):
            (self.root / part).mkdir(parents=True, exist_ok=True, mode=0o700)
        for path in [self.root, *self.root.rglob('*')]:
            path.chmod(0o700)
        self.key = workdir / 'apps-key.pem'
        public = workdir / 'apps-public.pem'
        openssl('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', self.key)
        openssl('pkey', '-in', self.key, '-pubout', '-out', public)
        # Applications' files: a folder of the workdir stands in for the car's hard disk.
        env = {**os.environ, 'NBT_TEST_APPS_KEY': str(public), 'NBT_TEST_FILES_ROOT': str(workdir / 'files')}
        self.manager_release(build)
        parent, child = socket.socketpair()
        self.worker = subprocess.Popen([build / 'managerd-test', '--control-fd', str(child.fileno()), '--root', self.root],
                                       pass_fds=[child.fileno()], env=env, stdout=logs, stderr=logs)
        child.close()
        self.channel = parent
        self.channel.settimeout(10)
        self.stream = parent.makefile('rb')
        self.lock = threading.Lock()
        assert self.command('HELLO 1') == 'HELLO\t1'
        session = self.command(f'SESSION lo {port}')
        if not session.startswith('SESSION\t'):
            raise SystemExit(f'session refused: {session}')
        self.host = session.split('\t')[1]
        self.door = subprocess.Popen([build / 'managerd-test', '--door', '--root', self.root, '--interface', 'lo',
                                      '--port', str(door_port)], env=env, stdout=logs, stderr=logs)
        self.door_host = f'127.0.0.1:{door_port}'

    def manager_release(self, build: Path):
        """An active signed NBT Manager release, as setup leaves on a car: a new application
        needing the bridge is checked against the bridge it serves."""
        key = self.workdir / 'manager-key.pem'
        openssl('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', key)
        openssl('pkey', '-in', key, '-pubout', '-out', self.root / 'trust/manager.pem')
        (self.root / 'trust/manager.conf').write_text('NBTMANAGERPROFILE1\ncompat=demo-1\n')
        parts = self.workdir / 'release'
        plugin = parts / 'plugin'
        plugin.mkdir(parents=True)
        (plugin / 'libNbtManager.so').write_bytes(elf(b'plugin', 3))
        for name in ('NbtManager.manifest', 'NbtManager.xml', 'NbtManager_ALL_Texts.zip', 'NbtManager_ALL_Images.zip'):
            (plugin / name).write_bytes(name.encode())
        args = []
        for name in ('launcher', 'gui', 'worker'):
            (parts / name).write_bytes(elf(name.encode()))
            args += [f'--{name}', parts / name]
        upload = self.root / 'state/manager/release.upload'
        subprocess.run([sys.executable, *map(str, [MANAGER / 'tools/package_release.py', '--version', 'v1', '--sequence', 1,
                                                   '--compat', 'demo-1', '--key', key, '--output', upload, *args,
                                                   '--plugin-dir', plugin])], check=True, capture_output=True)
        for path in (upload, self.root / 'trust/manager.pem', self.root / 'trust/manager.conf'):
            path.chmod(0o600)
        result = subprocess.run([build / 'manager-stage-probe', self.root, 'initial'], capture_output=True)
        if result.returncode:
            raise SystemExit(f'manager release not staged: {result.stderr.decode().strip()}')

    def command(self, text: str) -> str:
        with self.lock:
            self.channel.sendall(text.encode() + b'\n')
            return self.stream.readline().decode().rstrip('\n')

    def pending(self, answer: str) -> str:
        fields = self.command('PHONE STATUS').split('\t')
        if len(fields) < 3:
            return 'ERR nothing-pending'
        return self.command(f'PHONE {answer} {fields[2]}')

    def approve(self) -> str:
        fields = self.command('STATUS').split('\t')
        if len(fields) < 7 or fields[1] != '2':
            return 'ERR nothing-to-approve'
        return self.command(f'APPROVE {fields[6]} normal')

    def pack(self, app: str, version: str, sequence: str, settings: list[str]) -> str:
        source = self.workdir / f'{app}-{sequence}.elf'
        source.write_bytes(elf(f'{app} {version}'.encode()))
        output = self.workdir / f'{app}-{sequence}-{secrets.token_hex(4)}.nbt'
        args = [sys.executable, MANAGER / 'tools/package.py', '--app', app, '--version', version,
                '--sequence', sequence, '--compat', 'demo-1', '--key', self.key, '--output', output]
        for setting in settings:
            if setting.startswith('files='):
                args += ['--bridge', '1.5', '--bridge-uses', 'show,files', '--bridge-files', setting[6:]]
            else:
                args += ['--setting', setting]
        result = subprocess.run([*map(str, args), str(source)], capture_output=True)
        return str(output) if result.returncode == 0 else 'ERR pack'

    def close(self):
        self.door.terminate()
        try:
            self.command('QUIT')
        except OSError:
            self.worker.kill()
        for process in (self.worker, self.door):
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--build', type=Path, default=Path(os.environ.get('NBT_MANAGER_BUILD', MANAGER / 'build')))
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--door-port', type=int, default=8081)
    parser.add_argument('--lan', help='also listen on this workstation address for a debug build')
    parser.add_argument('--verbose', action='store_true', help="show the worker's and door's own output")
    args = parser.parse_args()
    if not (args.build / 'managerd-test').exists():
        raise SystemExit(f'{args.build}/managerd-test is missing: build the manager host tests or set NBT_MANAGER_BUILD')
    stop = threading.Event()
    with tempfile.TemporaryDirectory(prefix='nbt-host-car-') as tmp:
        car = HostCar(args.build, args.port, args.door_port, Path(tmp), args.verbose)
        try:
            deadline = time.monotonic() + 5
            while True:
                try:
                    socket.create_connection(('127.0.0.1', args.door_port), timeout=1).close()
                    break
                except OSError:
                    if time.monotonic() > deadline:
                        raise SystemExit('the door did not start')
                    time.sleep(0.05)
            if args.lan:
                forward(args.lan, args.port, stop)
                forward(args.lan, args.door_port, stop)
            print(f'READY {car.host} {car.door_host}', flush=True)
            for line in sys.stdin:
                words = line.split()
                if not words:
                    continue
                if words[0] == 'quit':
                    break
                reply = (car.pending('YES') if words == ['confirm'] else car.pending('NO') if words == ['decline']
                         else car.approve() if words == ['approve'] else car.command('CANCEL') if words == ['reject']
                         else car.pack(words[1], words[2], words[3], words[4:]) if words[0] == 'pack' and len(words) >= 4
                         else car.command(line.strip()))
                print(f'= {reply}', flush=True)
        finally:
            stop.set()
            car.close()


if __name__ == '__main__':
    main()
