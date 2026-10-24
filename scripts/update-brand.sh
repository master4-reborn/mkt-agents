#!/usr/bin/env bash
# Sends the current brand/BRAND.md to the office and asks the lead to replace its copy.
set -euo pipefail
cd "$(dirname "$0")/.."
SID=$(cat .office/session_id)
TMP=$(mktemp)
{
  printf 'Replace /workspace/brand/BRAND.md with the file below, exactly as written, then re-read it and tell me in three lines whether anything is still a placeholder.\n\n'
  cat brand/BRAND.md
} > "$TMP"
ant beta:sessions:events send --session-id "$SID" \
  --event "{type: user.message, content: [{type: text, text: '@$TMP'}]}" >/dev/null
rm -f "$TMP"
echo "BRAND.md sent to the office."
