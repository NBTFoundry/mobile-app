---
name: app-catalog
description: The online application catalog and the phone's Get apps tab - list or withdraw an application, change the catalog's format on both sides, rebuild and check https://nbtfoundry.github.io (landing page included). Use when an app should appear in or leave Get apps, when the catalog or landing page changes, or when Get apps misbehaves.
---
<!-- SPDX-License-Identifier: MPL-2.0 -->
# The online catalog

| Side | Files |
| --- | --- |
| `NBTFoundry/NBTFoundry.github.io` (checkout `../NBTFoundry.github.io`) | `apps.json` (the allowlist), `tools/build_catalog.py` (writes `catalog.json`), `tools/nbt_files.py` (verifies `.nbt`/`.nbtr`), `tools/render_site.py` and `site/` (landing page), `.github/workflows/pages.yml` |
| Phone (this repository) | `src/store/catalog.ts` (parse, cache, `releaseFor`, `onlineUpdate`), `src/store/download.ts`, `src/screens/StoreScreen.tsx`, `tests/catalog.test.ts`, `tests/fixtures/catalog.json` |

The workflow runs on push, every 30 minutes and by hand. It lists, per app,
the newest stable release and a newer pre-release (a `0.x` tag is one),
verifying every file against the manager's `release/*.pem` on its `main`.
The phone downloads only `https://github.com/<repo>/releases/download/…`,
checks size, SHA-256, app id and sequence, then adds it to the library like
a picked file; the car verifies the signature.

## Tasks

- **List an app:** add it to `apps.json` (fields: that repository's README),
  commit, push. It shows "Coming soon" until its first release.
- **Withdraw a version:** its version in the app's `withdrawn`.
- **Rebuild now:** `gh workflow run pages -R NBTFoundry/NBTFoundry.github.io`,
  then `curl -s https://nbtfoundry.github.io/catalog.json`. A release left out
  shows as a `::warning::` in the run's Catalog step.
- **Locally:** `python3 -I -m unittest discover -s tests`, then
  `GITHUB_TOKEN=$(gh auth token) python3 -I tools/build_catalog.py --keys
  ../manager/release --output out/catalog.json` and `render_site.py`.
- **Format change:** both sides in step: the writer, `render_site.py`, the
  phone's `parseCatalog` (unknown fields are ignored, so adding one is safe;
  removing or retyping one breaks installed phones: bump `schema` and say so),
  the repository README's "Catalog" section, then refresh
  `tests/fixtures/catalog.json` from the live URL.
- **Landing page:** edit `site/`, render, and look at it with
  `chromium-browser --headless=new --screenshot` in light
  (`--blink-settings=preferredColorScheme=1`) and dark; headless windows are
  at least 500 px wide.
- **Schedule stopped:** GitHub pauses it after 60 days without a commit
  there; re-enable it under Actions.
