# NBT Manager — Android app: working rules

Read `README.md` for build and test steps. The wire protocol is defined in
`NBTFoundry/manager: PROTOCOL.md`; read it before changing `src/protocol/` or a
native module. Test fixtures do not establish compatibility with a car.

- Keep private keys, Wi-Fi credentials, request bodies and raw native errors out
  of logs and git. Map native errors to fixed codes. Device private keys stay in
  the Android Keystore; car records stay in SecureStore with backup disabled.
- The phone requests actions and displays results. Approval for pairing,
  installation and removal comes only from the car. Expose no approval route,
  command or button on the phone.
  Exception: Install NBT Manager on a car (the installer core over SSH)
  installs, updates and removes NBT Manager itself as root with no confirmation
  on the car, like the desktop installer. It covers NBT Manager only, never
  applications; it enables SSH only after the user agrees, and Remove asks first.
- Bind car sockets to the selected Android Network and enforce the destination
  and route allow-list natively. Release the screen lock on every outcome. Hold
  the car's network between actions (Android drops it as soon as nothing holds
  it) and release it 2 minutes after the app goes to the background, after 5
  minutes without an action, and when the car is forgotten or another car is
  joined. Serialize signed requests: nonces are single use.
- Keep production files around 300 lines, with cohesive responsibilities. Treat
  packages, Wi-Fi codes, responses and stored data as untrusted, bounded input.
- Run `yarn typecheck`, `yarn lint`, `yarn test`; after prebuild, run
  `./android/gradlew -p android :car-link:testDebugUnitTest :device-key:testDebugUnitTest`
  and a debug APK build. `yarn test:contract` runs against the manager's host
  worker; Jest's fake car is a fixture. Neither is a car test. Report phone, car
  and release-signing checks separately.
- Debug builds may reach a desk car through the workstation (`setDeskIp`); keep
  that path unavailable in release builds.
- Nothing goes to the car by itself, and the app goes online by itself for two
  three things only: its own update (expo-updates: looked for when it opens
  or comes back to the front, downloaded, started the next time; no switch),
  the catalog when it opens, and analytics (Expo Observe; log no car, package
  or file data in them). The last two are on until turned off in More.
  Connecting to the car when the app opens is off until chosen.
  The app's texts say "updates" and "analytics", never Expo.
  The privacy page (NBTFoundry.github.io `site/privacy.html`) and
  `store/listing.md` must say what the app sends: change them with it.
- An update between store builds (`yarn ota`) carries JavaScript only. Native
  changes change `plugins/runtimeVersion.js`'s value by themselves and take a
  store build; never pin the runtime version by hand (`docs/updates.md`).
- Release builds use the dedicated external keystore and must match the
  committed certificate fingerprint. Preserve commit signing.
