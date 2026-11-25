#!/usr/bin/env bash
# Une deuxième résolution Maven est possible après un refus temporaire du dépôt.
set -euo pipefail
case "${1:-}" in arm64-v8a|x86_64) ;; *) exit 2 ;; esac
log=$(mktemp)
trap 'rm -f "$log"' EXIT
compile() {
  ./gradlew assembleRelease --no-daemon "-PreactNativeArchitectures=$1"
}
if compile "$1" 2>&1 | tee "$log"; then
  exit 0
else
  status=${PIPESTATUS[0]}
fi
if ! grep -Eq 'Received status code (429|502|503|504) from server' "$log"; then
  exit "$status"
fi
echo 'Le dépôt Maven a temporairement refusé le téléchargement. Nouvel essai dans 30 secondes.'
sleep 30
compile "$1"
