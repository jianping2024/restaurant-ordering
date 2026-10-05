#!/usr/bin/env bash
# Agent delivery gates — shared by Claude Code, Codex, and Cursor agents.
# Policy: scripts/agent-gates/README.md + AGENTS.md Checks.
#
# Order enforced per code state (tree fingerprint):
#   implement → 清冗余 (scan) → UAT → check (lint+typecheck) → commit
#   push → build (+ targeted tests; agents run tests; hook enforces build marker)
#
# Markers live in .mesa-agent-gates/<branch>/ (gitignored). Any edit changes the
# fingerprint and invalidates every marker.
#
#   gate.sh scan     validate scan.md, record scan marker
#   gate.sh check    scoped lint + typecheck → commit gate
#   gate.sh build    scoped production build → push/pack gate
#   gate.sh uat      validate uat.md, record UAT marker
#   gate.sh status
#   gate.sh hook-browser | hook-commit | hook-push   (stdin: PreToolUse JSON)
#
# Block contract (Claude + Codex): exit 2 + reason on stderr.
set -euo pipefail

ROOT="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
# Prefer shared dir; fall back to legacy .claude/gates if it already has markers.
GATE_DIR="$ROOT/.mesa-agent-gates/${BRANCH//\//__}"
LEGACY_GATE_DIR="$ROOT/.claude/gates/${BRANCH//\//__}"
if [[ ! -d "$GATE_DIR" && -d "$LEGACY_GATE_DIR" ]]; then
  GATE_DIR="$LEGACY_GATE_DIR"
fi
PRODUCT_PATHS_RE='^(apps|packages|supabase)/'

# Hash of the product working tree only (apps/packages/supabase, tracked + untracked,
# respecting .gitignore), independent of staging — docs/AGENTS edits never invalidate it.
fingerprint() {
  local tmp
  tmp="$(mktemp)"
  cp "$(git rev-parse --git-path index)" "$tmp" 2>/dev/null || true
  GIT_INDEX_FILE="$tmp" git add -A -- apps packages supabase >/dev/null 2>&1
  GIT_INDEX_FILE="$tmp" git ls-files -s -- apps packages supabase | git hash-object --stdin
  rm -f "$tmp"
}

base_ref() {
  git merge-base main HEAD 2>/dev/null || git rev-parse HEAD
}

# Product files that differ from main (committed on branch, uncommitted, or untracked).
changed_product_files() {
  {
    git diff --name-only "$(base_ref)"
    git ls-files --others --exclude-standard
  } | grep -E "$PRODUCT_PATHS_RE" | sort -u || true
}

