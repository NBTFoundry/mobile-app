#!/usr/bin/env bash
# Starts an Android emulator for the dev client and waits until it has booted.
#
#   scripts/emulator.sh [avd-name]      (default: $NBT_AVD, else the first AVD listed)
#
# Does nothing if an emulator is already running. Emulator output goes to
# build/emulator.log. In the emulator the workstation is 10.0.2.2: pair the desk car
# (yarn desk, no --lan needed) with that address.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[[ -n "$sdk" ]] || { echo "emulator: set ANDROID_HOME" >&2; exit 1; }
emulator="$sdk/emulator/emulator"
adb="$sdk/platform-tools/adb"

if "$adb" devices | grep -q '^emulator-[0-9]*[[:space:]]*device$'; then
  echo "An emulator is already running."
  exit 0
fi

avd="${1:-${NBT_AVD:-$("$emulator" -list-avds | head -n 1)}}"
[[ -n "$avd" ]] || { echo "emulator: no AVD found; create one in Android Studio's Device Manager" >&2; exit 1; }
"$emulator" -list-avds | grep -qx "$avd" || { echo "emulator: no AVD named $avd" >&2; exit 1; }

mkdir -p "$root/build"
echo "Starting $avd (log: build/emulator.log)"
nohup "$emulator" -avd "$avd" -netdelay none -netspeed full >"$root/build/emulator.log" 2>&1 &
pid=$!

"$adb" wait-for-device
for _ in $(seq 1 180); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "emulator: exited during boot; see build/emulator.log" >&2
    exit 1
  fi
  if [[ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then
    echo "$avd is ready."
    exit 0
  fi
  sleep 1
done
echo "emulator: not booted after 3 minutes; see build/emulator.log" >&2
exit 1
