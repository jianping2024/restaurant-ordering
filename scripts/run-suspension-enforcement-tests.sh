#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"
set -a
# shellcheck source=/dev/null
source "$ROOT/.env.local"
set +a
export TEST_BASE_URL="${TEST_BASE_URL:-http://localhost:3000}"
node --import tsx "$ROOT/scripts/test-suspension-enforcement.ts"
