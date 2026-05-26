#!/usr/bin/env bash
# Run before tagging print-agent-v* — same checks as print-agent-ci.yml / release test-linux job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="$ROOT/apps/print-agent"
VERSION="$(tr -d '\r\n' < "$AGENT/VERSION")"

agent_go_works() {
  command -v go >/dev/null 2>&1 && (cd "$AGENT" && go version >/dev/null 2>&1)
}

docker_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

run_go_checks() {
  if agent_go_works; then
    echo "Using local Go..."
    (cd "$AGENT" && go test ./... && go vet ./...)
    return
  fi
  if docker_available; then
    echo "Using Docker (golang:1.22-bookworm)..."
    docker run --rm \
      -v "$AGENT:/app" \
      -w /app \
      golang:1.22-bookworm \
      sh -ce 'go test ./... && go vet ./...'
    return
  fi
  echo "Need Go 1.22+ or Docker to run print-agent checks." >&2
  exit 1
}

echo "print-agent VERSION=$VERSION"
run_go_checks
echo "OK — safe to tag: git tag print-agent-v$VERSION && git push origin print-agent-v$VERSION"
echo "Then wait for Actions → Print agent release (green) before telling users to download."
