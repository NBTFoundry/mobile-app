# NBT Manager app handover

## Current state (2026-11-19, kit dev117)

- The app's own last changes are the user's (`2c9c268` navigation, layouts and
  system themes; `4cae591` NBTRLS2 manager releases; `e4df178` host contract
  verification). Since then the restart wording (`dc47ecd`: "Restart the head
  unit", asked first; appreset restarts the whole system), **Collect
  everything** (`ec0f868`) and the manager submodule, now at `78da22b`.
- Use kit dev117 (versionCode 117, on the NAS, made with the manager's
  `make kit`); dev116 and older are superseded, dev91 to dev107 are not to be
  installed. Kits carry one release: from the manager page send
  `NBT-Manager-dev117.nbtr`, then Doom 1.0.18 (`doom-1.0.18.nbt`, needs
  dev111 or later; its volume is its own Options menu, no manager setting). A manager older than
  NBTRLS2 takes it only over SSH: the app's installer (or Windows) Update now
  stages with the release's own launcher, and Install covers a car without
  NBT Manager (no app code changed for either; the shared Rust core did). The
  car ran dev111 (the shim blocked, the PS4 pad worked; dev113 fixes a stale
  BACK escape and the Xbox pad's discovery). Not verified on a phone.
- dev111's capture shim blocks: while the manager or an application is shown,
  iDrive gets none of the knob, the controller keys or the favourite keys;
  volume still works (the manager's `docs/input-capture.md` section 6).
  Applications get the controller from the manager (bridge 1.4, capability
  `controller`, the manager's `docs/app-bridge.md` section 8). No app code
  changed for either.
- From the phone the capture shim loads at iDrive's next start, armed by the
  manager and kept after 60 s of running (the manager's `docs/hmi-restart.md`).
  The app's installer tools (`desktop/mobile/src/lib.rs`, `Tool`, generated
  Kotlin bindings) lack the Windows installer's **Shim on** and **Shim off**;
  not requested yet.
- New in dev117, manager only: the manager's Settings > **Status** and its
  gamepad test, on the car's screen. No app change.
- New in dev117: More tools > **Collect everything** (tool `collectAll`,
  event `log` with `kind: 'collection'`; the `log` event's `system` flag is
  now `kind`: `debug`, `system` or `collection`). One read-only text report
  over SSH (the manager's `desktop/core/src/collect.rs`), shared like the
  logs. Checked with tsc, eslint and jest (86) and a host-generated binding;
  the dev117 APK compiled it. Not run on a phone.

## 2026-11-18: manager at 3b9b346; kit dev105 (dev103 skipped)

No app code changed. The manager keeps the capture shim next to iDrive's
environment file (`/var/opt/nbt-manager/state/manager/`), and the Windows
installer's Update tries the shim at once while connected. The app's
installer has no immediate trial: from the phone the shim loads at the next
start of iDrive. Kit dev105 carries this app as versionCode 105, on the NAS;
dev103 is not to be installed. From the phone on a dev89 car:
`NBT-Manager-dev104.nbtr`, then `NBT-Manager-dev105.nbtr`. Not verified on a
phone or in the car.

## 2026-11-18: manager at 6829de6; kit dev103 (dev101 skipped)

No app code changed. The manager now tests and keeps the capture shim by
itself (armed for one start at a time, kept after 60 s of running). The
manual tools (`--try-shim`, `--shim on|off`) are in the Windows installer's
Test tools only, not in the app's installer tool list. Kit dev103 carries
this app as versionCode 103, on the NAS; dev101 is not to be installed. From
the phone on a dev89 car: `NBT-Manager-dev102.nbtr`, then
`NBT-Manager-dev103.nbtr`. Not verified on a phone or in the car.

## 2026-11-18: manager at 4fc2e3a; kit dev101 (dev99 skipped)

No app code changed. The manager now loads the capture shim through iDrive's
environment file, one start at a time: `--try-shim` and `--keep-shim on|off`
are in the Windows installer's Test tools only; the app's installer tool list
(`desktop/mobile`, generated Kotlin bindings) does not have them. Kit dev101
carries this app as versionCode 101, on the NAS; dev99 is not to be
installed. From the phone on a dev89 car: `NBT-Manager-dev100.nbtr`, then
`NBT-Manager-dev101.nbtr`. Not verified on a phone or in the car.

## 2026-11-18: manager at 7fc5bec; kit dev99 (dev97 skipped)

No app code changed. The manager's launcher gains `--restart-hmi` (iDrive
alone, experimental); only the Windows installer offers it so far: the app's
installer tool list (`desktop/mobile`, generated Kotlin bindings) does not
have it yet. Kit dev99 carries this app as versionCode 99, on the NAS; dev91
to dev97 are not to be installed. From the phone on a dev89 car:
`NBT-Manager-dev98.nbtr`, then `NBT-Manager-dev99.nbtr`. Not verified on a
phone or in the car.

## 2026-11-18: manager at aa97041; kit dev97 (dev95 skipped)

No app code changed. The manager now tests the capture shim's behaviour live
during the install. Kit dev97 carries this app as versionCode 97, on the NAS;
dev91, dev93 and dev95 are not to be installed. From the phone on a dev89
car: `NBT-Manager-dev96.nbtr`, then `NBT-Manager-dev97.nbtr`. Not verified on
a phone or in the car.

## 2026-11-18: manager at 1053bf4; kit dev95 (dev93 skipped)

No app code changed. The manager's shim load test now runs in iDrive's
environment and preload order. Kit dev95 carries this app as versionCode 95,
on the NAS; dev91 and dev93 are not to be installed. From the phone on a
dev89 car: `NBT-Manager-dev94.nbtr`, then `NBT-Manager-dev95.nbtr`. Not
verified on a phone or in the car.

## 2026-11-18: manager at 2c9a785; kit dev93 (dev91 skipped)

No app code changed. The manager now test-loads the capture shim before
iDrive's `starter.cfg` names it; dev91 is not to be installed. Kit dev93
carries this app as versionCode 93, on the NAS. Updating from the phone takes
two sends on a dev89 car: `NBT-Manager-dev92.nbtr`, then
`NBT-Manager-dev93.nbtr`. Not verified on a phone or in the car.

## 2026-11-18: manager at 6dcec3a; kit dev91

No app code changed. The manager submodule moves to `6dcec3a`: the gamepad
fix (every silent stop logged, the car's `libusbdi.so.2` loaded) and the dev91
kit record. Kit dev91 carries this app (UI refinement below) as versionCode
91, on the NAS. Not verified on a phone or in the car.

## 2026-11-18: UI refinement

The app now has Car, Library and Activity tabs. Car combines car selection and
applications, with cached data on launch and an explicit connection on selection,
Connect, Refresh or an action. Context menus group logs and car/app maintenance.
Application details give the newest eligible package one primary action, with
settings choices and file details in dialogs. Equal and older application
packages are informational. Pairing and the SSH installer have header Back
navigation, pending-only pairing digits and one restart control.

Shared light/dark colors follow Android's appearance, including logs, inputs,
activity states and dialogs. Added expo-system-ui 58.0.7 and changed
userInterfaceStyle to automatic: rebuild the native client after pulling.
Touch targets are at least 48 dp and text wraps. See
[design decisions and references](docs/ui-refinement.md).

Delayed car results retain their target ID. Serialized storage merges application
lists into the latest car, preserving renames and preventing a forgotten pairing
from returning. Pending network releases take effect after the current action.
The signed request queue and existing network hold delays remain in effect.

Verified locally:

- `yarn typecheck`, `yarn lint`, `yarn test`: 8 suites, 86 tests pass. Four new
  storage regressions cover concurrent pairing writes, rename/read ordering and
  a read arriving after Forget.
- Local Android prebuild, 12 car-link/device-key unit tests and x86_64 debug APK
  build pass. Generated Android files stay ignored.
- Disposable API 36 emulator: first use, live light/dark switch, 320 dp width,
  150% text, long car name, name editing with the keyboard, Back and dialogs.
- Desk fixture: pairing, signed package imports, app install, settings choice,
  update request/failure, declined uninstall, application logs and sharing/clear.
  The synthetic update failed on the host and restored v1; Activity displayed the
  failure and the cached list retained v1. This does not establish car updates.
- `yarn test:contract`: all checks pass against the host worker and door,
  including system-log retrieval, application-log clearing, wake, declined and
  confirmed uninstall, and rejection after the car forgets the phone. Rerun with
  `NBT_MANAGER_BUILD=/home/mobyfab/src/reverse/nbt-apps-manager/build` after /tmp
  space was freed. The earlier `503 system-log` was traced to EDQUOT while the
  fixture wrote its hard-coded /tmp file and is resolved.

Phone: no physical-phone, real-camera or Wi-Fi-joining checks in this pass.
Car: no head-unit or SSH-installer checks. All runtime actions above use the host
fixture. Release: no release APK build or release-signing validation in this pass.
Screenshots/build logs are ignored local artifacts in build/ui-review-tmp/.

## 2026-11-18: input capture review fixes — manager only

No app change. The manager's input capture review fixed three risks: a hung
manager now gives iDrive its controller back within 1.5 s during installs
too; Remove works on a car whose launcher predates NBTRLS2; a lost
`starter.cfg` backup is rebuilt instead of blocking install and removal. The
installer core's Remove command changed (`desktop/core/src/bench.rs`), so the
phone's Remove follows it once the library is rebuilt. See the manager's
handover. Submodule at `2379c5f`.

## 2026-11-17: kit dev89 — manager only

No app change. dev88 (built, not published) and dev89 on the car: an
application is paused when iDrive takes the screen from it, resumed when
selected again in App Manager, stopped after 2 minutes paused; iDrive is held
again at once after BACK; the controller messages before iDrive takes over
are logged. See the manager's handover. APK versionCode 89.

## 2026-11-17: kit dev87 — manager only

No app change. The manager's iDrive plugin sends its focus events from a
thread of its own, and when iDrive does not answer one within 3 s it drops
the hold and logs a snapshot of iDrive's threads. This is a mitigation for
the freeze when App Manager opens, not a proven fix. See the manager's
handover, dev87. APK versionCode 87. Submodule at `667431a`.

## 2026-11-17: kit dev81 — manager only

No app change. The manager no longer restarts its window in a loop when
iDrive's LayerManager does not answer (dev79 froze iDrive about 30 s after a
boot), and gives applications the media libraries' path (Doom's sound). See
the manager's handover, dev81. APK versionCode 81, same code as dev80.
Submodule at the manager's dev81 handover (`06223ff`).

## 2026-11-17: kit dev80 — the car's network survives switching apps

dev79 on the phone: app logs and the Manager log work. Switching to another
app to save a log released the car's Wi-Fi at once (the app let go of it on
going to the background). The user asked for up to 2 minutes.

`e8bd018`:

- In the background the network is now let go after 2 minutes
  (`src/car/networkHold.ts`, `BACKGROUND_RELEASE_MS`).
- Coming back sooner keeps it, with the 5-minute idle delay again; coming
  back later lets it go at once.
- An action that ends in the background keeps what is left of the 2 minutes.
- If Android pauses the app in the background, the timer runs late and the
  release happens when it resumes. Not established on a phone.
- `AGENTS.md`'s rule says 2 minutes now.

Verified: typecheck, lint, 81 Jest tests (3 new for the delays). Not verified
on a phone. APK versionCode 80. Submodule at the manager's dev80 handover.

## 2026-11-17: kit dev79 — "The car is checking the package."

From dev79 the car verifies an upload on its worker's job thread (manager
handover, dev79). `/v1/upload` answers 202 `STATUS waiting` "Checking the
package", and the result comes through `/v1/status`, which the app already
follows. A forged package or one that is not newer now fails through status,
not HTTP 400. The app handles both cases unchanged. While the car checks, it
now says "The car is checking the package." instead of "Confirm on the car."
(`087b7d4`). Verified: typecheck, lint, 78 Jest tests, and the string is in
the kit's APK bundle. Not verified on a phone. APK versionCode 79. Submodule
at the manager's dev79 handover.

## 2026-11-16: kit dev76 (no app change)

The car could not open application logs, so Show log read "No log yet." dev76
writes them even when the manager's checked open fails (manager handover,
dev76). Nothing changed in the app; APK versionCode 76 carries `571e501`.

