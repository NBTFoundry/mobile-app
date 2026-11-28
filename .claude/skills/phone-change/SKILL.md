---
name: phone-change
description: Change the NBT Manager phone app (NBTFoundry/mobile-app) - a screen or tab, a store on the phone, a flow with the car, errors, preferences - following the app's rules, with its texts, tests and docs. Use for any phone app change; protocol changes shared with the manager go through bridge-change.
---
<!-- SPDX-License-Identifier: MPL-2.0 -->
# Changing the phone app

Read `AGENTS.md` first (the safety rules: approvals only on the car, keys in
the Keystore, bounded untrusted input, the car's network held and released).

| Where | What |
| --- | --- |
| `src/App.tsx`, `src/route.ts` | No router: the route is state (`Tab`, `Page`, an application and its `AppSection`, a `CarTool`); `AppState` shares state, `go` and `back`. A new tab goes in `screens/TabBar.tsx`, a new page in `Page` and `App.tsx`; `back()` and its test follow |
| `src/screens/` | One file per screen: `AppsScreen` (the merged list), `AppScreen` and `AppSections`, `CarScreen` and `CarToolScreen`, `MoreScreen` and `AboutCard`, `DownloadsScreen`, `ActivityBar` |
| `src/ui/` | `kit.tsx` (Title, Body, Button, Row with icon/value/right, Pill, Toggle, Section, Panel, Busy, Progress), `Dialog.tsx`, `ChoiceRow.tsx`, `icons.tsx` (line icons), `AppIcon.tsx` (bundled icons: `yarn icons`), `motion.tsx` and `Lottie.tsx` (animations: `yarn lottie`) |
| `src/store/` | What the phone keeps: `library.ts` (Downloads), `cars.ts` (SecureStore), `preferences.ts`, `catalog.ts`, `download.ts` and `downloads.ts` (`app-catalog` skill), `appList.ts` (each application once, with its next step), `appUpdate.ts` and `diagnostics.ts` (`docs/updates.md`) |
| `src/protocol/` | Wire formats and parsers; changes shared with the car: `bridge-change` skill |
| `src/car/` | Running actions on the car; `messages.ts` maps every error class and code to a fixed text |
| `src/i18n/` | Seven catalogs: `gui-text` skill |

Rules:

- A new error: its own class with fixed codes, mapped in `describeError`
  (`src/car/messages.ts`); raw native or server text is never shown.
- Input from the car, the network or a file: parse it into typed values with
  length and count limits; one malformed item is dropped, not the screen.
- Files stay around 300 lines; split by responsibility.
- Effects: the lint rule `react-hooks/set-state-in-effect` refuses a
  synchronous `setState` in an effect: start the state from a `useState`
  initializer and set it only in promise callbacks.
- Nothing goes online or to the car on its own: only after a user action, or
  the start-up choices in More (off by default). Diagnostics only with the
  user's agreement. Anything new the app sends goes in the privacy page and
  `store/listing.md` first (`AGENTS.md`).
- A setting is a line of `preferences.ts` (validated when read, a default not
  written) and a row in `MoreScreen`. Keep them few.
- An action shows what it is at: set the activity's `stage` (`connect`,
  `transfer`, `confirm`, `working`) and its `progress` when it can be measured.
- Native code, a native dependency, `plugins/`, `assets/` or `app.config.ts`
  changed: the runtime version changes, and the next release must be a store
  build, not `yarn ota` (`docs/updates.md`).
- Every user-visible text in all seven languages (`gui-text`).

Tests: Jest in `tests/`, with `expo-file-system`, `../modules/car-link` and
`../src/protocol/packageHeader` mocked as in `tests/library.test.ts` and
`tests/catalog.test.ts` (imports at the top: Jest hoists the mocks). A UI
change updates `docs/ui.md` and, when a captured screen changed,
`scripts/capture_screens.py` and its captures; a new folder or store, the
README's Layout table.
Then the `phone-build` checks; commit and push (`main`).
