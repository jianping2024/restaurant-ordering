#!/usr/bin/env bash
# Run before tagging print-agent-v* — same checks as print-agent-ci.yml / release test-linux job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="$ROOT/apps/print-agent"
VERSION="$(tr -d '\r\n' < "$AGENT/VERSION")"

run_in_agent() {
  local cmd="$1"
  if command -v go >/dev/null 2>&1; then
    (cd "$AGENT" && eval "$cmd")
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -v "$AGENT:/app" -w /app golang:1.22-bookworm bash -lc "$cmd"
    return
  fi
  echo "Need Go or Docker to run print-agent checks." >&2
  exit 1
}

echo "print-agent VERSION=$VERSION"
run_in_agent "go test ./... && go vet ./..."
echo "OK — safe to tag: git tag print-agent-v$VERSION && git push origin print-agent-v$VERSION"
echo "Then wait for Actions → Print agent release (green) before telling users to download."
