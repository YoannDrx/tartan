#!/usr/bin/env bash
# Parcours Maestro sur l'émulateur Android de la CI (job `maestro-android` de mobile-native.yml).
# L'app de développement vise http://localhost:3000 : `adb reverse` relie ce port à celui du serveur du runner.
set -euo pipefail
cd "$(dirname "$0")/.."
adb wait-for-device
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb reverse tcp:3000 tcp:3000
adb logcat -c || true
(adb logcat -v time '*:E' ReactNativeJS:V > "$RUNNER_TEMP/logcat.txt" 2>&1 &)
maestro test .maestro --config .maestro/config-android.yaml \
  --format junit --output "$RUNNER_TEMP/maestro-android.xml" \
  --debug-output "$RUNNER_TEMP/maestro-android" --flatten-debug-output \
  -e APP_ID=coach.tartan.app.dev \
  -e COACH_EMAIL=coach@demo.tartan.coach \
  -e ATHLETE_EMAIL=un@demo.tartan.coach \
  -e ATHLETE2_EMAIL=deux@demo.tartan.coach \
  -e API_URL=http://localhost:3000 \
  -e PASSWORD="$DEMO_PASSWORD"
