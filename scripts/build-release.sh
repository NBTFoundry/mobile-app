#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
# Builds the signed release APK locally with the dedicated keystore, then checks its
# certificate against the committed fingerprint. Never signs with the debug key.
#
#   scripts/build-release.sh <version-code> [output-dir]
#
# Builds the installer core first (scripts/build-installer-core.sh --release), which
# needs NBT_MANAGER_RELEASE and NBT_MANAGER_PUBLIC_KEY; the manager's kit build sets them.
#
# Keystore: ~/.local/share/nbt-manager/keys/android/nbt-manager-release.jks (mode 600),
# alias "nbt-manager". Passwords come from NBT_ANDROID_KEYSTORE_PASSWORD (store and key),
# or from keystore.pass beside the keystore (mode 600). Neither is printed or logged.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
keys="${NBT_ANDROID_KEYS:-$HOME/.local/share/nbt-manager/keys/android}"
store="$keys/nbt-manager-release.jks"
alias_name="nbt-manager"
fingerprint_file="$root/android-release-cert.sha256"
code="${1:-}"
out="${2:-$root/build}"

fail() { echo "build-release: $*" >&2; exit 1; }

[[ "$code" =~ ^[1-9][0-9]{0,8}$ ]] || fail "give the version code (the kit sequence), e.g. 41"
[[ -f "$store" ]] || fail "missing $store; see README.md, Release signing"
[[ "$(stat -c %a "$store")" == 600 ]] || fail "$store must be mode 600"
if [[ -z "${NBT_ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
  [[ -f "$keys/keystore.pass" && "$(stat -c %a "$keys/keystore.pass")" == 600 ]] \
    || fail "set NBT_ANDROID_KEYSTORE_PASSWORD or create $keys/keystore.pass (mode 600)"
  NBT_ANDROID_KEYSTORE_PASSWORD="$(<"$keys/keystore.pass")"
fi
[[ -f "$fingerprint_file" ]] || fail "missing $fingerprint_file; commit the release certificate's SHA-256 first"
expected="$(tr -d ' \n:' <"$fingerprint_file" | tr 'A-F' 'a-f')"
[[ "$expected" =~ ^[0-9a-f]{64}$ ]] || fail "$fingerprint_file must hold one SHA-256 fingerprint"

build_tools="$(ls -d "${ANDROID_HOME:?set ANDROID_HOME}"/build-tools/*/ | sort -V | tail -1)"
apksigner="${build_tools}apksigner"
[[ -x "$apksigner" ]] || fail "apksigner not found under $ANDROID_HOME/build-tools"

cd "$root"
version="$(node -p "require('./package.json').version")"
# The installer core with the signed manager release embedded (NBT_MANAGER_RELEASE,
# NBT_MANAGER_PUBLIC_KEY and the test application's variables, set by the kit build).
scripts/build-installer-core.sh --release >/dev/null
NBT_VERSION_CODE="$code" CI=1 yarn expo prebuild --platform android --clean --no-install >/dev/null
# The config plugin signs release builds only from these variables (never with the
# debug key); the password reaches Gradle through its environment, not the command line.
apk="android/app/build/outputs/apk/release/app-release.apk"
rm -f "$apk"
(
  cd android
  NBT_RELEASE_STORE_FILE="$store" NBT_RELEASE_STORE_PASSWORD="$NBT_ANDROID_KEYSTORE_PASSWORD" \
    NBT_RELEASE_KEY_ALIAS="$alias_name" NBT_VERSION_CODE="$code" \
    ./gradlew --console=plain -q :app:assembleRelease
)
unset NBT_ANDROID_KEYSTORE_PASSWORD

[[ -f "$apk" ]] || fail "Gradle produced no signed release APK"
"$apksigner" verify --min-sdk-version 29 "$apk" >/dev/null || fail "the APK signature does not verify"
certs="$("$apksigner" verify --print-certs "$apk")"
digests="$(sed -n 's/^\(Signer #[0-9]*\|V[0-9.]* Signer\): certificate SHA-256 digest: //p' <<<"$certs" | tr -d ' :' | sort -u)"
[[ "$(wc -l <<<"$digests")" == 1 && -n "$digests" ]] || fail "expected exactly one signing certificate"
[[ "$digests" == "$expected" ]] || fail "signed with an unexpected certificate ($digests)"

mkdir -p "$out"
target="$out/NBT-Manager-$version-$code.apk"
cp "$apk" "$target"
(cd "$out" && sha256sum "$(basename "$target")" >"$(basename "$target").sha256")
echo "$target"
