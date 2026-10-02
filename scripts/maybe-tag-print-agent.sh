#!/usr/bin/env bash
# After push to main: apply print-agent-v{VERSION} when code changed (see apply-print-agent-tag.sh).
# Kept as a stable entry point for print-agent tagging helpers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/apply-print-agent-tag.sh"
