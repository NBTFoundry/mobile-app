#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
# Publishes the committed JavaScript as an update of the app between store builds
# (docs/updates.md). It reaches only the builds whose native side this commit matches
# (plugins/runtimeVersion.js), on one channel: "production" (the Play builds) or "preview".
#
#   scripts/publish-update.sh "<what changed, for the update's page>" [channel]
#
# Refuses a tree with changes: an update is a commit, like a store build. Runs the checks
# first. The phones take it when their user asks (More › About), or with the catalog.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
message="${1:-}"
channel="${2:-production}"

fail() { echo "publish-update: $*" >&2; exit 1; }

[[ -n "$message" ]] || fail 'say what changed: scripts/publish-update.sh "<message>" [channel]'
[[ "$channel" == production || "$channel" == preview ]] || fail "unknown channel $channel"
cd "$root"
[[ -z "$(git status --porcelain)" ]] || fail "commit first: the tree has changes"

runtime="$(node -e "console.log(require('./plugins/runtimeVersion').runtimeVersion(process.cwd()))")"
echo "Runtime $runtime, channel $channel, commit $(git rev-parse --short HEAD)"
yarn typecheck >/dev/null
yarn lint >/dev/null
yarn test >/dev/null
npx eas-cli update --channel "$channel" --environment "$channel" --platform android \
  --message "$message" --upload-source-maps --non-interactive
echo "Published. Builds on another runtime ignore it: npx eas-cli build:list shows each build's."
