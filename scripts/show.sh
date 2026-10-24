#!/usr/bin/env bash
# Prints files from the office. Usage: scripts/show.sh content/drafts   (a folder or a file path under /workspace)
set -euo pipefail
cd "$(dirname "$0")/.."
P="${1:-content/drafts}"
scripts/say.sh "Print the full contents of /workspace/$P (every file if it is a folder), each preceded by a line '=== <path>', verbatim, with no commentary and no three-line report." >/dev/null
scripts/wait.sh | sed -n '/^\[lead\]/,$p'
