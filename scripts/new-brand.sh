#!/usr/bin/env bash
# Creates (or replaces) the brand card from one sentence. The lead drafts BRAND.md,
# research finds competitors and risky words, and the lead asks you at most 3 questions.
# Usage: scripts/new-brand.sh "bán matcha cho dân văn phòng Hà Nội, đăng Threads, xưng mình/bạn"
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -ge 1 ] || { echo "usage: $0 \"<what you sell, to whom, which channel>\""; exit 1; }
SID=$(cat .office/session_id)
TMP=$(mktemp); printf 'New brand: %s' "$1" > "$TMP"
ant beta:sessions:events send --session-id "$SID" \
  --event "{type: user.message, content: [{type: text, text: '@$TMP'}]}" >/dev/null
rm -f "$TMP"
echo "Brand request sent. Watch with: scripts/watch.sh"
