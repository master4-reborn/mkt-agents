#!/usr/bin/env bash
# Waits until the office is idle (max 20 min), then prints the lead's messages since the last user message.
set -euo pipefail
cd "$(dirname "$0")/.."
SID=$(cat .office/session_id)
for i in $(seq 1 120); do
  ST=$(ant beta:sessions retrieve --session-id "$SID" --transform status -r 2>/dev/null || echo "?")
  [ "$ST" = "idle" ] && [ "$i" -gt 2 ] && break
  sleep 10
done
echo "status=$ST after $((i*10))s"
ant beta:sessions retrieve --session-id "$SID" --transform '{stop_reason,usage.list_cost}' --format json 2>/dev/null
ant beta:sessions:events list --session-id "$SID" --format jsonl 2>/dev/null | python3 -I -c '
import json,sys
evs=[json.loads(l) for l in sys.stdin if l.strip()]
# keep everything after the last user.message
last=max((i for i,e in enumerate(evs) if e.get("type")=="user.message"), default=-1)
for e in evs[last+1:]:
    t=e.get("type","")
    if t=="agent.message":
        print("[lead]", "".join(b.get("text","") for b in e.get("content",[]) if b.get("type")=="text")); print()
    elif t in ("agent.tool_use","agent.mcp_tool_use"):
        n=e.get("name"); inp=e.get("input",{})
        if n=="send_to_agent": print("  -> agent:", json.dumps(inp)[:200])
        else: print("  tool:", n, json.dumps(inp)[:120])
    elif t=="session.error":
        print("!! error:", json.dumps(e)[:600])
'
