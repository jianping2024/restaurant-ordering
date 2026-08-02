#!/usr/bin/env bash
# Bootstrap Mode B .env for deploy/on-prem (full self-hosted Supabase + Mesa web).
# Does not print secret values. Overwrites deploy/on-prem/.env
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${ONPREM_DIR}/vendor/supabase-docker"
OUT="${ONPREM_DIR}/.env"

if [[ ! -f "${VENDOR}/.env.example" ]]; then
  echo "Missing ${VENDOR}/.env.example — vendor supabase-docker first." >&2
  exit 1
fi

cp "${VENDOR}/.env.example" "$OUT"

# Generate secrets into .env (non-interactive).
(
  cd "$VENDOR"
  cp "$OUT" .env
  # Silence key dump (secrets must not hit install logs).
  sh utils/generate-keys.sh --update-env >/dev/null
  cp .env "$OUT"
  rm -f .env .env.old
)

MESA_WEB_PORT="${MESA_WEB_PORT:-3000}"
MESA_EDGE_PORT="${MESA_EDGE_PORT:-80}"
KONG_HTTP_PORT="${KONG_HTTP_PORT:-8000}"
# Avoid clashing with other local Postgres on host :5432
POSTGRES_PORT="${POSTGRES_PORT:-54329}"

# Same-origin public origin (edge gateway). Optional Tunnel host via MESA_TUNNEL_ORIGIN.
if [[ -n "${MESA_PUBLIC_ORIGIN:-}" ]]; then
  PUBLIC_ORIGIN="${MESA_PUBLIC_ORIGIN}"
elif [[ "${MESA_EDGE_PORT}" == "80" ]]; then
  PUBLIC_ORIGIN="http://127.0.0.1"
else
  PUBLIC_ORIGIN="http://127.0.0.1:${MESA_EDGE_PORT}"
fi

JWT_APP="$(openssl rand -hex 32)"
CRON_SECRET="$(openssl rand -hex 24)"
TENANT_ID="mesa-$(openssl rand -hex 4)"

REDIRECTS="${PUBLIC_ORIGIN}/**"
if [[ -n "${MESA_TUNNEL_ORIGIN:-}" ]]; then
  REDIRECTS="${REDIRECTS},${MESA_TUNNEL_ORIGIN}/**"
fi

# Patch URL / auth / ports for Mesa storefront (macOS and GNU sed).
patch_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$OUT"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i.bak -e "s|^${key}=.*|${key}=${val}|" "$OUT"
    else
      sed -i -e "s|^${key}=.*|${key}=${val}|" "$OUT"
    fi
  else
    printf '%s=%s\n' "$key" "$val" >>"$OUT"
  fi
}

# Docker Compose reads COMPOSE_FILE from .env; remove it so deploy/on-prem/compose.yaml is used.
if grep -q '^COMPOSE_FILE=' "$OUT"; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i.bak -e '/^COMPOSE_FILE=/d' "$OUT"
  else
    sed -i -e '/^COMPOSE_FILE=/d' "$OUT"
  fi
fi
patch_env POSTGRES_PORT "$POSTGRES_PORT"
patch_env KONG_HTTP_PORT "$KONG_HTTP_PORT"
patch_env KONG_HTTPS_PORT "8443"
# Browser + Auth see the edge origin (not :8000). Kong stays internal on docker network.
patch_env SUPABASE_PUBLIC_URL "$PUBLIC_ORIGIN"
patch_env API_EXTERNAL_URL "${PUBLIC_ORIGIN}/auth/v1"
patch_env SITE_URL "$PUBLIC_ORIGIN"
patch_env ADDITIONAL_REDIRECT_URLS "$REDIRECTS"
patch_env ENABLE_EMAIL_AUTOCONFIRM "true"
patch_env ENABLE_EMAIL_SIGNUP "true"
patch_env DISABLE_SIGNUP "false"
patch_env POOLER_TENANT_ID "$TENANT_ID"
patch_env STUDIO_DEFAULT_ORGANIZATION "Mesa"
patch_env STUDIO_DEFAULT_PROJECT "On-prem"

# Append Mesa-only keys (idempotent block)
if ! grep -q '^# --- Mesa on-prem ---' "$OUT"; then
  cat >>"$OUT" <<EOF

# --- Mesa on-prem ---
MESA_ON_PREM=1
MESA_EDGE_PORT=${MESA_EDGE_PORT}
MESA_WEB_PORT=${MESA_WEB_PORT}
NEXT_PUBLIC_BASE_URL=${PUBLIC_ORIGIN}
NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN=1
PRINT_AGENT_JWT_SECRET=${JWT_APP}
STAFF_SESSION_SECRET=${JWT_APP}
ORDER_ENQUEUE_SECRET=${JWT_APP}
CRON_SECRET=${CRON_SECRET}
MESA_PLATFORM_LICENSE_URL=${MESA_PLATFORM_LICENSE_URL:-https://restaurant-ordering-ops.vercel.app}
EOF
else
  patch_env MESA_EDGE_PORT "$MESA_EDGE_PORT"
  patch_env MESA_WEB_PORT "$MESA_WEB_PORT"
  patch_env NEXT_PUBLIC_BASE_URL "$PUBLIC_ORIGIN"
  patch_env NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN "1"
  if ! grep -q '^MESA_PLATFORM_LICENSE_URL=' "$OUT"; then
    printf 'MESA_PLATFORM_LICENSE_URL=%s\n' \
      "${MESA_PLATFORM_LICENSE_URL:-https://restaurant-ordering-ops.vercel.app}" >>"$OUT"
  fi
fi

# Optional Tunnel origin (extra Auth redirect allowlist only; does not replace LAN origin).
if [[ -n "${MESA_TUNNEL_ORIGIN:-}" ]]; then
  patch_env MESA_TUNNEL_ORIGIN "$MESA_TUNNEL_ORIGIN"
fi

rm -f "${OUT}.bak"
chmod 600 "$OUT" || true

echo "Wrote ${OUT} (secrets not echoed)."
echo "  Edge: ${PUBLIC_ORIGIN}  (primary; Cloudflare Tunnel → this host:port)"
echo "  Web debug port: ${MESA_WEB_PORT}"
echo "  Kong debug port: ${KONG_HTTP_PORT}"
echo "  DB host port: ${POSTGRES_PORT}"
if [[ -n "${MESA_TUNNEL_ORIGIN:-}" ]]; then
  echo "  Tunnel origin allowlisted: ${MESA_TUNNEL_ORIGIN}"
fi
echo "Next: cd ${ONPREM_DIR} && ./scripts/stack.sh up && ./scripts/apply-migrations.sh"
