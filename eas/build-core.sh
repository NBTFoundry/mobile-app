#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
# EAS Build hook (package.json "eas-build-post-install"): builds the installer
# core for a cloud build, as scripts/build-installer-core.sh --release does on a
# workstation, from the pins in eas/pins.env: Rust and cargo-ndk, the installer
# at its pinned commit, and the public NBT Manager release checked against its
# SHA-256 and the manager's public key. Does nothing outside EAS.
set -euo pipefail

[[ -n "${EAS_BUILD:-}" ]] || { echo "eas/build-core.sh: only for EAS builds"; exit 0; }
[[ "${EAS_BUILD_PLATFORM:-android}" == android ]] || exit 0

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=pins.env
source "$root/eas/pins.env"
work="$(mktemp -d)"

fail() { echo "eas/build-core.sh: $*" >&2; exit 1; }

if ! command -v rustup >/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "$RUST_TOOLCHAIN" >/dev/null
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup toolchain install "$RUST_TOOLCHAIN" --profile minimal >/dev/null
rustup default "$RUST_TOOLCHAIN" >/dev/null
rustup target add aarch64-linux-android >/dev/null
command -v cargo-ndk >/dev/null || cargo install cargo-ndk --locked --version "$CARGO_NDK_VERSION"

git init -q "$work/installer"
git -C "$work/installer" fetch -q --depth 1 https://github.com/NBTFoundry/installer.git "$INSTALLER_REF"
git -C "$work/installer" checkout -q FETCH_HEAD

release="$work/nbt-manager-$MANAGER_VERSION.nbtr"
curl -fsSL -o "$release" \
  "https://github.com/NBTFoundry/manager/releases/download/v$MANAGER_VERSION/nbt-manager-$MANAGER_VERSION.nbtr"
echo "$MANAGER_SHA256  $release" | sha256sum -c --quiet - || fail "the manager release does not match eas/pins.env"

# The core's build script verifies the release against the key before embedding it.
NBT_INSTALLER_SOURCE="$work/installer" NBT_MANAGER_RELEASE="$release" \
  NBT_MANAGER_PUBLIC_KEY="$root/eas/manager-public.pem" \
  "$root/scripts/build-installer-core.sh" --release