## 2026-11-16: kit dev75 (no app change)

dev74 on the phone: Manager log works. App logs read "No log yet." because
the car cannot open them (`application log open failed (errno 89)`, cause
not established; manager handover, dev75, logs which call fails). Nothing
changed in the app; APK versionCode 75 carries `571e501`.

## 2026-11-16: kit dev74 — Manager log on the car's page

The user tests with the phone only. The car's page has **Manager log** beside
**iDrive log** (`571e501`): NBT Manager's debug log over the paired link
(`POST /v1/logs/manager`), shown and shared like the iDrive log. An empty
reply says to turn on Debug log in App Manager's settings. Verified: typecheck,
lint, 78 Jest tests, car-link and device-key unit tests; the kit's APK bundle
holds the route. Not verified on a phone. APK versionCode 74 (install it).
Submodule at the manager's dev74 handover.

**Next:** with Debug log on, start Doom, then share Doom's log and the Manager
log; the manager log says why Doom's own log reads empty.

## 2026-11-16: kit dev73 (no app change)

dev71 in the car: applications start again, and the manager was updated from
the app. Sending the installed test app again failed with no clear reason;
the car now refuses it on arrival and the app shows "The car reported a
failure. Package rejected: version X is not newer than the installed Y."
Doom's crash left the panel black; the manager now comes back (manager
handover, dev73). Nothing changed in the app; APK versionCode 73 carries
`633b64f`. Submodule at the manager's `c032a2e`.

