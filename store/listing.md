<!-- SPDX-License-Identifier: MPL-2.0 -->
# Google Play listing

Paste into Play Console. Graphics: `icon-512.png` (the app's icon), `feature-graphic.png`
(1024×500); phone screenshots (1080×1920, in order): `screenshots/1-apps.png` to
`7-light-dark.png`, captioned captures of the emulator against the desk car.

## Main store listing

**App name** (30): NBT Manager

**Short description** (80):
Apps for BMW, MINI and Supra iDrive 6 screens, installed from your phone.

**Full description:**

NBT Manager puts new apps on the iDrive 6 screen of a BMW, a MINI or a Toyota GR Supra: Android Auto, live engine gauges, classic games and emulators. This app is the phone side. It installs, updates and manages them over the car's Wi-Fi.

• Pair once, with a code shown on the car's screen.
• One list of apps: what your car runs, what has an update, and what you can add from the NBTFoundry catalog. Or add a package file yourself.
• Install, update and remove them over the car's Wi-Fi. The car checks every package's signature and you confirm each install on iDrive. A bad update rolls back by itself.
• Change an application's settings while it runs, send it files such as games you own, read logs and crash reports.
• Your car's look: the app takes the BMW, MINI or Supra theme of the car you select, in light or dark, or the one you choose.
• First install: put NBT Manager on a car over a Wi-Fi ENET adapter.
• English, French, German, Italian, Spanish, Chinese and Japanese.

Requires a car with a BMW NBT Evo head unit (iDrive 6, the home screen of large tiles). Not tested on a Supra yet. No account, no ads. Diagnostics are shared only if you agree.

Warning: installing or modifying head-unit software can brick your head unit. Recovery may require professional service or replacement, at your expense. Provided as is; use at your own risk. Use applications only while parked.

Open source (MPL-2.0): https://github.com/NBTFoundry

NBTFoundry is not affiliated with or endorsed by BMW AG, Toyota Motor Corporation or Google LLC. BMW, MINI, iDrive and NBT are trademarks of BMW AG; Toyota and Supra of Toyota Motor Corporation; Android and Android Auto of Google LLC.

## Store settings

- App or game: App. Category: Auto & Vehicles. Free.
- Contact email: the developer account's. Website: https://nbtfoundry.github.io
- Privacy policy: https://nbtfoundry.github.io/privacy.html

## App content

- **Ads:** no.
- **App access:** "All functionality requires a car with a BMW NBT Evo head unit running NBT Manager; pairing needs the code shown on the car's screen. Without a car, Apps, More › Downloads and the settings can be opened: Apps downloads signed packages into Downloads. The packages are programs for the car's head unit (QNX); the phone stores and forwards them and never executes them."
- **Data safety** (changed with 0.2.0: app updates and optional diagnostics through Expo):
  collects data: yes. Encrypted in transit: yes. Deletion request: no.
  - App info and performance → Crash logs: collected, not shared, optional (Share diagnostics,
    off by default), purpose Analytics.
  - App info and performance → Diagnostics: collected, not shared, purpose Analytics. Required
    for Google's ML Kit (the QR scanner sends device information); the app's own start-up
    times are optional.
  - Device or other IDs: collected, not shared, purpose Analytics and App functionality: a
    random id of the installation, sent to Expo with an app update check and with diagnostics.
- **Advertising ID:** no.
- **Target audience:** 18 and over.
- **Content rating:** utility; no user-generated content, no sharing of location, no purchases.
- **News, health, financial, government:** no.
