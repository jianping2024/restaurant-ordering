#!/usr/bin/env bash
# Vercel Ignored Build Step for @mesa/web (mesa-web project).
# ignoreCommand runs with cwd = apps/web when Root Directory is apps/web.
# Exit 0 → skip; exit 1 → build.
# Skips when only apps/ops/, apps/print-agent/ (except VERSION), or docs-only paths changed.
# VERSION bumps rebuild web so print-assistant shows the recommended download version.

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURR="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  echo "vercel-ignore-web: no previous SHA ($PREV), building"
  exit 1
fi

diff_out=$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || true)
if [[ -z "$diff_out" ]]; then
  echo "vercel-ignore-web: empty diff, building"
  exit 1
fi

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    apps/print-agent/VERSION)
      echo "vercel-ignore-web: print-agent VERSION changed → building"
      exit 1
      ;;
    apps/ops/*|apps/print-agent/*) ;;
    docs/*) ;;
    *)
      echo "vercel-ignore-web: relevant change: $f → building"
      exit 1
      ;;
  esac
done <<<"$diff_out"

# A follow-up commit may only bump print-agent VERSION while the parent commit had web
# changes still waiting for Production — build so those changes are not skipped.
if git rev-parse "${PREV}^" >/dev/null 2>&1; then
  parent_web=$(git diff --name-only "${PREV}^" "$PREV" 2>/dev/null | grep -E '^apps/web/' || true)
  if [[ -n "$parent_web" ]]; then
    echo "vercel-ignore-web: parent commit had web changes → building"
    exit 1
  fi
fi

echo "vercel-ignore-web: only ops/print-agent/docs changed → skip web build"
exit 0
