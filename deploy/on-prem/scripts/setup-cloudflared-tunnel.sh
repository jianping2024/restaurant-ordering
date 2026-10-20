#!/usr/bin/env bash
# Install Cloudflare Tunnel connector on a Mode B store host (optional; per-store token).
# Does NOT create the Tunnel / Public Hostname in the Cloudflare dashboard — do that first,
# then run this with the connector token + https origin.
#
# Usage (on store, as root):
#   sudo MESA_HOME=/opt/mesa ./scripts/setup-cloudflared-tunnel.sh \
#     --token '<from Zero Trust → Create Tunnel>' \
#     --origin https://grandefortuna.farvoo.com
#
# Env alternatives: MESA_CLOUDFLARED_TOKEN, MESA_TUNNEL_ORIGIN
#
# Also:
#   --install-package-only   apt-only (no token)
#   --skip-apt               assume cloudflared already installed
#   --skip-auth-recreate     patch .env only; you recreate auth later
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MESA_HOME="${MESA_HOME:-/opt/mesa}"
ENV_FILE="${MESA_ENV_FILE:-$ONPREM_DIR/.env}"
TOKEN="${MESA_CLOUDFLARED_TOKEN:-}"
ORIGIN="${MESA_TUNNEL_ORIGIN:-}"
TOKEN_FILE=""
SKIP_APT=0
SKIP_AUTH_RECREATE=0
PACKAGE_ONLY=0

usage() {
  cat <<EOF
Usage: sudo $0 [options]

Options:
  --token TOKEN              Cloudflare connector token (from Zero Trust UI)
  --token-file PATH          Read token from file (single line)
  --origin https://HOST      Public HTTPS origin → ADDITIONAL_REDIRECT_URLS + MESA_TUNNEL_ORIGIN
  --install-package-only     Only apt-install cloudflared
  --skip-apt                 Do not apt-install
  --skip-auth-recreate       Do not force-recreate auth after .env patch
  -h, --help

Env: MESA_HOME, MESA_CLOUDFLARED_TOKEN, MESA_TUNNEL_ORIGIN, MESA_ENV_FILE
EOF
}

log() { printf '[mesa-tunnel-setup] %s\n' "$*"; }
warn() { printf '[mesa-tunnel-setup] WARN: %s\n' "$*" >&2; }
die() { printf '[mesa-tunnel-setup] ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="${2:?}"
      shift 2
      ;;
    --token-file)
      TOKEN_FILE="${2:?}"
      shift 2
      ;;
    --origin)
      ORIGIN="${2:?}"
      shift 2
      ;;
    --install-package-only) PACKAGE_ONLY=1; shift ;;
    --skip-apt) SKIP_APT=1; shift ;;
    --skip-auth-recreate) SKIP_AUTH_RECREATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  die "run as root (sudo)"
fi

if [[ -n "$TOKEN_FILE" ]]; then
  [[ -f "$TOKEN_FILE" ]] || die "token file not found: $TOKEN_FILE"
  TOKEN="$(tr -d '[:space:]' <"$TOKEN_FILE")"
fi

ORIGIN="${ORIGIN%/}"

install_cloudflared_apt() {
  if command -v cloudflared >/dev/null 2>&1; then
    log "cloudflared already present: $(cloudflared --version 2>/dev/null | head -1 || true)"
    return 0
  fi
  command -v apt-get >/dev/null 2>&1 || die "apt-get required (Debian/Ubuntu). Install cloudflared manually, then re-run with --skip-apt"
  log "installing cloudflared via Cloudflare apt repo…"
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    >/etc/apt/sources.list.d/cloudflared.list
  apt-get update -y
  apt-get install -y cloudflared
  command -v cloudflared >/dev/null 2>&1 || die "cloudflared install failed"
  log "installed: $(cloudflared --version 2>/dev/null | head -1 || true)"
}

ensure_http2_unit() {
  local unit="/etc/systemd/system/cloudflared.service"
  if [[ ! -f "$unit" ]]; then
    # Some installs drop the unit under /lib/systemd/system
    unit="$(systemctl show -p FragmentPath cloudflared.service 2>/dev/null | cut -d= -f2- || true)"
  fi
  [[ -n "$unit" && -f "$unit" ]] || {
    warn "cloudflared.service unit not found; skip http2 patch"
    return 0
  }
  if grep -qE -- '--protocol(=|[[:space:]])http2' "$unit"; then
    log "cloudflared unit already has --protocol http2 ($unit)"
    return 0
  fi
  if ! grep -qE 'ExecStart=.*[[:space:]]tunnel([[:space:]]|$)' "$unit"; then
    warn "cannot locate 'tunnel' in ExecStart; edit $unit manually to add --protocol http2"
    return 0
  fi
  # Insert after the first bare "tunnel" token: tunnel → tunnel --protocol http2
  if grep -qE 'ExecStart=.*tunnel run' "$unit"; then
    sed -i -e 's|\(tunnel\)\( run\)|\1 --protocol http2\2|' "$unit"
  else
    sed -i -e 's|\(tunnel\)\([[:space:]]\)|\1 --protocol http2\2|' "$unit"
  fi
  if ! grep -qE -- '--protocol(=|[[:space:]])http2' "$unit"; then
    warn "http2 patch may have failed; check $unit"
    return 0
  fi
  log "patched $unit for --protocol http2"
  systemctl daemon-reload
}