# Uncommitted product WIP only (tracked dirty + untracked). Clean trees may retest without scan.
wip_product_files() {
  {
    git diff --name-only HEAD
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | grep -E "$PRODUCT_PATHS_RE" | sort -u || true
}

marker_ok() {
  local name="$1" fp="$2"
  [[ -f "$GATE_DIR/$name.sha" && "$(cat "$GATE_DIR/$name.sha")" == "$fp" ]]
}

record() {
  mkdir -p "$GATE_DIR"
  echo "$2" >"$GATE_DIR/$1.sha"
}

die() {
  echo "$*" >&2
  exit 1
}

cmd_scan() {
  local report="$GATE_DIR/scan.md" files missing=()
  [[ -f "$report" ]] || die "缺少清冗余报告：${report}（需含「## 改动文件」「## 共用组件调用方」「## 发现与处理」三节）"
  for h in '## 改动文件' '## 共用组件调用方' '## 发现与处理'; do
    grep -qF "$h" "$report" || die "清冗余报告缺少小节：$h"
  done
  files="$(changed_product_files)"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    grep -qF "$f" "$report" || missing+=("$f")
  done <<<"$files"
  if ((${#missing[@]})); then
    printf '清冗余报告没有逐个交代这些改动文件：\n' >&2
    printf '  %s\n' "${missing[@]}" >&2
    exit 1
  fi
  record scan "$(fingerprint)"
  echo "清冗余标记已记录（指纹 $(cat "$GATE_DIR/scan.sha" | cut -c1-12)）"
}

cmd_check() {
  local files fp web=0 ops=0
  fp="$(fingerprint)"
  marker_ok scan "$fp" || die "当前代码还没通过清冗余（gate.sh scan），不能进入 lint/typecheck。"
  files="$(changed_product_files)"
  grep -qE '^(apps/web|packages)/' <<<"$files" && web=1
  grep -qE '^(apps/ops|packages)/' <<<"$files" && ops=1
  if ((web)); then
    npm run lint -w @mesa/web
    npm run typecheck -w @mesa/web
  fi
  if ((ops)); then
    npm run lint -w @mesa/ops
    npm run typecheck -w @mesa/ops
  fi
  [[ "$(fingerprint)" == "$fp" ]] || die "lint/typecheck 期间代码有变动，检查标记不记录。"
  record check "$fp"
  # Prefer ${web}/${ops}: bare $ops） is parsed as unset var "ops）" under set -u.
  echo "检查标记已记录（lint+typecheck web=${web} ops=${ops}）"
}

cmd_build() {
  local files fp web=0 ops=0
  fp="$(fingerprint)"
  files="$(changed_product_files)"
  grep -qE '^(apps/web|packages)/' <<<"$files" && web=1
  grep -qE '^(apps/ops|packages)/' <<<"$files" && ops=1
  if ((web)); then
    # Separate distDir: never clobber a running `next dev` on the default apps/web/.next.
    MESA_NEXT_DIST_DIR=.next-typecheck npm run build -w @mesa/web
  fi
  if ((ops)); then
    if lsof -ti :3001 -sTCP:LISTEN >/dev/null 2>&1; then
      die "ops dev 正占用 :3001 且 ops 构建会写默认 apps/ops/.next；请先停 ops dev 再构建。"
    fi
    npm run build -w @mesa/ops
  fi
  [[ "$(fingerprint)" == "$fp" ]] || die "构建期间代码有变动，构建标记不记录。"
  record build "$fp"
  echo "构建标记已记录（web=${web} ops=${ops}）— 供 push/pack；不是 commit 门禁"
}

cmd_uat() {
  local report="$GATE_DIR/uat.md" fp
  fp="$(fingerprint)"
  marker_ok scan "$fp" || die "当前代码还没通过清冗余（gate.sh scan），实测结果不算数。"
  [[ -f "$report" ]] || die "缺少实测报告：${report}（需含「## 测试项」，逐项写 pass）"
  grep -qF '## 测试项' "$report" || die "实测报告缺少「## 测试项」"
  grep -qiE '\bpass\b|通过' "$report" || die "实测报告没有任何通过项"
  if grep -qiE '\bfail\b|未通过' "$report"; then
    die "实测报告里有失败项，修好并重测后再记录。"
  fi
  record uat "$fp"
  echo "实测标记已记录"
}

cmd_status() {
  local fp
  fp="$(fingerprint)"
  echo "branch=$BRANCH fingerprint=${fp:0:12}"
  for m in scan uat check; do
    if marker_ok "$m" "$fp"; then echo "  $m: ok"; else echo "  $m: missing/stale"; fi
  done
  if marker_ok build "$fp"; then echo "  build: ok (push/pack helper)"; else echo "  build: missing/stale (ok for commit; required before push)"; fi
  echo "changed product files:"
  changed_product_files | sed 's/^/  /'
}

block() {
  echo "$*" >&2
  exit 2
}

cmd_hook_browser() {
  cat >/dev/null
  # Only uncommitted product WIP blocks browser. Committed-on-branch (clean tree) may retest.
  [[ -n "$(wip_product_files)" ]] || exit 0
  marker_ok scan "$(fingerprint)" && exit 0
  block "【门禁】当前有未提交的产品改动，还没清冗余，禁止开始浏览器测试。先写 $GATE_DIR/scan.md（改动文件 / 共用组件调用方 / 发现与处理），再运行 bash scripts/agent-gates/gate.sh scan。见 scripts/agent-gates/README.md。工作区干净时可直接复测。"
}

cmd_hook_commit() {
  local input command fp missing=()
  input="$(cat)"
  command="$(jq -r '.tool_input.command // ""' <<<"$input")"
  # Any `git … commit` segment (incl. `git -C dir commit`, `cd x && git commit`).
  grep -qE '(^|[;&|[:space:]])git[[:space:]][^;&|]*\bcommit([[:space:]]|$)' <<<"$command" || exit 0
  # Conflict-resolution commit of a merge: content was gated on its branch.
  [[ -f "$(git rev-parse --git-path MERGE_HEAD)" ]] && exit 0
  [[ -n "$(changed_product_files)" ]] || exit 0
  fp="$(fingerprint)"
  marker_ok scan "$fp" || missing+=("清冗余（gate.sh scan）")
  marker_ok uat "$fp" || missing+=("实测（gate.sh uat）")
  marker_ok check "$fp" || missing+=("lint+typecheck（gate.sh check）")
  ((${#missing[@]} == 0)) && exit 0
  block "【门禁】提交被拦：当前代码缺少 ${missing[*]}。标记必须和当前代码指纹一致，改过代码要重新走一遍。见 scripts/agent-gates/README.md"
}

cmd_hook_push() {
  local input command fp
  input="$(cat)"
  command="$(jq -r '.tool_input.command // ""' <<<"$input")"
  # Any `git … push` segment.
  grep -qE '(^|[;&|[:space:]])git[[:space:]][^;&|]*\bpush([[:space:]]|$)' <<<"$command" || exit 0
  [[ -n "$(changed_product_files)" ]] || exit 0
  fp="$(fingerprint)"
  # Push needs production build marker. Targeted unit tests stay agent policy (AGENTS.md).
  marker_ok build "$fp" || block "【门禁】推送被拦：产品改动尚未通过生产构建（gate.sh build）。commit 用 lint+typecheck；push 才 build+test。见 scripts/agent-gates/README.md"
  exit 0
}

case "${1:-}" in
  fingerprint) fingerprint ;;
  scan) cmd_scan ;;
  check) cmd_check ;;
  build) cmd_build ;;
  uat) cmd_uat ;;
  status) cmd_status ;;
  hook-browser) cmd_hook_browser ;;
  hook-commit) cmd_hook_commit ;;
  hook-push) cmd_hook_push ;;
  *) die "usage: gate.sh scan|check|build|uat|status|fingerprint|hook-browser|hook-commit|hook-push" ;;
esac
