#!/usr/bin/env bash
# Une deuxième résolution Maven est possible après un refus temporaire du dépôt.
set -euo pipefail
case "${1:-}" in arm64-v8a|x86_64) ;; *) exit 2 ;; esac
log=$(mktemp)
trap 'rm -f "$log"' EXIT
compile() {
  ./gradlew assembleRelease --no-daemon "-PreactNativeArchitectures=$1" "${@:2}"
}
if compile "$1" 2>&1 | tee "$log"; then
  exit 0
else
  status=${PIPESTATUS[0]}
fi
if ! grep -Eq 'Received status code (429|502|503|504) from server' "$log"; then
  exit "$status"
fi
if grep -Eq "repo[.]maven[.]apache[.]org.*Received status code (429|502|503|504)" "$log"; then
  echo 'Maven Central indisponible. Reprise avec son miroir public Google Cloud.'
  compile "$1" --init-script "$(dirname "$0")/maven-central-mirror.gradle"
else
  sleep 30
  compile "$1"
fi
