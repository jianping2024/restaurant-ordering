#!/usr/bin/env bash
# Cursor beforeShellExecution → same gate.sh hook-commit / hook-push as Claude/Codex.
# stdin: Cursor JSON ({"command":"..."}) or Claude shape ({"tool_input":{"command":"..."}}).
# Block: exit 2 + deny JSON (failClosed in hooks.json).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GATE="$ROOT/scripts/agent-gates/gate.sh"
input="$(cat)"

norm="$(jq -c '
  if (.tool_input.command // null) != null then .
  elif (.command // null) != null then {tool_input: {command: .command}}
  else {tool_input: {command: ""}}
  end
' <<<"$input")"

run_hook() {
  local name="$1" err ec
  set +e
  err="$(echo "$norm" | bash "$GATE" "$name" 2>&1 >/dev/null)"
  ec=$?
  set -e
  if [[ "$ec" -eq 2 ]]; then
    jq -n --arg m "$err" '{permission:"deny",user_message:$m,agent_message:$m}'
    exit 2
  fi
  if [[ "$ec" -ne 0 ]]; then
    # Unexpected hook failure: fail closed (hooks.json failClosed).
    jq -n --arg m "gate.sh $name failed (exit $ec): $err" \
      '{permission:"deny",user_message:$m,agent_message:$m}'
    exit 2
  fi
}

run_hook hook-commit
run_hook hook-push
echo '{"permission":"allow"}'
exit 0
