<!-- SPDX-License-Identifier: MPL-2.0 -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
    <img src="docs/assets/logo-light.svg" alt="NBTFoundry" height="44">
  </picture>
</p>

<h1 align="center">
  <img src="assets/icon.png" alt="" width="72"><br>
  NBT Manager for Android
</h1>

> **Warning: installing or modifying this software can brick your head unit. Recovery may require professional service or replacement, at your expense. Provided AS IS; use at your own risk, subject to applicable law.** [Read the risk and liability disclaimer](DISCLAIMER.md).

<p align="center">
  <b>Your car's applications, from your phone.</b><br>
  Pair once, then install, update and configure; the driver approves on the car.
</p>

<p align="center">
  <img src="docs/assets/mobile-apps.png" width="600"
       alt="The Apps tab in light and dark: updates first, then the applications on the car, then more to get">
</p>

The phone side of NBT Manager. Pair once per car, then install, update and
uninstall applications on the car's head unit, change their settings and send
them files (an application that takes files, such as games for an emulator) from
the phone. Every install and uninstall is confirmed by the driver on the car;
the phone never approves anything; files are data and go without a prompt, and
the phone asks before it deletes one. **Apps** lists every application once, with its
next step: download a signed release from the [NBTFoundry catalog](https://nbtfoundry.github.io),
install it, update it; picking a local file still works (More › Downloads). On a car
without NBT Manager, **Install NBT Manager on a car** installs it over a Wi-Fi ENET adapter.

Expo SDK 58, React Native 0.88, Android 10 and later, application id
`org.nbtfoundry.manager`. In English, French, German, Italian, Spanish, Chinese and
Japanese, following the phone's language (English for any other); More › Language
chooses one ([docs/ui.md](docs/ui.md)). Small updates reach the app between store builds,
when its user asks; diagnostics are sent only after its user agreed
([docs/updates.md](docs/updates.md)).

**Supported head units:** BMW NBT Evo (iDrive 6). Support for the earlier NBT
may come later.

Part of [NBTFoundry](https://github.com/NBTFoundry):
[manager](https://github.com/NBTFoundry/manager) (runs on the car) ·
[installer](https://github.com/NBTFoundry/installer) (desktop installer, shares its core) ·
[sdk](https://github.com/NBTFoundry/sdk) (application SDK) ·
[nf-doom](https://github.com/NBTFoundry/nf-doom) (example application)

Not affiliated with or endorsed by BMW AG or BlackBerry Limited. BMW, iDrive and
NBT are trademarks of BMW AG; QNX is a trademark of BlackBerry Limited.

## In use

<table>
  <tr>
    <td width="20%" align="center"><img src="docs/assets/mobile-install.webp" alt="Installing media-player: the request, the car's approval, then the Apps tab lists it"><br>
      <sub>Install: requested on the phone, approved on the car</sub></td>
    <td width="20%" align="center"><img src="docs/assets/mobile-app.png" alt="Doom's page: the version on the car, the update to download, and rows for settings, files, about and troubleshooting"><br>
      <sub>An application: its next step, the rest behind rows</sub></td>
    <td width="20%" align="center"><img src="docs/assets/mobile-car.png" alt="The Car tab: the link to the car, NBT Manager, health and tools"><br>
      <sub>Car: link, health, tools</sub></td>
    <td width="20%" align="center"><img src="docs/assets/mobile-more.png" alt="More: language, appearance, theme, betas, diagnostics and what the app does when it opens"><br>
      <sub>More: settings and About</sub></td>
    <td width="20%" align="center"><img src="docs/assets/mobile-pairing.png" alt="Pairing: the six digits to compare with the car"><br>
      <sub>Pairing: the same six digits on phone and car</sub></td>
  </tr>
</table>

Captured from the debug build on an emulator against the desk car (below), with
synthetic packages and the live catalog: `python3 scripts/capture_screens.py`.

## How it works

The phone talks to the car's NBT Manager over the car's Wi-Fi with the paired-phone
HTTP protocol defined in `NBTFoundry/manager: PROTOCOL.md`. Each request is signed
with a P-256 key that never leaves the Android Keystore; the car checks the
signature and asks the driver to approve installs and uninstalls on the iDrive
screen. When another app is already on the car's Wi-Fi (wireless Android Auto,
on the Wi-Fi Direct group or the CarPlay hotspot), the phone uses that
connection and the car's address on it instead of joining again
(`NBTFoundry/manager: docs/android-auto-wifi.md`).

```mermaid
sequenceDiagram
  participant D as Driver (iDrive)
  participant C as NBT Manager (car)
  participant P as Phone app
  D->>C: Settings → Pair a phone (60-second window)
  C->>D: Wi-Fi QR code
  P->>C: scan the code, join the car's Wi-Fi
  P->>C: POST /v1/pair, signed with the new Keystore key
  C-->>P: PAIR pending + six digits
  C->>D: phone name + the same six digits
  D->>C: confirm
  P->>C: GET /v1/status
  C-->>P: paired (car identity and address)
  P->>C: POST /v1/upload (signed .nbt package)
  C->>C: verify signature, compatibility, sequence
  C->>D: review and confirm the install
  D->>C: confirm
  P->>C: GET /v1/status
  C-->>P: installing … installed
```

The **manager installer** is the exception to car-side approval: it installs,
updates and removes NBT Manager itself over SSH through a Wi-Fi ENET adapter,
using the Rust installer core from `NBTFoundry/installer` (`mobile/`, through
UniFFI). It enables SSH on the head unit only after the user agrees, and asks
before removing.

### Pairing from another app

An app that has the car's Wi-Fi code (the `WIFI:` text of the car's QR code)
hands it over with a link; the phone app opens pairing with it, and the user
still taps Pair and the driver confirms on the car:

```kotlin
startActivity(Intent(Intent.ACTION_VIEW,
    Uri.parse("nbtmanager://pair?wifi=" + Uri.encode(wifiCode))))
```

## Setup

Node 24 with `corepack enable` (Yarn 4), JDK 17, Android SDK 36 (`ANDROID_HOME` set)
with an NDK, and Rust with `cargo install cargo-ndk` and
`rustup target add aarch64-linux-android`. Check out `NBTFoundry/installer` and
`NBTFoundry/manager` next to this repository, then:

```sh
yarn install --immutable
yarn installer-core    # the installer core (Rust) and its Kotlin binding
yarn prebuild          # generates android/ (not committed)
```

`yarn installer-core` (`scripts/build-installer-core.sh`) builds
`libnbt_installer.so` from `../installer` (or `$NBT_INSTALLER_SOURCE`) and generates
its UniFFI binding, both into `modules/car-install/android/generated/` (not
committed). A development build has no manager release inside, so Install and
Update are unavailable there; `--release` embeds one (`NBT_MANAGER_RELEASE`,
`NBT_MANAGER_PUBLIC_KEY`, which the manager's kit build sets). For the x86_64
emulator: `NBT_INSTALLER_ABIS="arm64-v8a x86_64" yarn installer-core`, and build
with `-PreactNativeArchitectures=x86_64`.

## Develop

Two kinds of build:

- **Dev client** for UI work: a debug build that loads JavaScript from Metro over
  the LAN. Install it once (`yarn android`); reinstall only after native changes
  (modules, config plugin, permissions). `yarn start` serves Metro on port 8082.
- **Release build** for the car (see below). Joining the car's Wi-Fi can take the
  phone off the LAN, which stops Metro.

**Emulator:** `yarn emulator` starts the first AVD (or `$NBT_AVD`) and waits for it
to boot; `yarn android:emulator` also builds and installs the dev client. The
emulator reaches the workstation at `10.0.2.2`.

**Desk car:** the manager's host worker and door running on the workstation, with
the car-side decisions typed in its terminal. It needs `managerd-test` from the
manager's host build (`make test` in `../manager`).

```sh
yarn desk --lan <workstation-address>       # NBT_MANAGER_DIR=../manager by default
```

If port 8080 is taken, add `--port 18080 --door-port 18081` (the door is always the
worker's port + 1) and enter `address:18080` in the app. In a debug build, Cars
shows *Pair the desk car*. Debug builds map the worker's loopback listener to that
address; release builds reach only `172.16.222.1` and `172.16.224.1`. In the desk
car's terminal: `PHONE OPEN` before pairing, then `confirm`, `decline`, `approve`,
`reject`, or `pack <app> <version> <sequence> [setting]` to make a signed test
package to add to the library.

## Test

```sh
yarn typecheck && yarn lint && yarn test
yarn test:contract
./android/gradlew -p android :car-link:testDebugUnitTest :device-key:testDebugUnitTest :app:assembleDebug
```

- Jest checks the protocol against the manager's signing vectors
  (`tests/fixtures/phone-signing-vectors.tsv`) and a fake car.
- `yarn test:contract` runs the TypeScript protocol with a software key over Node
  sockets against the real host worker and door (`scripts/host_car.py`,
  `NBT_MANAGER_BUILD` defaults to `../manager/build`).
- The Kotlin unit tests cover the route allow-list, the exact HTTP the car's parser
  accepts, reply bounds and the signing-text guard. The Keystore, Wi-Fi joining and
  socket binding need a phone.
- The installer's state is tested in Jest (`tests/installer.test.ts`); its Rust
  core in `NBTFoundry/installer` (`cargo test --workspace`).

## Release signing

Release builds use a dedicated keystore outside the repository, never the debug
key:

```sh
mkdir -p ~/.local/share/nbt-manager/keys/android && cd ~/.local/share/nbt-manager/keys/android
keytool -genkeypair -keystore nbt-manager-release.jks -alias nbt-manager -keyalg EC \
  -groupname secp256r1 -validity 10000 -dname "CN=NBT Manager"
chmod 600 nbt-manager-release.jks
keytool -list -v -keystore nbt-manager-release.jks -alias nbt-manager | grep SHA256
```

Keep a backup of the keystore and its password: an APK signed with another key
cannot update the installed app. Commit the certificate's SHA-256 in
`android-release-cert.sha256`. Then:

```sh
NBT_ANDROID_KEYSTORE_PASSWORD=… scripts/build-release.sh <version-code>
```

The script builds the installer core with `--release` first, so it needs the
release variables above (the manager's `tools/build_windows_kit.py` sets them,
with the kit's sequence as the version code). It refuses to run without the
keystore or the fingerprint file, and checks the APK's single signer against the
committed fingerprint. Installing a newer APK over an older one keeps the paired
cars; uninstalling the app deletes its keys, so each car must be paired again.

## Store builds (EAS)

Google Play builds run on Expo's servers (project `@nbtfoundry/manager`, `eas.json`):

```sh
yarn play                                         # Play bundle, released to internal testers once built
yarn play:closed                                  # the same, released to closed testing (Google reviews it)
npx eas-cli build -p android --profile preview    # an APK with an install link
```

`yarn play` submits the build when it finishes, with the Play service account key held
in EAS's credentials. A version code goes to one track; Play Console's Promote release
moves it to another, and to production. Anyone can join closed testing:
[nbtfoundry.github.io/beta.html](https://nbtfoundry.github.io/beta.html).

The cloud build builds the installer core itself (`eas/build-core.sh`, run as
`eas-build-post-install`) from the pins in `eas/pins.env`: the installer commit and
the public NBT Manager release it embeds, checked against `eas/manager-public.pem`.
Play signs the app with its own key; EAS holds only the upload key. Version codes
are EAS's, from 1000; kit APKs keep their own key and the kit sequence, so a phone
moves between a store build and a kit APK only by uninstalling (and pairing again).

Between store builds, `yarn ota "What changed"` publishes the committed JavaScript as an
update for the builds whose native side it matches; phones take it when their user asks.
A native change takes a store build ([docs/updates.md](docs/updates.md)).

## Layout

| Path | Contents |
| --- | --- |
| `src/protocol/` | Signing text, pairing code, reply and package parsers, session, action flows |
| `src/car/` | Native link and signer, the action runner, user-facing messages |
| `src/route.ts` | Where the app is: tab, page, application, section |
| `src/store/` | Cars (SecureStore), downloaded packages (app storage), online catalog, the merged application list, preferences, activity, the app's own update, diagnostics |
| `src/screens/`, `src/ui/` | Screens and shared components, icons, animations ([docs/ui.md](docs/ui.md)) |
| `src/i18n/` | The texts in each language, the language shown and its detection |
| `src/installer/` | Manager installer session, state, tools and log panels |
| `modules/device-key/` | P-256 keys in the Android Keystore (Kotlin) |
| `modules/car-link/` | Wi-Fi join, allow-listed HTTP on the car network, file hashing (Kotlin) |
| `modules/car-install/` | The installer core through UniFFI; holds the adapter's Wi-Fi and mobile data (Kotlin) |
| `plugins/` | `withCarApp.js`: backup off, network security config, Wi-Fi permissions; `runtimeVersion.js`: which builds an update reaches |
| `scripts/` | Desk car, contract test, installer core, release build, README captures, application icons, Lottie animations, publishing an update |

## License

Copyright (c) 2026 Fabien Poussin. Original code, tests, build scripts and documentation are licensed under **MPL-2.0**; see [LICENSE](LICENSE).

Original NBTFoundry logos, artwork and screenshots are under **MPL-2.0**, including copies in other NBTFoundry repositories. Third-party code, fonts, game data and their notices retain their own terms. Copyright permission for artwork does not grant trademark rights or imply endorsement by BMW AG or id Software.

See [legal/README.md](legal/README.md) for third-party license notices.
