---
name: phone-build
description: Build, test and run the NBT Manager phone app (NBTFoundry/mobile-app) - the checks before a commit, the debug APK and Kotlin tests, a quick JavaScript bundle check, the emulator with the desk car, README screenshots, the signed release APK. Use whenever the phone app must be built, tested or run.
---
<!-- SPDX-License-Identifier: MPL-2.0 -->
# Building and running the phone app

`ANDROID_HOME` is often unset in a fresh shell: take it from the workspace
`CLAUDE.md` ("Values the skills ask for") and export it in the same command
as Gradle or a script that needs it. Yarn 4: `yarn <script>`, never `yarn -s`.

## Checks, in this order

```sh
yarn typecheck && yarn lint && yarn test          # seconds; lint warnings in tests/i18n.test.ts are known
ANDROID_HOME=… ./android/gradlew -p android -q \
  :car-link:testDebugUnitTest :device-key:testDebugUnitTest assembleDebug   # minutes: run in the background
yarn test:contract                                # protocol against the manager's host worker (../manager build)
```

- `android/` is generated (`yarn prebuild`) and `modules/car-install/android/generated/`
  by `yarn installer-core` (Rust, `../installer`); rerun them after a config
  plugin, permission or installer change, not for JavaScript.
- No Android SDK at hand, or only the JavaScript changed: `yarn expo export
  --platform android --output-dir <scratchpad>/export` proves the bundle builds.
- Report phone, car and release-signing checks separately (`AGENTS.md`): Jest
  and the debug APK are not a car test.

## Running it

- Emulator: `yarn emulator` (AVD from `$NBT_AVD`, else the first), then `yarn
  android` installs the dev client; `yarn start` serves Metro on 8082. In T3,
  drive the emulator through the Device panel (`device_list`, `device_open`);
  it needs the SDK's command-line tools, and when they are missing say so
  instead of driving it with `adb`.
- An x86_64 AVD (the usual one) needs an x86_64 build: `NBT_INSTALLER_ABIS="arm64-v8a
  x86_64" yarn installer-core`, then `assembleDebug -PreactNativeArchitectures=x86_64`.
  Then install the APK, `yarn expo start --dev-client --port 8082 --localhost`
  in the background, `adb reverse tcp:8082 tcp:8082`, and enter
  `http://localhost:8082` in the dev launcher.
- Desk car: `yarn desk` (the manager's host worker, `make test` in
  `../manager` first); the emulator reaches it at `10.0.2.2`; commands in its
  terminal: `PHONE OPEN`, `confirm`, `approve`, `pack <app> <version> <sequence>`.
- README screenshots: `python3 scripts/capture_screens.py` (emulator plus desk car;
  it reads the screen with `uiautomator`, which the Device panel's helper holds:
  close the device there first). `--themes <folder>` adds the Apps tab in each theme, for
  the website's slides (`../NBTFoundry.github.io/tools/phone_car.py`).

## Store builds (EAS)

`yarn play`: the Play bundle, submitted by EAS when it finishes and released
to internal testers (`eas.json` submit profile; the service account key is in
EAS's credentials, Submissions slot). `yarn play:closed` releases it to closed
testing instead (track `alpha`, submit profile `closed`; Google reviews each
closed release). Play refuses a version code twice: a build goes to one track,
Play Console's Promote release moves it to another. `npx eas-cli build -p android --profile
preview --non-interactive --no-wait` gives an APK with an install link. Then
`npx eas-cli build:list` or the build page for status and logs; a build alone
goes up with `npx eas-cli submit -p android --profile production --id <build>
--non-interactive`. Commit first: EAS builds the committed tree. A failing
`eas/build-core.sh` shows in the "Run post-install hook" step. `eas/pins.env`
moves with a store release (the installer commit, the manager release and its
SHA-256). Testers and production are the user's, in Play Console.

## Updates between store builds

`yarn ota "What changed"` (channel `production`; `preview` as a second
argument) publishes the committed JavaScript: clean tree, checks, then `eas
update`. It reaches only the builds on the runtime it prints
(`plugins/runtimeVersion.js`; `npx eas-cli build:list` shows each build's). A
native change gives another runtime: release it with `yarn play:closed`
instead. Only when the user asks, like a store build. Phones take an update
when their user asks (More › About), never by themselves (`docs/updates.md`).
Diagnostics: the Expo dashboard's Observe tab, `npx eas-cli observe:metrics-summary`.

## Release APK

Only when the user asks, or through the manager's `manager-kit` skill (it
builds the kit's APK): `NBT_ANDROID_KEYSTORE_PASSWORD=… scripts/build-release.sh
<version-code>`. The keystore lives outside the repository (README, "Release
signing"); never print its password, never commit an APK.
