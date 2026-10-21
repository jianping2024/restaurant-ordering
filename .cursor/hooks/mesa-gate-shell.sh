#!/usr/bin/env bash
# Cursor beforeShellExecution → same gate.sh hook-commit / hook-push as Claude/Codex.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GATE="$ROOT/scripts/agent-gates/gate.sh"
input="$(cat)"

# Old/detached trees without gate.sh: fail open (avoid Cursor failClosed lockout).
if [[ ! -f "$GATE" ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

cmd="$(jq -r '.tool_input.command // .command // empty' <<<"$input" 2>/dev/null || true)"
workdir="$(jq -r '.tool_input.working_directory // .working_directory // empty' <<<"$input" 2>/dev/null || true)"
# Shell that only targets another git repo (e.g. farvoo-fatura) must not use Mesa gates.
allow_if_foreign_git_root() {
  local dir="$1" other=""
  [[ -n "$dir" ]] || return 1
  dir="${dir/#\~/$HOME}"
  other="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "$other" && ! -f "$other/scripts/agent-gates/gate.sh" ]] || return 1
  echo '{"permission":"allow"}'
  exit 0
}
# `|| true`: under set -e, a non-match return must not abort this hook (failClosed).
if [[ -n "$workdir" ]]; then
  allow_if_foreign_git_root "$workdir" || true
fi
if [[ -n "$cmd" ]]; then
  target=""
  if [[ "$cmd" =~ git[[:space:]]+-C[[:space:]]+[\"\']?([^\"\'[:space:]]+) ]]; then
    target="${BASH_REMATCH[1]}"
  elif [[ "$cmd" =~ (^|[\;\&\|[:space:]])cd[[:space:]]+[\"\']?([^\"\'[:space:]\;\&\|]+) ]]; then
    target="${BASH_REMATCH[2]}"
  fi
  if [[ -n "$target" ]]; then
    allow_if_foreign_git_root "$target" || true
  fi
fi

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
    jq -n --arg m "gate.sh $name failed (exit $ec): $err" \
      '{permission:"deny",user_message:$m,agent_message:$m}'
    exit 2
  fi
}

run_hook hook-commit
run_hook hook-push
echo '{"permission":"allow"}'
exit 0
