#!/usr/bin/env bash
# Opens the office: one long-lived Managed Agents session for the team, with a hard
# dollar cap, BRAND.md mounted, and the first-run message sent.
# Needs: `ant apply agents environments` done (claude-lock.json present), ant auth.
set -euo pipefail
cd "$(dirname "$0")/.."

BUDGET_CENTS="${BUDGET_CENTS:-1000}"   # 1000 = 10.00 USD list-price cap for the whole session

lock() { python3 -I -c 'import json,sys; print(json.load(open("claude-lock.json"))["resources"][sys.argv[1]]["id"])' "$1"; }
AGENT_ID=$(lock "./agents/lead.md")
ENV_ID=$(lock "./environments/cloud.yaml")

FILE_ID=$(ant beta:files upload --file brand/BRAND.md --transform id -r)

SID=$(ant beta:sessions create \
  --agent "$AGENT_ID" \
  --environment-id "$ENV_ID" \
  --title "Marketing office" \
  --budget "{type: limit, max_list_cost: {amount: '$BUDGET_CENTS', currency: USD}}" \
  --resource "{type: file, file_id: $FILE_ID, mount_path: /BRAND.md}" \
  --transform id -r)

mkdir -p .office
echo "$SID" > .office/session_id
echo "Session: $SID"
echo "Console: https://platform.claude.com/workspaces/default/sessions/$SID"

ant beta:sessions:events send --session-id "$SID" \
  --event '{type: user.message, content: [{type: text, text: "@./prompts/first-run.md"}]}' >/dev/null
echo "First-run message sent. Watch with: scripts/watch.sh"
