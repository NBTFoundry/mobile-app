# NBT Manager mobile

Read `HANDOVER.md` for milestone status and `README.md` for local build and test steps.
The authoritative wire protocol is the manager repository's
[`PROTOCOL.md`](third_party/nbt-apps-manager/PROTOCOL.md). Read it before changing
`src/protocol/` or either native module. Milestone 1 is a prerequisite for the
mobile protocol implementation; fixtures do not establish compatibility with the car.

- Keep private keys, Wi-Fi credentials, request bodies and raw native errors out
  of logs and git. Map native errors to fixed codes. Device private keys stay in
  Android Keystore; car records stay in SecureStore with backup disabled.
- The phone requests actions and displays results. Approval for pairing,
  installation and removal comes exclusively from the car. Expose no approval
  route, command or button on the phone.
  Exception: Install NBT Manager on a car (the manager's installer core over
  SSH) installs, updates and removes NBT Manager itself as root with no
  confirmation on the car, like the Windows installer. It covers NBT Manager
  only, never applications; it enables SSH only after the user agrees, and
  Remove asks first.
- Bind car sockets to the selected Android Network and enforce the destination
  and route allow-list natively. Release the screen lock on every outcome. Hold the
  car's network between actions (Android drops it as soon as nothing holds it) and
  release it 2 minutes after the app goes to the background (switching apps to
  save a log must not cut the link), after 5 minutes without an action, and
  when the car is forgotten or another car is joined. Serialize signed
  requests: nonces are single use.
- Keep production files around 300 lines, with cohesive responsibilities. Treat
  packages, Wi-Fi codes, responses and stored data as untrusted, bounded input.
- Run `yarn typecheck`, `yarn lint`, `yarn test`; after prebuild, run
  `./android/gradlew -p android :car-link:testDebugUnitTest :device-key:testDebugUnitTest`
  and a debug APK build. `yarn test:contract` runs against the host worker
  (`NBT_MANAGER_BUILD`); Jest's fake car is a fixture. Neither is a car test.
  Report phone, car and release-signing checks separately.
- Debug builds may reach a desk car through the workstation (`setDeskIp`); keep
  that path unavailable in release builds.
- Use local builds. Release builds must use the dedicated external keystore and
  match the committed certificate fingerprint. Commit each completed step and
  update the handover before pausing at a milestone. Preserve commit signing.
