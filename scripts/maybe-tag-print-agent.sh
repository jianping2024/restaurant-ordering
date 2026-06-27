#!/usr/bin/env bash
# After push to main: tag print-agent-v{VERSION} when apps/print-agent changed.
#
# Env:
#   PUSH_SKIP_PRINT_AGENT_TAG=1 — skip auto-tag
set -euo pipefail

if [[ "${PUSH_SKIP_PRINT_AGENT_TAG:-}" == "1" ]]; then
  echo "Print agent auto-tag skipped (PUSH_SKIP_PRINT_AGENT_TAG=1)."
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="apps/print-agent"
VERSION_FILE="$ROOT/$AGENT_DIR/VERSION"

if [[ ! -f "$VERSION_FILE" ]]; then
  exit 0
fi

VER="$(tr -d '\r\n' < "$VERSION_FILE")"
TAG="print-agent-v${VER}"

git fetch origin --tags --quiet 2>/dev/null || true

latest_tag=""
latest_tag="$(git tag -l 'print-agent-v*' --sort=-v:refname 2>/dev/null | head -1 || true)"

if [[ -n "$latest_tag" ]]; then
  if git diff --quiet "$latest_tag" HEAD -- "$AGENT_DIR"; then
    echo "Print agent unchanged since ${latest_tag}; no new tag."
    exit 0
  fi
  echo "Print agent changed since ${latest_tag}."
else
  echo "No prior print-agent-v* tag; will create ${TAG}."
fi

# Tag for this VERSION already exists locally or on origin.
if git rev-parse "refs/tags/${TAG}" >/dev/null 2>&1; then
  tag_commit="$(git rev-parse "refs/tags/${TAG}^{commit}")"
  head_commit="$(git rev-parse HEAD)"
  if [[ "$tag_commit" == "$head_commit" ]]; then
    echo "Tag ${TAG} already points at this commit."
    exit 0
  fi
  echo "ERROR: ${AGENT_DIR} changed but VERSION is still ${VER} and tag ${TAG} exists." >&2
  echo "Bump ${VERSION_FILE} (e.g. 0.2.32) and run pnpm push again." >&2
  exit 1
fi

if git ls-remote --exit-code origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  remote_commit="$(git ls-remote origin "refs/tags/${TAG}" | awk '{print $1}')"
  head_commit="$(git rev-parse HEAD)"
  if [[ "$remote_commit" == "$head_commit" ]]; then
    echo "Tag ${TAG} already on origin for this commit."
    exit 0
  fi
  echo "ERROR: ${AGENT_DIR} changed but tag ${TAG} already exists on origin." >&2
  echo "Bump ${VERSION_FILE} and run pnpm push again." >&2
  exit 1
fi

echo "Running print-agent checks before tagging ${TAG}..."
"$ROOT/scripts/check-print-agent.sh"
if ! bash "$ROOT/scripts/print-agent-release-body.sh" "$VER" >/dev/null; then
  echo "ERROR: Add '## ${VER}' to apps/print-agent/RELEASE_NOTES.md before tagging." >&2
  exit 1
fi

git tag "$TAG"
echo "Pushing tag ${TAG}..."
git push origin "$TAG" 2>&1 | grep -v 'could not write config file' || true

echo ""
echo "Tagged ${TAG}. Wait for GitHub Actions → Print agent release (green)."
echo "Then confirm Release has MesaPrintAgent-Setup-amd64.exe."
