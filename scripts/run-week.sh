#!/usr/bin/env bash
# Starts this week's cycle in the office session. Usage: scripts/run-week.sh ["note for the team"]
set -euo pipefail
cd "$(dirname "$0")/.."
SID=$(cat .office/session_id)
WEEK="${WEEK:-$(date +%G-W%V)}"
NOTE="${1:-không có}"

TMP=$(mktemp)
sed -e "s/{{WEEK}}/$WEEK/g" -e "s|{{NOTE}}|$NOTE|g" prompts/weekly.md > "$TMP"
ant beta:sessions:events send --session-id "$SID" \
  --event "{type: user.message, content: [{type: text, text: '@$TMP'}]}" >/dev/null
rm -f "$TMP"
echo "Week $WEEK started in session $SID. Watch with: scripts/watch.sh"
