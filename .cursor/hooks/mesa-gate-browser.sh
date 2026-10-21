#!/usr/bin/env bash
# Cursor beforeMCPExecution for browser MCP → same gate.sh hook-browser (清冗余 before browser UAT).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GATE="$ROOT/scripts/agent-gates/gate.sh"
input="$(cat)"

# Browser MCP has no shell command; invent empty command so hook-browser only checks WIP+scan.
norm="$(jq -c '{tool_input: {command: (.command // "")}}' <<<"$input")"

set +e
err="$(echo "$norm" | bash "$GATE" hook-browser 2>&1 >/dev/null)"
ec=$?
set -e

if [[ "$ec" -eq 2 ]]; then
  jq -n --arg m "$err" '{permission:"deny",user_message:$m,agent_message:$m}'
  exit 2
fi
if [[ "$ec" -ne 0 ]]; then
  jq -n --arg m "gate.sh hook-browser failed (exit $ec): $err" \
    '{permission:"deny",user_message:$m,agent_message:$m}'
  exit 2
fi
echo '{"permission":"allow"}'
exit 0
