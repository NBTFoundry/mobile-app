<!-- SPDX-License-Identifier: MPL-2.0 -->
# Updates between store builds, and analytics

## App updates (expo-updates)

A store build carries its JavaScript. An update replaces that JavaScript (screens,
texts, logic) without a new store build; it cannot change the native side.

| What | Where |
| --- | --- |
| Which builds an update reaches | `plugins/runtimeVersion.js`: the app version and a hash of the native side (native dependencies, `modules/*/android`, `plugins/`, `assets/`, `app.config.ts`, the installer core's pins) |
| Channels | `eas.json`: `production` (Play builds), `preview` (the preview APK) |
| When a phone looks | By itself, with no switch: when the app opens, and when it comes back to the front an hour or more after the last look (`followAppUpdates`, from JavaScript: `checkAutomatically` stays `NEVER`). Also More › About › Check for an app update, and with Apps › Check for new versions |
| What it does | Downloads the update in the background, then says so in a bar over the tabs (`UpdateBar`) and with a dot on More |
| When it starts | The next time the app opens, or at once with Restart in the bar or in About |
| Kit and debug builds | No updates (`NBT_UPDATES=0` in `scripts/build-release.sh`): they run the code they were built from |

Publishing, from a clean commit on `main`:

```sh
yarn ota "What changed"            # channel production
yarn ota "What changed" preview
```

- The script prints the runtime. `npx eas-cli build:list` shows each build's: an update on
  another runtime reaches nobody, which is what a native change must do. Then it takes a
  store build (`yarn play`).
- An update that fails to start is dropped by the phone, which goes back to the one before.
- Updates are served by Expo over HTTPS and are not signed with a key of ours.
- Each check sends Expo the runtime, the channel and a random id of the installation
  (`EAS-Client-ID`); the privacy page says so.

## Analytics (Expo Observe)

Start-up times, unhandled errors and crashes, sent to Expo with the same installation id.

- On from the first launch (`consent: 'granted'`, `app.config.ts`); More › Settings ›
  Analytics turns them off (`src/store/diagnostics.ts`), which also deletes what was not
  sent. "What's new" and the privacy page say so.
- Nothing about the car, packages or files is logged: no custom events, no network traces.
- Read them in the Expo dashboard's Observe tab, or `npx eas-cli observe:metrics-summary`.
- The app's own texts never name Expo: users see "updates" and "analytics".
- Source maps go up with store builds (`uploadSourceMaps`) and with `yarn ota`.
