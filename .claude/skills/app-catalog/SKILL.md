---
name: app-catalog
description: The online application catalog and the phone's Apps tab (what can be got and updated) - list or withdraw an application, change the catalog's format on both sides, rebuild and check https://nbtfoundry.github.io (landing page included). Use when an app should appear in or leave the catalog, when the catalog or landing page changes, or when the Apps tab's catalog part misbehaves.
---
<!-- SPDX-License-Identifier: MPL-2.0 -->
# The online catalog

| Side | Files |
| --- | --- |
| `NBTFoundry/NBTFoundry.github.io` (checkout `../NBTFoundry.github.io`) | `apps.json` (the allowlist), `tools/build_catalog.py` (writes `catalog.json`), `tools/nbt_files.py` (verifies `.nbt`/`.nbtr`), `site/` (landing page; `site/apps.js` renders the app cards from `catalog.json` in the browser), `tools/render_site.py` (copies `site/` and `catalog.json`), `.github/workflows/pages.yml` |
| Phone (this repository) | `src/store/catalog.ts` (parse, cache, `releaseFor`, `onlineUpdate`), `src/store/download.ts` and `downloads.ts`, `src/store/appList.ts`, `src/screens/AppsScreen.tsx`, `src/ui/appIcons.ts` (the catalog's icons, bundled: `yarn icons` when an application joins), `tests/catalog.test.ts`, `tests/fixtures/catalog.json` |

The workflow runs on push, when a release run starts it (the manager's
`update-catalog` action, last job of `release.yml` and `app-release.yml`, with
the `CATALOG_TOKEN` of the repository's `catalog` environment), every 30
minutes when GitHub's schedule allows, and by hand. It lists, per app,
the newest stable release and a newer pre-release (a `0.x` tag is one),
verifying every file against the manager's `release/*.pem` on its `main`.
The phone downloads only `https://github.com/<repo>/releases/download/…`,
checks size, SHA-256, app id and sequence, then adds it to the library like
a picked file; the car verifies the signature.

## Tasks

- **List an app:** add it to `apps.json` (fields: that repository's README),
  commit, push. It shows "Coming soon" until its first release.
- **Withdraw a version:** its version in the app's `withdrawn`.
- **Rebuild now** (a release edited by hand, a release run whose `catalog`
  job warned or failed): `gh workflow run pages -R NBTFoundry/NBTFoundry.github.io`,
  then `curl -s https://nbtfoundry.github.io/catalog.json`. A release left out
  shows as a `::warning::` in the run's Catalog step.
- **Locally:** `python3 -I -m unittest discover -s tests`, then
  `GITHUB_TOKEN=$(gh auth token) python3 -I tools/build_catalog.py --keys
  ../manager/release --output out/catalog.json` and `render_site.py`.
- **Format change:** both sides in step: the writer, `site/apps.js`, the
  phone's `parseCatalog` (unknown fields are ignored, so adding one is safe;
  removing or retyping one breaks installed phones: bump `schema` and say so),
  the repository README's "Catalog" section, then refresh
  `tests/fixtures/catalog.json` from the live URL.
- **Landing page:** edit `site/`, render, and look at it with
  `chromium-browser --headless=new --allow-file-access-from-files --screenshot`
  (`apps.js` fetches `catalog.json`) in light
  (`--blink-settings=preferredColorScheme=1`) and dark; headless windows are
  at least 500 px wide.
- **Schedule stopped:** GitHub pauses it after 60 days without a commit
  there; re-enable it under Actions.