**Next:** with dev73, Doom → Show log → Share, for Doom's own crash line.

## 2026-11-16: kit dev71 (no app change)

dev70: pairing works; no application started on the car (QNX 6.5's `fork()`
returns ENOSYS in the manager's threaded processes; verified). dev71 starts them with `spawn()`
(manager handover, dev71). Nothing changed in the app; APK versionCode 71
carries `633b64f`. Submodule at the manager's `eeb574b`.

**Next:** with dev71, start applications on the car and from the app.

Updating NBT Manager from the app (Library, then NBT Manager, then Send to
the car; the kit's `phone/NBT-Manager-<version>.nbtr`) works in the car: the
user used it with earlier kits (reported 2026-11-16).

## 2026-11-16: kit dev70 (no app change)

dev69 showed why the phone could not join: the passphrase the car reports over
MOST is not the group's; the manager now gives `WFDPass.conf`'s (manager
handover, dev70). Nothing changed in the app; APK versionCode 70 carries
`633b64f`. Submodule at the manager's `b081734`.

**dev70 in the car:** pairing works (the user's report). No application
starts on the car: under investigation in the manager.

## 2026-11-16: kit dev69 (no app change)

dev67 in the car: the car showed the Wi-Fi code, but the app said "Could not
join the car's Wi-Fi". The car logged the phone associating and dropping 4 to
8 s later, five times; a wrong passphrase or no DHCP on the car's group are
the suspects. dev69's manager logs which (manager handover, dev69). Nothing
changed in the app; APK versionCode 69 carries `633b64f`. Submodule at the
manager's `0b27104`.

Android Auto: the app joins with a `WifiNetworkSpecifier`. On Android 12 and
later, Android shares one connection to the same network between the app and
Android Auto, so the app does not disturb Android Auto on the car's Wi-Fi
Direct group. A join while Android Auto uses the CarPlay hotspot takes the
phone's Wi-Fi from Android Auto until the app releases it. Details in the
manager's `docs/android-auto-wifi.md`.

**Next:** pair with dev69 and send the car's debug log.

## 2026-11-16: kit dev67 (no app change)

dev66 in the car: Pair a phone on the car said there was no Wi-Fi, so there
was no code to scan. The car's Wi-Fi Direct group came up, but the manager
misread the car's answer and switched the group off after 10 s (manager
handover, dev67, `227e4df`). Nothing changed in the app; APK versionCode 67
carries `633b64f`. Submodule at the manager's `d14b2c5`.

**Next:** with dev67, Pair a phone should show the Wi-Fi code within a few
seconds; then pair from the app.

## 2026-11-16: kit dev66 (no app change)

The manager's GUI and its Wi-Fi Direct preparation now run their slow work on
their own threads, and its window is paced to 30 fps (manager handover,
dev66). Nothing changed in the app; APK versionCode 66 carries `633b64f`.
Submodule at the manager's `621d41b`.

**Next:** pair with dev66; the scan should show its activity at once, and Pair
a phone should no longer close App Manager.

## 2026-11-16: pairing goes first (`633b64f`, in every APK since dev60)

The user, after iDrive reset itself to factory settings: "You broke app
pairing". The camera saw the car's code and nothing happened. Cause (from the
code; no phone log): every car action waits in one queue, and the pairing's
activity was only created once its turn came. Actions for the saved car could
each spend up to 2 minutes joining Wi-Fi details the reset had likely
changed, longer than the car's 60 s pairing window. Also, releasing a join
still waiting for Android left it waiting forever.

**Built:** `src/car/queue.ts` (one action at a time; a pairing makes the
actions queued before it stop), `src/car/operations.ts` (an activity shows at
once, "Waiting for the action before it."; a pairing ends a join in
progress), `CarNetwork.kt` (`release()` fails a waiting join with
`cancelled`), `messages.ts` (a failed join says to pair again after a reset).

**Verified:** typecheck, lint, Jest 78 (new `tests/queue.test.ts`),
`:car-link:testDebugUnitTest`. **Not verified** on a phone. The manager's
dev61 handover says "unchanged app code"; its APK was built from this tree
and has this change.

**Next:** pair again with dev64 after the reset; the scan should show its
activity at once. dev62's car-side pairing closed the manager (its GUI lost
its heartbeat while the worker prepared Wi-Fi Direct); fixed in the manager's
`97e18e8`, in dev64.

