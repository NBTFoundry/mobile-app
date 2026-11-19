# NBT Manager

Android app that manages applications on a BMW NBT head unit running NBT Manager:
pair once per car, then install, update and uninstall applications and change their
settings from the phone. The car shows every install and uninstall for the driver to
confirm; the phone never approves anything. On a car without NBT Manager, **Install NBT
Manager on a car** installs it over a Wi-Fi ENET adapter (SSH as root with the head
unit's published password; enabling SSH only after the user confirms). Expo SDK 58, React Native 0.88, Android 10+,
application id `net.cornera.nbtmgr`. See [HANDOVER.md](HANDOVER.md) for status.

The wire protocol is defined once, in the manager's
[`PROTOCOL.md`](third_party/nbt-apps-manager/PROTOCOL.md) (paired-phone HTTP protocol 1).

## Setup

Node 24 with `corepack enable` (Yarn 4), JDK 17, Android SDK 36 (`ANDROID_HOME` set) with
an NDK, and Rust with `cargo install cargo-ndk` and
`rustup target add aarch64-linux-android`, then:

```sh
git submodule update --init
yarn install --immutable
yarn installer-core    # builds the installer core (Rust) and its Kotlin binding
yarn prebuild          # generates android/ (not committed)
```

`yarn installer-core` (`scripts/build-installer-core.sh`) builds `libnbt_installer.so`
from the manager's `desktop/` workspace (the submodule, or `$NBT_INSTALLER_SOURCE`) and
generates its UniFFI binding, both into `modules/car-install/android/generated/` (not
committed). Run it again after the submodule moves. A development build has no manager
release inside, so Install and Update are unavailable; `--release` embeds one
(`NBT_MANAGER_RELEASE`, `NBT_MANAGER_PUBLIC_KEY`, as the manager's kit build sets).
For the x86_64 emulator: `NBT_INSTALLER_ABIS="arm64-v8a x86_64" yarn installer-core`
and build with `-PreactNativeArchitectures=x86_64`.

## Develop

Two kinds of build:

- **Dev client** for the UI: a debug build that loads JavaScript from Metro over the LAN.
  Install it once (`yarn android`, or build `android/app/build/outputs/apk/debug/` and
  copy the APK); reinstall only after native changes (modules, config plugin, permissions).
  Then `yarn start` serves Metro on port 8082, away from the door's 8081.
- **Full client** for the car: the signed release build (below). Joining the car's Wi-Fi can
  take the phone off the LAN, which stops Metro, so in-car tests use the release build.

**Emulator:** `yarn emulator` starts the first AVD (or `$NBT_AVD`) and waits for it to
boot; `yarn android:emulator` also builds and installs the dev client there. The
emulator cannot join a car's Wi-Fi or scan a real code; it reaches the workstation at
`10.0.2.2`, so pair the desk car (run without `--lan`) with that address.

The **desk car** stands in for the head unit: the manager's host worker and door on the
workstation, with car-side decisions typed in its terminal.

```sh
NBT_MANAGER_BUILD=~/src/reverse/nbt-apps-manager/build yarn desk --lan 192.168.1.20
```

If 8080 is taken on the workstation, add `--port 18080 --door-port 18081` (the door is
always the worker's port + 1) and enter `address:18080` in the app. It needs
`managerd-test` from the manager's host build (`nice make -j$(nproc) test` there).
In the debug build, Cars shows *Pair the desk car*: enter the workstation address. Debug
builds map the worker's loopback listener (`127.0.0.1:8080/8081`) to that address; release
builds reach only `172.16.222.1` and `172.16.224.1`. In the desk car's terminal, type
`PHONE OPEN` before pairing, then `confirm`, `decline`, `approve`, `reject`, or
`pack <app> <version> <sequence> [setting]` to make a signed test package (copy it to the
phone to add it to the library).

## Test

```sh
yarn typecheck && yarn lint && yarn test
NBT_MANAGER_BUILD=~/src/reverse/nbt-apps-manager/build yarn test:contract
./android/gradlew -p android :car-link:testDebugUnitTest :device-key:testDebugUnitTest :app:assembleDebug
```

- Jest checks the protocol against the manager's shared signing vectors and a fake car.
- The contract test runs the TypeScript protocol with a software key over Node sockets
  against the real host worker and door (`scripts/host_car.py`). It is not a car test.
- The Kotlin unit tests cover the route allow-list, the exact HTTP the car's parser
  accepts, reply bounds and the signing-text guard. Keystore, Wi-Fi joining and the
  socket binding need a phone.
- The installer's state is tested in Jest (`tests/installer.test.ts`); its Rust core in
  the manager repository (`cargo test --workspace` in `desktop/`).

## Release signing

Release builds use a dedicated keystore outside the repository, never the debug key:

```sh
mkdir -p ~/.local/share/nbt-manager/keys/android && cd ~/.local/share/nbt-manager/keys/android
keytool -genkeypair -keystore nbt-manager-release.jks -alias nbt-manager -keyalg EC \
  -groupname secp256r1 -validity 10000 -dname "CN=NBT Manager"
chmod 600 nbt-manager-release.jks
keytool -list -v -keystore nbt-manager-release.jks -alias nbt-manager | grep SHA256
```

Back the keystore and its password up (Bitwarden, with the other NBT keys). Commit the
certificate's SHA-256 in `android-release-cert.sha256`. Then:

```sh
NBT_ANDROID_KEYSTORE_PASSWORD=… scripts/build-release.sh 41   # version code = kit sequence
```

The script first builds the installer core with `--release`, so it needs the release
variables above (the manager's `tools/build_windows_kit.py` sets them). It refuses to run
without the keystore or the fingerprint file, and checks the
APK's single signer against the committed fingerprint. Installing a newer APK over an
older one keeps the cars; uninstalling the app deletes its keys, so each car must be
paired again.

## Layout

| Path | Contents |
| --- | --- |
| `src/protocol/` | Signing text, pairing code, reply and package parsers, session, action flows |
| `src/car/` | Native link and signer, the action runner, user-facing messages |
| `src/store/` | Cars (SecureStore), library (app storage), activity |
| `src/screens/`, `src/ui/` | Screens and shared components |
| `modules/device-key/` | P-256 keys in the Android Keystore (Kotlin) |
| `modules/car-link/` | Wi-Fi join, allow-listed HTTP on the car network, file hashing (Kotlin) |
| `modules/car-install/` | The installer core through UniFFI; holds the adapter's Wi-Fi and mobile data (Kotlin) |
| `src/installer/` | Installer session, state, tools and log panels |
| `plugins/withCarApp.ts` | Backup off, network security config, Wi-Fi permissions |
| `scripts/` | Desk car, contract test, installer core, release build |
| `third_party/nbt-apps-manager` | The manager, pinned (protocol, vectors, host worker, installer core) |
