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
| `src/App.tsx` | No router: `Tab`, `Route` and `AppState` (shared state and `go`); a new tab goes in `TABS`, a new page in `Route` and the Back handler |
| `src/screens/`, `src/ui/` | One file per screen; `ui/kit.tsx` (Title, Body, Button, Row, Panel, Busy, Progress), `ui/Dialog.tsx` |
| `src/store/` | What the phone keeps: `library.ts`, `cars.ts` (SecureStore), `preferences.ts` (language, betas), `catalog.ts` and `download.ts` (Get apps: `app-catalog` skill) |
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
- Nothing goes online on its own: the car is reached after a user action,
  the internet only from Get apps.
- Every user-visible text in all seven languages (`gui-text`).

Tests: Jest in `tests/`, with `expo-file-system`, `../modules/car-link` and
`../src/protocol/packageHeader` mocked as in `tests/library.test.ts` and
`tests/catalog.test.ts` (imports at the top: Jest hoists the mocks). A UI
change updates `docs/ui.md`; a new folder or store, the README's Layout table.
Then the `phone-build` checks; commit and push (`main`).