## 2026-11-16: kit dev59 — a failed log request is said on the page

The user got "No log yet" for Doom in the car with dev58: the car lost the
log when iDrive restarted (fixed in the manager, `16ecac5`). App side
(`70e3fa9`): when a log cannot be read, the app's or car's page now says why
instead of only the Activity tab. Submodule at the manager's `49ed79b`.
Kit dev59: APK versionCode 59, on the NAS.

**Next:** Doom's log on dev59 in the car (**Show log**, then **Share**), and
the **iDrive log** right after iDrive restarts. Still not checked on a phone:
whether the newest line of a log is drawn in full at the box's end (see
dev58). Doom itself is in `~/src/reverse/nbt-doom` (manager handover, dev59).

## 2026-11-16: kit dev58 — car logs, and logs that scroll

**Built** (`dba65b1`, `eb5f956`):

- An app's page has **Show log** (its log on the car: what it printed and how
  it ended), with **Share** and **Clear**; the car's page has **iDrive log**
  (`sloginfo`). `src/car/logs.ts`, `src/screens/LogView.tsx`,
  `readAppLog`/`readSystemLog`/`clearAppLog` in `src/protocol/actions.ts`.
- The car link saves a log route's reply to `<cache>/car-logs/<name>.log`
  (`CarLog.kt`; up to 16 MiB, raw) instead of reading it as 4 KiB of text, and
  returns its last 16 KiB as printable text (`src/protocol/logTail.ts` does
  the same for the Node link).
- `src/ui/LogText.tsx`, used by both logs and the installer's log: oldest
  line first, kept scrolled to the newest line unless the reader scrolls up,
  scrollbar always shown, text not selectable (it swallowed the swipe on
  Android). The user reported the installer log did not scroll.
- The submodule is at the manager's `751fb48`.

**Verified:** typecheck, lint, Jest (75), `:car-link:testDebugUnitTest`
(save, tail, routes), the contract test against the host worker (read, clear,
system log via worker and door). On the emulator: the log follows new lines,
a swipe scrolls it back and new lines then leave it there, the scrollbar
shows. **Not verified:** the newest line was drawn half below the box's end
on the emulator; the fixes for it (border on a frame, default font, room at
the end) could not be checked because the emulator's display froze and then
failed after a reboot. Check it on a phone first.

**Next:** on a phone with kit dev58: the installer log's end, and an app's
log after a crash.

## 2026-11-15: the three open decisions answered

The user's answers to the decisions listed under dev56:

- **Installer exception:** yes. AGENTS.md now names it under the approval
  rule: Install NBT Manager on a car installs, updates and removes NBT Manager
  itself as root with no confirmation on the car, like the Windows installer;
  never applications.
- **SSH question:** keep "Needed to install. Uses an online service." It does
  not name the service.
- **Key storage notice:** no. The Rename or forget panel keeps not saying
  where the phone keeps the car's key.

No code changed. **Next:** unchanged, the in-car test with kit dev56; waiting
for the user's results.

## 2026-11-15: kit dev56 — Restart iDrive? and the shorter text

- The installer core now says when iDrive has to restart (after an install, and
  after an update that replaced the plugin). The installer screen then asks
  "Restart iDrive?" with Later and Restart iDrive (`b670599`). The Windows
  installer asks the same in a modal.
- The shorter text of `ae8e2a6` is in this kit's APK.
- The submodule is at the manager's `9737919`.

**Verified:** typecheck, lint, Jest (71). The kit build compiled the Kotlin
module against the regenerated binding; the APK (versionCode 56, release
certificate) carries the new text and library. **Not verified:** the restart
question on a phone (it needs a connected head unit).

**Decisions to confirm** (open, nothing changed until the user answers):

- The AGENTS.md exception for the installer (see the dev54 entry below).
- The SSH question no longer names the online service
  (`pretzel.bavarian-aa.uk`); plan section 4 asked for a plain statement
  that diagnostic messages go to a third-party service. Nothing is sent
  before Turn on.
