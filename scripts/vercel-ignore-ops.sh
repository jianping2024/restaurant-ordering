#!/usr/bin/env bash
# Vercel Ignored Build Step for @mesa/ops (mesa-ops project).
# Exit 0 → skip; exit 1 → build.
# Skips when only apps/web/, apps/print-agent/, or docs-only paths changed.

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURR="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  echo "vercel-ignore-ops: no previous SHA ($PREV), building"
  exit 1
fi

diff_out=$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || true)
if [[ -z "$diff_out" ]]; then
  echo "vercel-ignore-ops: empty diff, building"
  exit 1
fi

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    apps/web/*|apps/print-agent/*) ;;
    docs/*) ;;
    *)
      echo "vercel-ignore-ops: relevant change: $f → building"
      exit 1
      ;;
  esac
done <<<"$diff_out"

echo "vercel-ignore-ops: only web/print-agent/docs changed → skip ops build"
exit 0
