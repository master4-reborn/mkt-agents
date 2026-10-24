#!/usr/bin/env bash
# Sends one message to the lead. Usage: scripts/say.sh "approve content/drafts/2026-11-02-matcha.md"
set -euo pipefail
cd "$(dirname "$0")/.."
SID=$(cat .office/session_id)
TMP=$(mktemp); printf '%s' "$1" > "$TMP"
ant beta:sessions:events send --session-id "$SID" \
  --event "{type: user.message, content: [{type: text, text: '@$TMP'}]}" >/dev/null
rm -f "$TMP"
echo "Sent."