patch_auth_allowlist() {
  local origin="$1"
  local entry="${origin}/**"
  [[ -f "$ENV_FILE" ]] || die "missing .env: $ENV_FILE (bootstrap / install first)"

  local key val site
  if grep -q '^ADDITIONAL_REDIRECT_URLS=' "$ENV_FILE"; then
    val="$(grep -E '^ADDITIONAL_REDIRECT_URLS=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [[ ",${val}," == *",${entry},"* ]] || [[ "$val" == "$entry" ]] || [[ "$val" == *"${entry}"* ]]; then
      log "ADDITIONAL_REDIRECT_URLS already includes ${entry}"
    else
      if [[ -n "$val" ]]; then
        val="${val},${entry}"
      else
        val="$entry"
      fi
      sed -i -e "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=${val}|" "$ENV_FILE"
      log "appended ${entry} to ADDITIONAL_REDIRECT_URLS"
    fi
  else
    site="$(grep -E '^SITE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
    site="${site%/}"
    if [[ -n "$site" ]]; then
      val="${site}/**,${entry}"
    else
      val="$entry"
    fi
    printf 'ADDITIONAL_REDIRECT_URLS=%s\n' "$val" >>"$ENV_FILE"
    log "wrote ADDITIONAL_REDIRECT_URLS=${val}"
  fi

  if grep -q '^MESA_TUNNEL_ORIGIN=' "$ENV_FILE"; then
    sed -i -e "s|^MESA_TUNNEL_ORIGIN=.*|MESA_TUNNEL_ORIGIN=${origin}|" "$ENV_FILE"
  else
    printf 'MESA_TUNNEL_ORIGIN=%s\n' "$origin" >>"$ENV_FILE"
  fi
  log "MESA_TUNNEL_ORIGIN=${origin}"
}

recreate_auth() {
  if [[ "$SKIP_AUTH_RECREATE" == "1" ]]; then
    warn "skip auth recreate — run: sudo ${MESA_HOME}/bin/mesa-stack up -d --force-recreate auth"
    return 0
  fi
  if [[ -x "${MESA_HOME}/bin/mesa-stack" ]]; then
    log "force-recreate auth…"
    MESA_REPO_ROOT="${MESA_HOME}/current" "${MESA_HOME}/bin/mesa-stack" up -d --force-recreate auth \
      || warn "auth recreate failed; run manually when stack is up"
  elif [[ -x "$ONPREM_DIR/scripts/stack.sh" ]]; then
    log "force-recreate auth via stack.sh…"
    (cd "$ONPREM_DIR" && ./scripts/stack.sh up -d --force-recreate auth) \
      || warn "auth recreate failed; run manually when stack is up"
  else
    warn "mesa-stack not found; recreate auth manually after stack is up"
  fi
}

# --- main ---
if [[ "$SKIP_APT" != "1" ]]; then
  install_cloudflared_apt
fi

if [[ "$PACKAGE_ONLY" == "1" ]]; then
  log "package-only done"
  exit 0
fi

if [[ -z "$TOKEN" && -z "$ORIGIN" ]]; then
  die "need --token and/or --origin (or --install-package-only)"
fi

if [[ -n "$TOKEN" ]]; then
  command -v cloudflared >/dev/null 2>&1 || die "cloudflared missing; drop --skip-apt or install manually"
  log "installing cloudflared systemd service (token not echoed)…"
  if systemctl is-active --quiet cloudflared 2>/dev/null \
    || systemctl is-enabled --quiet cloudflared 2>/dev/null; then
    warn "cloudflared service already present — reinstall with new token"
  fi
  # cloudflared prints little; failures still exit non-zero
  cloudflared service install "$TOKEN" || {
    warn "service install returned non-zero (may already be installed); continuing to http2 + restart"
  }
  ensure_http2_unit
  systemctl enable cloudflared >/dev/null 2>&1 || true
  systemctl restart cloudflared
  sleep 2
  if systemctl is-active --quiet cloudflared; then
    log "cloudflared is active"
  else
    warn "cloudflared not active — check: journalctl -u cloudflared -n 40 --no-pager"
  fi
  if ! grep -qE -- '--protocol(=|[[:space:]])http2' \
    "$(systemctl show -p FragmentPath cloudflared.service 2>/dev/null | cut -d= -f2- || echo /etc/systemd/system/cloudflared.service)" \
    2>/dev/null; then
    ensure_http2_unit
    systemctl restart cloudflared || true
  fi
fi

if [[ -n "$ORIGIN" ]]; then
  [[ "$ORIGIN" == https://* ]] || die "--origin must be https://… (got: $ORIGIN)"
  patch_auth_allowlist "$ORIGIN"
  recreate_auth
fi

log "done."
log "  Cloudflare UI: Public Hostname → Service http://127.0.0.1:80 (not :3000)"
log "  Verify: systemctl status cloudflared ; curl -sS -o /dev/null -w '%{http_code}\\n' ${ORIGIN:-https://YOUR_HOST}/api/health/live"
if [[ -x "$ONPREM_DIR/scripts/tunnel-health.sh" ]]; then
  log "  Health timer: sudo MESA_HOME=${MESA_HOME} ${ONPREM_DIR}/scripts/tunnel-health.sh install-timer"
fi
