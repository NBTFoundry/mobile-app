#!/usr/bin/env bash
# Builds the installer core for the car-install module: libnbt_installer.so for
# arm64 Android and its UniFFI Kotlin binding, into
# modules/car-install/android/generated/ (ignored by git).
#
#   scripts/build-installer-core.sh [--release]
#
# Source: the manager repository's desktop/ workspace, from $NBT_INSTALLER_SOURCE
# (the kit build sets it to the repository it runs from) or the submodule.
# --release embeds the signed manager release and needs NBT_MANAGER_RELEASE and
# NBT_MANAGER_PUBLIC_KEY, plus optionally NBT_TEST_APP_PACKAGE, NBT_TEST_APP_KEY
# and NBT_TEST_APP_COMPAT, exactly as the Windows installer's build does.
# NBT_INSTALLER_ABIS adds Android ABIs for an emulator, e.g. "arm64-v8a x86_64"
# (with `rustup target add x86_64-linux-android` and Gradle's
# -PreactNativeArchitectures=x86_64); the APK ships arm64-v8a only.
# Needs the Android NDK, cargo-ndk and `rustup target add aarch64-linux-android`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="${NBT_INSTALLER_SOURCE:-$root/third_party/nbt-apps-manager}"
target="$root/build/installer-core"
out="$root/modules/car-install/android/generated"

fail() { echo "build-installer-core: $*" >&2; exit 1; }

[[ -f "$source_dir/desktop/mobile/Cargo.toml" ]] \
  || fail "no installer core in $source_dir (git submodule update --init, or set NBT_INSTALLER_SOURCE)"
command -v cargo-ndk >/dev/null || fail "install cargo-ndk: cargo install cargo-ndk"
rustup target list --installed | grep -qx aarch64-linux-android \
  || fail "install the Rust target: rustup target add aarch64-linux-android"
if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  ndk="$(ls -d "${ANDROID_HOME:?set ANDROID_HOME}"/ndk/*/ 2>/dev/null | sort -V | tail -1)"
  [[ -n "$ndk" ]] || fail "no NDK under $ANDROID_HOME/ndk; install one with the SDK manager"
  export ANDROID_NDK_HOME="${ndk%/}"
fi

profile=()
if [[ "${1:-}" == "--release" ]]; then
  [[ -n "${NBT_MANAGER_RELEASE:-}" && -n "${NBT_MANAGER_PUBLIC_KEY:-}" ]] \
    || fail "release builds embed the signed manager release: set NBT_MANAGER_RELEASE and NBT_MANAGER_PUBLIC_KEY"
  profile=(--release)
elif [[ -n "${1:-}" ]]; then
  fail "usage: $0 [--release]"
fi

abis=()
for abi in ${NBT_INSTALLER_ABIS:-arm64-v8a}; do
  [[ "$abi" =~ ^(arm64-v8a|x86_64)$ ]] || fail "unsupported ABI $abi"
  abis+=(-t "$abi")
done

rm -rf "$out"
mkdir -p "$out/jniLibs" "$out/kotlin"
# cargo-ndk reads the workspace from the current directory.
cd "$source_dir/desktop"
# API 29 is the app's minimum. A development build drops debug information,
# which would make the library hundreds of megabytes.
CARGO_PROFILE_DEV_DEBUG=false CARGO_PROFILE_DEV_STRIP=symbols \
  cargo ndk "${abis[@]}" -P 29 -o "$out/jniLibs" \
  build -p nbt-installer-mobile "${profile[@]}" --locked --target-dir "$target"
# The Android library is stripped, and with it the interface description the
# binding is generated from; a host build carries the same one.
cargo build -q -p nbt-installer-mobile --locked --target-dir "$target"
cargo run -q -p nbt-installer-mobile --features bindgen --bin uniffi-bindgen --locked \
  --target-dir "$target" -- \
  generate --library "$target/debug/libnbt_installer.so" --language kotlin --no-format --out-dir "$out/kotlin"

[[ -f "$out/jniLibs/arm64-v8a/libnbt_installer.so" ]] || fail "cargo-ndk produced no library"
[[ -f "$out/kotlin/net/cornera/nbtmgr/install/core/nbt_installer.kt" ]] || fail "no Kotlin binding generated"
echo "$out"
