#!/usr/bin/env bash
# Streams the office session's events (Ctrl-C to stop). Only text and tool names, not full payloads.
set -euo pipefail
cd "$(dirname "$0")/.."
SID=$(cat .office/session_id)
ant beta:sessions:events stream --session-id "$SID" --format jsonl \
  | python3 -I -c '
import json,sys
for line in sys.stdin:
    try: e=json.loads(line)
    except Exception: continue
    t=e.get("type","")
    if t=="agent.message":
        print("\n[lead]", "".join(b.get("text","") for b in e.get("content",[]) if b.get("type")=="text"))
    elif t in ("agent.tool_use","agent.mcp_tool_use"):
        print(f"  tool: {e.get(\"name\")}")
    elif t.startswith("session.status"):
        print(f"-- {t} {json.dumps(e.get(\"stop_reason\",\"\"))}")
    elif t=="session.error":
        print("!! error:", json.dumps(e)[:500])
'