- The car's Rename or forget panel no longer shows whether the phone keeps the
  car's key in secure hardware. Plan section 3 wanted phones with only a
  software-protected key to say so; a one-line notice for that case only would
  restore it.

**Next:** the in-car procedure's "From the phone instead" with kit dev56.

## 2026-11-15: plain, short text everywhere

The user asked for the app to be clear to a novice. In particular: no
mention of the Windows installer, no technical text, and no sentences
describing what the app does.

- Every screen keeps only instructions, labels and short outcomes. Removed:
  explanations, sequence numbers, file names, hashes, key types, Wi-Fi names.
  "Applications" is now "Apps".
- The installer screen has three numbered steps and Connect. Its other parts:
  - Install, Update and Restart iDrive sit in one row (the user asked to keep
    Restart iDrive in view). The other tools are under More tools.
  - Address, port, user, password and gateway are under Settings.
  - The SSH question reads "Needed to install. Uses an online service."
- The installer core's messages go to the log only, which is folded behind
  Show log. The screen shows a short outcome from `state.ts` (`result`):
  Connected, Installed, Install failed, Could not connect, and so on.
- Logs fetched from the car get one Share button per kind, outside the log.

**Verified:** typecheck, lint, Jest (70); on the emulator with the dev client:
Cars, Apps, Library, Activity, the installer, the SSH question, a declined
question and the folded log.

## 2026-11-15: kit dev55 — the head unit found by its SSH port

No app code changed. The submodule moves to the manager's `203096c` (`a8e4cec`
plus a formatting-only `cargo fmt` pass and its pre-commit check). Its
installer core (`2df8bbc`) no longer tries the link-local address from a phone.
After enabling SSH, it searches the adapter's network for the SSH port every
2 s for up to 60 s, instead of ten tries at an address a phone cannot reach.
The manager handover has the details and the kit hashes.

**Kit dev55:** the release APK is versionCode 55, signed with the release
certificate. Its `libnbt_installer.so` carries the new search, checked by its
messages. On `/mnt/nas/public/nbt/`.

**Not verified:** a real phone, a car.

**Next:** the in-car procedure's "From the phone instead" with kit dev55.

## 2026-11-15: milestone 4 started — Install on a car (kit dev54)

The installer from the phone, over a Wi-Fi ENET adapter, without setting any
address. Assumes the head unit takes an address from the adapter; no car has
confirmed that yet.

**Built:**

- `modules/car-install` (Kotlin): `CarInstallModule` wraps the manager's Rust
  installer core (`desktop/mobile`, UniFFI binding through JNA 5.17).
  `InstallNetworks` holds the Wi-Fi the phone is on (requested without the
  internet capability) and mobile data while a session runs, and passes their
  handles and the Wi-Fi's addresses to the core. Errors are fixed codes
  (`no-wifi`, `no-address`, `invalid`, `busy`). Fetched car logs are written
  to the cache and shared from there.
- `scripts/build-installer-core.sh` (`yarn installer-core`): builds
  `libnbt_installer.so` with cargo-ndk and generates the binding into
  `modules/car-install/android/generated/` (ignored by git).
  `scripts/build-release.sh` runs it with `--release`; the manager's kit build
  supplies the signed release.
- `src/installer/` (session store, pure state reducer, tools and log panels)
  and `src/screens/InstallerScreen.tsx`, reached from Cars → Install on a car:
  connection settings prefilled with the published defaults, Connect, the
  Enable SSH question naming the third-party service (nothing sent before the
  user agrees), step and byte progress, Install, Update, the Windows
  installer's test tools (Remove behind a confirmation), and a log with
  details on request, shown newest first and shared in order. The screen stays
  on while a session runs.
- The submodule points at the manager's milestone-4 commit (`4200f6d`).
- `modules/car-install/android/proguard-rules.pro`: JNA keep rules, applied
  to the app's release build (R8 otherwise fails on JNA's `java.awt`
  references).

**Verified:** typecheck, lint, Jest (70, with 7 new installer-state tests),
debug APK. On the x86_64 emulator (dev client): the screen, Connect, the
held Wi-Fi, the phone's hint, the Enable SSH question, the gateway search from
the Wi-Fi's address only, and the end of the session. The newest-first log
order is checked by Jest only (the emulator kept an older bundle).

**Not verified:** a real phone, a car, mobile data alongside the adapter's
Wi-Fi, the relay over mobile data, sharing logs.

**Decision to confirm:** like the Windows installer, this screen installs,
updates and removes NBT Manager as root over SSH, with no confirmation on the
car (plan section 4). The AGENTS.md rule that approval comes only from the car
was written for the paired-phone protocol; the user should say whether it
should name this exception.

