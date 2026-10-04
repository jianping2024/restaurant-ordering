#!/usr/bin/env bash
# Agent delivery gates (Claude Code PreToolUse hooks in .claude/settings.json).
#
# Order enforced per code state (tree fingerprint):
#   implement → 清冗余 (scan) → UAT (browser) → build → commit
#
# Markers live in .claude/gates/<branch>/ (gitignored) and store the tree fingerprint
# they were recorded at. Any edit changes the fingerprint and invalidates every marker.
#
#   gate.sh scan     validate .claude/gates/<branch>/scan.md, record scan marker
#   gate.sh build    run scoped production build(s), record build marker on success
#   gate.sh uat      validate .claude/gates/<branch>/uat.md, record UAT marker
#   gate.sh status   show markers vs current fingerprint
#   gate.sh hook-browser | hook-commit   (hook entry points; read hook JSON on stdin)
set -euo pipefail

ROOT="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
GATE_DIR="$ROOT/.claude/gates/${BRANCH//\//__}"
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
  [[ -f "$report" ]] || die "缺少清冗余报告：$report（需含「## 改动文件」「## 共用组件调用方」「## 发现与处理」三节）"
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

cmd_build() {
  local files fp web=0 ops=0
  fp="$(fingerprint)"
  marker_ok scan "$fp" || die "当前代码还没通过清冗余（gate.sh scan），不能进入构建。"
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
  echo "构建标记已记录（web=$web ops=$ops）"
}

cmd_uat() {
  local report="$GATE_DIR/uat.md" fp
  fp="$(fingerprint)"
  marker_ok scan "$fp" || die "当前代码还没通过清冗余（gate.sh scan），实测结果不算数。"
  [[ -f "$report" ]] || die "缺少实测报告：$report（需含「## 测试项」，逐项写 pass）"
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
  for m in scan uat build; do
    if marker_ok "$m" "$fp"; then echo "  $m: ok"; else echo "  $m: missing/stale"; fi
  done
  echo "changed product files:"
  changed_product_files | sed 's/^/  /'
}

block() {
  echo "$*" >&2
  exit 2
}

cmd_hook_browser() {
  cat >/dev/null
  [[ -n "$(changed_product_files)" ]] || exit 0
  marker_ok scan "$(fingerprint)" && exit 0
  block "【门禁】当前代码还没清冗余，禁止开始浏览器测试。先逐行看 diff、列出改动过的共用组件的全部调用方，写 $GATE_DIR/scan.md，再运行 bash scripts/agent-gates/gate.sh scan。改过代码后需要重新清冗余。"
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
  marker_ok build "$fp" || missing+=("生产构建（gate.sh build）")
  ((${#missing[@]} == 0)) && exit 0
  block "【门禁】提交被拦：当前代码缺少 ${missing[*]}。标记必须和当前代码指纹一致，改过代码要重新走一遍。"
}

case "${1:-}" in
  fingerprint) fingerprint ;;
  scan) cmd_scan ;;
  build) cmd_build ;;
  uat) cmd_uat ;;
  status) cmd_status ;;
  hook-browser) cmd_hook_browser ;;
  hook-commit) cmd_hook_commit ;;
  *) die "usage: gate.sh scan|build|uat|status|fingerprint|hook-browser|hook-commit" ;;
esac
