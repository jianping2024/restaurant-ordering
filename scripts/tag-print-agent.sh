#!/usr/bin/env bash
# Bump-safe tag helper: run tests, ensure VERSION matches tag, push tag.
#
# Usage:
#   ./scripts/tag-print-agent.sh              # tag print-agent-v$(cat VERSION)
#   ./scripts/tag-print-agent.sh 0.2.31       # set VERSION + tag (commits VERSION only)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT/apps/print-agent/VERSION"
TAG_VER="${1:-}"

if [[ -n "$TAG_VER" ]]; then
  echo "$TAG_VER" > "$VERSION_FILE"
  git add "$VERSION_FILE"
  git commit -m "Bump print-agent to v$TAG_VER."
fi

"$ROOT/scripts/check-print-agent.sh"

VER="$(tr -d '\r\n' < "$VERSION_FILE")"
if ! bash "$ROOT/scripts/print-agent-release-body.sh" "$VER" >/dev/null; then
  echo "Add a '## $VER' section to apps/print-agent/RELEASE_NOTES.md before tagging." >&2
  exit 1
fi

TAG="print-agent-v$VER"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists locally." >&2
  exit 1
fi

git tag "$TAG"
echo "Created $TAG — push with: git push origin $TAG"