**Kit dev54** (manager handover has the hashes): the release APK is
versionCode 54, signed with the release certificate, and carries
`libnbt_installer.so` (4.9 MB, dev54's release inside) and JNA's
`libjnidispatch.so`; 35.5 MB. On `/mnt/nas/public/nbt/`.

**Next:** the in-car procedure's "From the phone instead" with kit dev54.

## 2026-11-15: the car's Wi-Fi alongside home Wi-Fi (seen on a phone)

Reported by the user (the phone of earlier sessions, a Pixel 6): the phone stayed
on the home Wi-Fi, showed only that one, and the app still worked with the
manager over the car's Wi-Fi Direct group. This is the local-only
`WifiNetworkSpecifier` link on a second Wi-Fi connection (Android 12 and later,
on phones where `WifiManager.isStaConcurrencyForLocalOnlyConnectionsSupported()`
is true); the status bar shows only the internet network, and the app's
Connected indicator is the only sign of the car's link. Phones without it drop
the home Wi-Fi while the app holds the car's network. The app does not yet
report which case applies. For milestone 4 it means the adapter's Wi-Fi and the
activation relay's internet can run at the same time on such phones.

## 2026-11-15: kit dev52 (installer gateway search)

No app change. Kit dev52 carries APK versionCode 52 (same code as dev51) with
the Windows installer's new gateway search: it asks from every local address,
and Connection settings gain a Gateway field (manager `cfdd09e`). This is for a
car that kept the address a Wi-Fi ENET adapter gave it. For milestone 4: the
user's Exctool adapter appears to bridge (its DHCP reached the car), so the car
and head unit will likely be on the adapter's `192.168.16.x` network, not only
on `169.254`. Not verified in the car.

## 2026-11-15: pairing under the car's Settings (kit dev51)

From kit dev50 the car has no Install or update entry and pairing is under
Settings; the app's hints now say "App Manager, then Settings, then Pair a
phone". Kit dev51 carries APK versionCode 51 (dev49's Wi-Fi status included);
dev50 was skipped. Not verified on a phone yet.

## 2026-11-14: the car's Wi-Fi joined ahead of actions (kit dev49)

User (dev48 in the car): actions work, but rejoining the Wi-Fi is slow and not
obvious. `7a2da43`: the car's Applications page joins the car's Wi-Fi as soon as it
shows and when the app returns to the foreground (`connectCar`), and shows
Connected, Connecting or Not connected with a Connect button
(`src/car/connection.ts`); the native link emits `onNetwork` (connected, lost,
released). The network is still released in the background and after 5 minutes
without an action. Not verified on a phone yet. Kit dev49: APK versionCode 49.

## 2026-11-14: dev47 in the car; kit dev48

Pairing, reading applications and installing `test-v2` worked on the Pixel 6. A
manager release the car refused (not newer than its own) showed "malformed":
the car answers a rejected upload 400; `b147e46` reads `/v1/status` and shows the
car's reason. Opening App Manager from the phone froze iDrive in the car; from
kit dev48 the car answers every wake request `off` (manager repo `aa3b029`) and
the app asks the driver to open App Manager. Kit dev48 carries APK versionCode 48.

## 2026-11-14: manager updates from the phone (kit dev47)

`fc162de`: the library accepts the kit's manager release (`phone/NBT-Manager-<version>.nbtr`,
`NBTRLS1`, `src/protocol/releaseHeader.ts`) as application `manager`, shown as
"NBT Manager"; the car's page offers **Send to the car**, which uses the ordinary
signed upload. The car reviews it; once approved the activity says it starts the
next time App Manager opens, and the car may then ask to restart iDrive (the
manager now updates its own iDrive plugin: manager repo `b646da6`, `912e353`).
The car refuses a release that is not newer than its manager, so the phone path
can be tried only with a kit newer than the installed one. Jest: 62 tests,
including the release header. Not verified on a phone or in the car.

## 2026-11-14: second car session (dev45), the car's network is held

