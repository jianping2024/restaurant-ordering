#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# Exit 0 → skip deployment; exit 1 → run npm run build.
#
# Skips when every changed file is under apps/print-agent/ (installer, Go agent, VERSION).
# Any change outside that tree (src/, supabase/, package.json, docs/, …) still deploys.

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURR="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  echo "vercel-ignore-build: no previous SHA ($PREV), building"
  exit 1
fi

diff_out=$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || true)
if [[ -z "$diff_out" ]]; then
  echo "vercel-ignore-build: empty diff, building"
  exit 1
fi

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    apps/print-agent/*) ;;
    *)
      echo "vercel-ignore-build: non-agent change: $f → building"
      exit 1
      ;;
  esac
done <<<"$diff_out"

echo "vercel-ignore-build: only apps/print-agent/ changed → skip Vercel build"
exit 0
