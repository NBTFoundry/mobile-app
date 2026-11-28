<!-- SPDX-License-Identifier: MPL-2.0 -->
# iOS

Planned, not built: the app's `platforms` is Android only, and nothing here was compiled or
run on iOS.

## Already shared

Screens, texts, stores, the protocol and the action runner are plain TypeScript. The
libraries (camera, updates, analytics, SecureStore, file picker, sharing, Lottie, SVG) have
iOS sides. The one Android call in shared code, the Wi-Fi permission
(`src/car/operations.ts`), is skipped elsewhere.

## To write

The three native modules, in Swift under `modules/<name>/ios/`, each behind the interface
of its `index.ts`, then `"apple"` in its `expo-module.config.json`.

| Module | On iOS |
| --- | --- |
| `device-key` | A P-256 key per car in the Secure Enclave (Keychain, this device only); the public key and signatures in the formats the car already checks |
| `car-link` | Joins the car's Wi-Fi with `NEHotspotConfiguration`; the allow-listed HTTP (`RouteGuard`, `HttpWire`) over connections held on Wi-Fi; hashing, saved logs, the installed version |
| `car-install` | The installer core (`../installer`, Rust) built for iOS with its UniFFI Swift binding; the adapter's Wi-Fi held while mobile data stays up |

Then, in this order: `ios` in `platforms`, a simulator build, a build on an iPhone, a car.

## What each step needs

| Step | Needs |
| --- | --- |
| Compiling anything | A Mac with Xcode, or a cloud build (EAS builds a simulator app without an Apple account) |
| Running the screens | A Mac's simulator: no Secure Enclave (software keys) and no Wi-Fi join |
| Joining the car's Wi-Fi | An iPhone and the Apple Developer Program: the Hotspot Configuration capability is not given to free accounts |
| Testers and the store | The Apple Developer Program: TestFlight, App Store Connect |

## Differences to settle

- No back button on the phone: every page has Back; a swipe from the edge is to add.
- The permission texts (camera, local network) in the seven languages: `locales` in
  `app.config.ts`.
- The QR scanner is the system's, not Google's ML Kit: the privacy page gets an iOS part.
- App Store Connect asks what Play's Data safety form asks (`store/listing.md`), and about
  encryption (the installer core carries SSH): the account owner's answers.
- An application's package picked from Files, a log shared: check both on a device.

## In place

- `app.config.ts`: the `ios` block (bundle identifier `org.nbtfoundry.manager`, the local
  network text, the Hotspot Configuration entitlement), unused until `platforms` names iOS.
- `plugins/runtimeVersion.js`: a runtime version per platform, so that Swift work does not
  cut Android phones off from updates.
- `eas.json`: the `simulator` build profile (`npx eas-cli build -p ios --profile simulator`).
