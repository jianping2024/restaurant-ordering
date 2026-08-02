#!/usr/bin/env bash
# Sole on-prem readiness check for license URL + durable config + required runtime params.
# Phases:
#   install     — URL + compose mount + .env essentials (no platform.json)
#   post-claim  — after /setup: platform.json trio must be complete (hard fail)
#   upgrade     — install checks; if platform.json exists validate it; if missing
#                 WARN only (recovery via /setup must not block upgrade)
#
# Usage (from deploy/on-prem):
#   ./scripts/verify-on-prem-ready.sh install
#   ./scripts/verify-on-prem-ready.sh post-claim
#   ./scripts/verify-on-prem-ready.sh upgrade
set -euo pipefail

PHASE="${1:-}"
ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${MESA_ONPREM_ENV:-$ONPREM_DIR/.env}"
COMPOSE_YAML="${MESA_ONPREM_COMPOSE:-$ONPREM_DIR/compose.yaml}"
LICENSE_STATE_DIR="${MESA_LICENSE_STATE_DIR:-$ONPREM_DIR/license-state}"
PLATFORM_JSON="${MESA_LICENSE_PLATFORM_JSON:-$LICENSE_STATE_DIR/platform.json}"

die() { printf '[mesa-verify] ERROR: %s\n' "$*" >&2; exit 1; }
ok() { printf '[mesa-verify] OK: %s\n' "$*"; }
warn() { printf '[mesa-verify] WARN: %s\n' "$*" >&2; }
usage() {
  cat <<EOF
Usage: $0 <install|post-claim|upgrade>
EOF
}

[[ -n "$PHASE" ]] || { usage >&2; exit 2; }

env_val() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s' "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

require_env_nonempty() {
  local key="$1"
  local val
  val="$(env_val "$key" || true)"
  [[ -n "$val" ]] || die "missing or empty ${key} in ${ENV_FILE}"
  ok "${key} set"
}

check_platform_json() {
  [[ -f "$PLATFORM_JSON" ]] || die "missing ${PLATFORM_JSON} — complete /setup claim first"
  command -v python3 >/dev/null 2>&1 || die "python3 required to validate platform.json"
  python3 - "$PLATFORM_JSON" <<'PY' || die "platform.json incomplete (need platformUrl, checkinCredential, leaseSecret)"
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
for key in ("platformUrl", "checkinCredential", "leaseSecret"):
    val = data.get(key)
    if not isinstance(val, str) or not val.strip():
        raise SystemExit(1)
PY
  ok "platform.json trio complete (${PLATFORM_JSON})"
}

check_install() {
  [[ -f "$ENV_FILE" ]] || die "missing .env — run bootstrap-mode-b.sh / install first (${ENV_FILE})"
  [[ -f "$COMPOSE_YAML" ]] || die "missing compose.yaml (${COMPOSE_YAML})"

  grep -q 'license-state:/mesa-license-state' "$COMPOSE_YAML" \
    || die "compose.yaml must bind-mount license-state → /mesa-license-state"
  grep -q 'MESA_LICENSE_CONFIG_PATH: /mesa-license-state/platform.json' "$COMPOSE_YAML" \
    || die "compose.yaml must set MESA_LICENSE_CONFIG_PATH=/mesa-license-state/platform.json"
  ok "compose license-state mount + CONFIG_PATH"

  mkdir -p "$LICENSE_STATE_DIR"
  ok "license-state dir ${LICENSE_STATE_DIR}"

  # Pack pre-configures only the Ops URL; credentials arrive at /setup claim.
  require_env_nonempty MESA_PLATFORM_LICENSE_URL
  require_env_nonempty MESA_ON_PREM
  require_env_nonempty NEXT_PUBLIC_BASE_URL
  require_env_nonempty PRINT_AGENT_JWT_SECRET
  require_env_nonempty STAFF_SESSION_SECRET
  require_env_nonempty JWT_SECRET
  require_env_nonempty ANON_KEY
  require_env_nonempty SERVICE_ROLE_KEY
  require_env_nonempty POSTGRES_PASSWORD

  # Fail closed: must not require pack-shipped lease/checkin secrets.
  if env_val MESA_LICENSE_LEASE_SECRET >/dev/null 2>&1; then
    local lease
    lease="$(env_val MESA_LICENSE_LEASE_SECRET || true)"
    if [[ -n "$lease" ]]; then
      warn "MESA_LICENSE_LEASE_SECRET in .env is unused for claim; prefer license-state after /setup"
    fi
  fi
}

case "$PHASE" in
  install)
    check_install
    ok "phase install passed (claim platform.json not required yet)"
    ;;
  post-claim)
    check_install
    check_platform_json
    ok "phase post-claim passed"
    ;;
  upgrade)
    check_install
    if [[ -f "$PLATFORM_JSON" ]]; then
      check_platform_json
      ok "phase upgrade passed (license-state present)"
    else
      warn "missing ${PLATFORM_JSON} — upgrade continues; open /setup with install code to claim, then run: ./scripts/verify-on-prem-ready.sh post-claim"
      ok "phase upgrade passed (claim pending via /setup)"
    fi
    ;;
  *)
    usage >&2
    die "unknown phase: ${PHASE}"
    ;;
esac
