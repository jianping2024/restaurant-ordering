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

"$ROOT/scripts/validate-print-agent-release.sh"
"$ROOT/scripts/apply-print-agent-tag.sh"