In the car with dev45 on the Pixel 6 (user's report and screenshots; no phone log):
scanning the code, joining, pairing (confirmed on the car), installing and reading
settings worked. Android dropped the car's Wi-Fi Direct network between actions,
because the app released it after each one; the next join right after pairing got no
network for 60 s ("Could not join the car's Wi-Fi"), the same action a minute later
worked; a setting change failed the same way.

Decision (user, 2026-11-14): the app holds the car's network while it is open.
`CarNetwork.join` reuses the held network for the same car; `operations.ts` lets it go
when the app goes to the background (after a running action), after 5 minutes
without an action, and when the car is forgotten; joining another car replaces it.

Later in that session every join to the car's group failed, from the app, from
Android's Wi-Fi settings with a fresh code and for Android Auto, until Restart iDrive
fixed Android Auto (`WFDPass.conf` unchanged since boot). Cause not found. What the car
files say (`opt/conn/data/ConfigGen_Options.ini` in the dump): Connectivity starts the
`wfd0` group at boot (`autogo`), ISC `dhcpd` serves only 172.16.222.100-110 with
3-day leases (`/var/opt/conn/dhcpd.wfd0.leases`), and the Marvell stack logs to
`/var/opt/conn/mwu.log`; neither appears in `sloginfo`. DHCP exhaustion is unlikely
from one phone: Android's default randomized MAC is persistent per SSID and security
type (source.android.com, MAC randomization behavior), so the app, Settings and
Android Auto share one address. Next time it happens, before restarting iDrive: the
number of leases in that file and the end of `mwu.log` (both hold MAC addresses,
maybe more; read them on the car, do not commit them).
A failed join is retried once ("Still joining the car's Wi-Fi."), a rejoin waits 3 s
after a release, and the activity says when it is connected. AGENTS.md updated.
Not verified on a phone yet.

## 2026-11-14: first car session (dev43), kit dev45

On a Pixel 6 in the car the app rejected the car's real Wi-Fi code ("This is not the
car's Wi-Fi code"), which the camera app read. expo-camera's `data` is ML Kit's
display value, only the SSID for a Wi-Fi QR; `246cf5c` reads `raw`, the `WIFI:` text.
The emulator check paired with the desk car by address, so the camera path had
never run. Kit dev45 (manager repo; also on `/mnt/nas/public/nbt/`) carries the fix
as versionCode 45. Not verified yet: a scan of the car's code with the fixed build.
The car side of that session is in the manager's `HANDOVER.md`.

## 2026-11-14: kit dev43

`ba130dc` corrects the pairing hints on the Cars and Pair screens: on the car, Pair a
phone is under App Manager → Install or update. The manager's kit dev43
(`nbt-manager-windows-kit-dev43.zip`, SHA-256 `f69824e6…89ef`, also on
`/mnt/nas/public/nbt/`) carries this build as `phone/NBT-Manager-0.1.0.apk`, versionCode
43, signed with the release certificate (checked by the kit and again after unzipping),
and a procedure whose section 5 now describes the car's pairing screens instead of the
removed browser flow. It replaces dev42. Next: milestone 3 with dev43.

## 2026-11-14: emulator UI check, release key, APK in kit dev42

Milestone 2 is complete: the release APK exists and is in the in-car kit. Milestone 3
(in the car) is next.

### Done

- **UI checked on an Android emulator** (dev client, x86_64) against the desk car
  (`scripts/host_car.py --port 18080 --door-port 18081`, address `10.0.2.2:18080`):
  pairing with matching digits, library, install with car review, update available,
  settings read and set, a failed update rolled back, uninstall declined and confirmed.
  Eight UI defects found and fixed in `571e32f` (address keyboard without `:`, first tap
  eaten by the keyboard, misleading text for a closed pairing window, sizes shown as
  "0.0 MB", install rows not looking tappable, car text repeated in status lines,
  plural and wording fixes). `f0412ea` adds `yarn emulator`.
- **Desk car on any port** (debug builds only): `RouteGuard` maps `127.0.0.1:<1024-65535>`
  to the desk address, the door one port up. Release builds still reach only the two
  car addresses on 8080/8081 (`RouteGuardTest`).
- **Yarn 4** (`42bf870`): pinned through corepack, `nodeLinker: node-modules`
  (React Native does not support Plug'n'Play), `package-lock.json` removed.
- **Release key** (`83b59ac`): EC P-256 PKCS12 keystore
  `~/.local/share/nbt-manager/keys/android/nbt-manager-release.jks`, alias
  `nbt-manager`, random password in `keystore.pass` beside it (both mode 600), backed up
  in Bitwarden folder `nbt` as "NBT Manager Android app release keystore (EC P-256)"
  (keystore as base64, password, fingerprint; restore verified byte for byte).
  Certificate SHA-256 `86feff0db5bbb0cccc5b255465a554cf148617f02dcb9df4b90ec958681c3f7d`
  in `android-release-cert.sha256`.
- **Release APK**: `scripts/build-release.sh 41` built a 30.3 MB arm64 APK signed only
  with that certificate (scheme v2), versionCode 41, min SDK 29, target 36. Its
  manifest has backup off and cleartext only for `172.16.222.1`/`172.16.224.1` (no
  loopback), fine location capped at SDK 32, Nearby Wi-Fi flagged never-for-location.
- **Kit dev42**: the manager's `tools/build_windows_kit.py` now runs
  `scripts/build-release.sh <kit sequence> <dir>` and puts the APK in the kit as
  `phone/NBT-Manager-0.1.0.apk` (versionCode 42, same certificate, checked again by the
  kit). `dist/nbt-manager-windows-kit-dev42.zip`, 17069273 bytes, SHA-256
  `c9c9203edfc17965a18f0815d02816fdde3785ebc97adca9a38e08d6ab53cc1a`; every entry of
  its `SHA256SUMS.txt` verified after unzipping. dev41 was never installed; dev42
  replaces it.

### Not verified

- On a real phone: camera scanning, Keystore/StrongBox, the Wi-Fi join and socket
  binding, the permission prompts. The user reports that the app installs and runs on
  a Pixel 6 (2026-11-14; build and Android version not recorded); pairing from
  it has not been reported.
- In a car: everything (milestone 3).

### Next

1. Optional: install the release APK (or the dev client with `yarn desk --lan`) on a
   phone at the desk to catch phone-side defects before the car.
2. Milestone 3 in the car with the kit's APK: plan section 9, steps 1 to 6, following
   the kit's `PROCEDURE.md`. Record results per phone and Android version here.

## 2026-11-14: milestone 2, App 0.1

App 0.1 is implemented against the pinned manager `f9cdfa6` (dev41) and its
[`PROTOCOL.md`](third_party/nbt-apps-manager/PROTOCOL.md). It pairs with a car,
keeps a package library, installs and updates, uninstalls, reads and changes
settings, and shows each action's progress and result. Nothing has run on a phone
or in a car yet. No release APK exists: the dedicated signing key has not been
created (see *Next*).

### Built

- `src/protocol/`: NBT-REQ-1 signing text, key id, six-digit pairing code, reply
  parsers (bounded, sequences kept as decimal text), Wi-Fi code parser, `.nbt` header
  and manifest check, a serialized signed session (one nonce per request, the next
  taken from each reply), one flow per action, and reaching the manager directly,
  through a wake request to the door, or by asking the driver to open it.
- `modules/device-key` (Kotlin): one P-256 key per car in the Android Keystore,
  StrongBox when present, unlocked-only when the phone allows it; it signs only text
  matching NBT-REQ-1. Reports `strongbox`, `tee` or `software`.
- `modules/car-link` (Kotlin): joins the car's Wi-Fi with `WifiNetworkSpecifier`
  (local-only), sends requests on sockets from that network's factory, allow-lists
  `172.16.222.1`/`172.16.224.1`, ports 8080 (worker) and 8081 (door, its routes only),
  and the `/v1/` routes by method. It writes HTTP itself (`HttpWire.kt`): OkHttp would
  add `; charset=utf-8` to `Content-Type`, which the car's parser rejects. Streams uploads
  from app storage with progress; hashes files; bounded ASCII replies; fixed error codes.
- `src/store/`: cars in SecureStore (one entry each, plus an index; checked on read),
  the library in app storage (`library/<sha256>.nbt` and an index re-checked on load),
  in-memory activity.
- `src/car/operations.ts`: every action joins the car's Wi-Fi, keeps the screen on,
  runs, records the outcome and releases both, one action at a time.
- Screens: Cars (pair, rename, forget), Applications (last list read, update available
  when the library has a higher sequence, library packages not on the car), an
  application's page (install/update/reinstall, settings, uninstall), Library,
  Activity. No phone screen or route approves anything; uninstall only asks the car.
- `scripts/host_car.py`: the desk car (host worker + door, car decisions on stdin,
  signed test packages, optional LAN forwarding). `scripts/contract.ts` and
  `scripts/nodeLink.ts`: the contract test. `scripts/build-release.sh`: release build.

### Verified, on the workstation only

- `npm run typecheck`, `npm run lint`: clean. `npm test`: 60 Jest tests passed, including
  every row of the manager's `tests/phone-signing-vectors.tsv` (signing text hash, key
  id, pairing code and the DER signature verified with Node's crypto).
- `npm run test:contract` with `NBT_MANAGER_BUILD=~/src/reverse/nbt-apps-manager/build`:
  21 checks passed against the real host worker and door (`managerd-test` at `f9cdfa6`):
  pairing confirmed on the car side, unknown key refused, upload with progress, install
  after car approval, list, settings read/set through worker and door, invalid value
  refused, wake `off` then `opening`, uninstall declined then confirmed, revocation.
  It uses Node sockets, not the Kotlin link; `HttpWireTest` pins the same bytes.
- Kotlin unit tests (`:car-link:testDebugUnitTest`, `:device-key:testDebugUnitTest`):
  10 passed (HttpWire 4, RouteGuard 3, RequestText 3). `:app:assembleDebug` built the
  dev client (arm64, 97 MB unminified).
- `scripts/build-release.sh 41` with a throwaway keystore in a temporary directory (and a
  temporary fingerprint file, removed afterwards): it built and signed a 30.3 MB arm64
  release APK, version code 41, and the fingerprint check passed. The first attempt
  showed that Android's injected-signing properties do not reach Gradle from the
  environment: the APK came out debug-signed and the script rejected it. The config
  plugin now gives release builds their own signing config, fed only from
  `NBT_RELEASE_*` variables, and leaves them unsigned otherwise.

### Not verified

- Anything on a phone: Keystore key creation and signing, StrongBox fallback, the
  Wi-Fi join and Connect dialog, socket binding, the Nearby/Location permission
  prompts, camera scanning, file picking, the UI itself.
- Anything in a car: compatibility beyond the host worker, the 172.16.224.1 address,
  timings, the door from boot.
- Release signing with the real key: it does not exist yet, so there is no release APK
  for the car and the kit has no APK.

### Decisions

- 2026-11-14 (user): iterate on the UI with the Expo dev client over the LAN, and test
  in the car with the full (release) client. Metro runs on port 8082, away from the
  door's 8081. Debug builds allow cleartext for Metro; release builds keep the two car
  addresses only. Debug builds can map the worker's loopback listener to a workstation
  (`setDeskIp`), refused natively in release builds.
- `compileSdk` 37, `targetSdk` 36: Expo SDK 58's modules require compiling against 37;
  the target stays 36 to avoid Android 17's `ACCESS_LOCAL_NETWORK`.
- `react-native-safe-area-context` added: React Native's `SafeAreaView` is deprecated
  and does nothing on Android, where target 36 enforces edge-to-edge.
- Blocked permissions the template and SecureStore add: `SYSTEM_ALERT_WINDOW`, `VIBRATE`,
  `USE_BIOMETRIC`, `USE_FINGERPRINT`. Release lint requires `includeSubdomains` on the
  network security config's domains; it is `false`.
- The library takes picked files only. Opening or sharing `.nbt` files into the app
  needs intent handling and is left for later.
- The car's BSSID identifies a car (a re-pair replaces the old record and key); it is
  not put in the Wi-Fi request, in case the group's address changes between boots.
- Car records get a random id; the key alias is `car-<id>`. A key is deleted when
  pairing does not complete and when a car is forgotten.
- The host fixture's managed root must include `trust/keys`, as setup creates it
  (`desktop/src/ssh.rs`): without it the host worker fails a first install. Setup on
  the car creates it, so this is not a car defect, but the worker could tolerate it.

### Next

1. Create the release keystore and commit its fingerprint (README, *Release signing*),
   then `scripts/build-release.sh 41`.
2. Put the APK in the kit: the manager's `tools/build_windows_kit.py` calls this repo's
   `scripts/build-release.sh` (plan section 6) instead of the dev41 notice.
3. Desk run on a phone with the dev client and `yarn desk`, then milestone 3 in the
   car with the release build (plan section 9, steps 1 to 6).

Build and test from a clean checkout: README.md. Commits are signed; keep signing on.

## 2026-11-14: setup checkpoint

Expo SDK 58 scaffold, strict TypeScript, ESLint, Jest, a setup screen and the manager
submodule at `f9cdfa6` (`5ddd421`, `d0128d4`). Decision: Nearby Wi-Fi permission on
Android 13+ and Fine Location limited to Android 10-12, only for joining a chosen
network; the app does not scan for cars or derive location. Android backup is disabled.
Backups: `backup/app-foundation-2026-11-14`, `backup/car-api-checkpoint-2026-11-14`.
