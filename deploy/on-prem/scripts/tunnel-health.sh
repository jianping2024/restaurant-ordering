#!/usr/bin/env bash
# Detect and record Cloudflare Tunnel (cloudflared) anomalies on Mode B store hosts.
#
# Usage (store absolute paths):
#   sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh check
#   sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh watch
#   sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh since today
#   sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh install-timer
#   sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh uninstall-timer
#
# Public probe host: first https://… in ADDITIONAL_REDIRECT_URLS whose host contains
# MESA_PUBLIC_HOST_MATCH (default: farvoo).
#
# Records:
#   $MESA_HOME/logs/tunnel/events.jsonl
#   $MESA_HOME/logs/tunnel/latest.txt
#   $MESA_HOME/logs/tunnel/journal.cursor
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMD="${1:-}"
ARG="${2:-}"

if [[ -n "${MESA_HOME:-}" ]]; then
  LOG_DIR="${MESA_HOME}/logs/tunnel"
  ENV_FILE="${ONPREM_DIR}/.env"
  [[ -f "${MESA_HOME}/current/deploy/on-prem/.env" ]] && ENV_FILE="${MESA_HOME}/current/deploy/on-prem/.env"
  UNIT_ONPREM="${MESA_HOME}/current/deploy/on-prem"
  [[ -d "$UNIT_ONPREM" ]] || UNIT_ONPREM="$ONPREM_DIR"
else
  LOG_DIR="${ONPREM_DIR}/logs/tunnel"
  ENV_FILE="${ONPREM_DIR}/.env"
  UNIT_ONPREM="$ONPREM_DIR"
  # Dev / unpack without MESA_HOME: still prefer /opt/mesa if present.
  if [[ -d /opt/mesa/logs ]]; then
    LOG_DIR="/opt/mesa/logs/tunnel"
  fi
  if [[ -z "${MESA_HOME:-}" && -d /opt/mesa/current/deploy/on-prem ]]; then
    MESA_HOME=/opt/mesa
    ENV_FILE="${MESA_HOME}/current/deploy/on-prem/.env"
    UNIT_ONPREM="${MESA_HOME}/current/deploy/on-prem"
    LOG_DIR="${MESA_HOME}/logs/tunnel"
  fi
fi

EVENTS_FILE="${LOG_DIR}/events.jsonl"
LATEST_FILE="${LOG_DIR}/latest.txt"
CURSOR_FILE="${LOG_DIR}/journal.cursor"
HOST_MATCH="${MESA_PUBLIC_HOST_MATCH:-farvoo}"
UNIT_NAME=cloudflared
LOCAL_HEALTH_URL="${MESA_TUNNEL_LOCAL_HEALTH:-http://127.0.0.1/api/health/live}"
PUBLIC_SLOW_MS="${MESA_TUNNEL_PUBLIC_SLOW_MS:-3000}"

usage() {
  cat <<EOF
Usage: $0 <check|watch|since|install-timer|uninstall-timer> [arg]

  check            One-shot probe; append anomaly events; exit 1 on error severity
  watch            Incremental journal + probe (timer); always exit 0 after record
  since today|Nd   Summarize events.jsonl (and journal counts)
  install-timer    Install mesa-tunnel-health.timer (needs root + MESA_HOME)
  uninstall-timer  Remove timer units

Logs: ${LOG_DIR}/
EOF
}

die() { printf '[mesa-tunnel] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[mesa-tunnel] %s\n' "$*"; }
warn() { printf '[mesa-tunnel] WARN: %s\n' "$*" >&2; }

mkdir -p "$LOG_DIR"

env_val() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s' "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

# First https origin in ADDITIONAL_REDIRECT_URLS whose host contains HOST_MATCH.
resolve_public_origin() {
  local raw host path origin
  raw="$(env_val ADDITIONAL_REDIRECT_URLS 2>/dev/null || true)"
  [[ -n "$raw" ]] || return 1
  IFS=',' read -r -a parts <<<"$raw"
  local p
  for p in "${parts[@]}"; do
    p="$(printf '%s' "$p" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ "$p" == https://* ]] || continue
    # strip /** or trailing path → origin
    origin="$(printf '%s' "$p" | sed -E 's#/+\*\*$##' | sed -E 's#([^/])/+$#\1#')"
    host="$(printf '%s' "$origin" | sed -E 's#^https://([^/]+).*#\1#' | tr '[:upper:]' '[:lower:]')"
    if printf '%s' "$host" | grep -qi -- "$HOST_MATCH"; then
      printf '%s' "$origin"
      return 0
    fi
  done
  return 1
}

json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])' 2>/dev/null \
    || printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr '\n' ' '
}

append_event() {
  # args: kind severity sample [extra_json_fields]
  local kind="$1" severity="$2" sample="$3"
  local extra="${4:-}"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"ts":"%s","kind":"%s","severity":"%s","sample":"%s"%s}\n' \
    "$ts" "$kind" "$severity" "$(json_escape "$sample")" \
    "${extra:+,${extra}}" >>"$EVENTS_FILE"
}

probe_http() {
  # sets: _code _ms
  local url="$1"
  local out
  out="$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' \
    --connect-timeout 5 --max-time 20 "$url" 2>/dev/null || echo "000 0")"
  _code="$(printf '%s' "$out" | awk '{print $1}')"
  _ms="$(printf '%s' "$out" | awk '{printf "%d", ($2+0)*1000}')"
}

cloudflared_active() {
  systemctl is-active --quiet "$UNIT_NAME" 2>/dev/null
}

cloudflared_installed() {
  systemctl list-unit-files "${UNIT_NAME}.service" 2>/dev/null | grep -q cloudflared \
    || command -v cloudflared >/dev/null 2>&1
}

detect_protocol_hint() {
  local cat_out journal_out
  cat_out="$(systemctl cat "$UNIT_NAME" 2>/dev/null || true)"
  if printf '%s' "$cat_out" | grep -qE -- '--protocol[[:space:]]+http2|protocol=http2'; then
    printf 'http2'
    return 0
  fi
  if printf '%s' "$cat_out" | grep -qE -- '--protocol[[:space:]]+quic|protocol=quic'; then
    printf 'quic'
    return 0
  fi
  journal_out="$(journalctl -u "$UNIT_NAME" -n 80 --no-pager 2>/dev/null || true)"
  if printf '%s' "$journal_out" | grep -q 'protocol=http2'; then
    printf 'http2'
    return 0
  fi
  if printf '%s' "$journal_out" | grep -q 'protocol=quic'; then
    printf 'quic'
    return 0
  fi
  printf 'unknown'
}

JOURNAL_RE='Lost connection|Connection terminated|deadline exceeded|failed to serve|Unregistered tunnel'

scan_journal_lines() {
  # stdin → stdout matching anomaly lines
  grep -E "$JOURNAL_RE" || true
}

run_probe() {
  # mode: check|watch
  local mode="$1"
  local errors=0 warns=0
  local lines=()
  local public_origin="" public_host_status="unresolved"
  local local_ok=0 public_ok=0 local_ms=0 public_ms=0
  local protocol sample_count=0
  local journal_snippet=""

  lines+=("ts=$(date -u +%Y-%m-%dT%H:%M:%SZ) mode=${mode}")
  lines+=("env=${ENV_FILE}")
  lines+=("log_dir=${LOG_DIR}")

  if ! cloudflared_installed; then
    warn "cloudflared not installed / no unit"
    append_event "cloudflared_missing" "error" "unit or binary not found"
    lines+=("cloudflared=missing severity=error")
    errors=$((errors + 1))
  elif ! cloudflared_active; then
    warn "cloudflared not active"
    append_event "cloudflared_inactive" "error" "systemctl is-active failed"
    lines+=("cloudflared=inactive severity=error")
    errors=$((errors + 1))
  else
    lines+=("cloudflared=active")
  fi

  protocol="$(detect_protocol_hint)"
  lines+=("protocol=${protocol}")
  if [[ "$protocol" == "quic" ]]; then
    warn "protocol=quic (prefer http2 for Realtime)"
    append_event "protocol_quic" "warn" "protocol=quic" "\"protocol\":\"quic\""
    warns=$((warns + 1))
  elif [[ "$protocol" != "http2" && "$protocol" != "unknown" ]]; then
    append_event "protocol_other" "warn" "protocol=${protocol}" "\"protocol\":\"$(json_escape "$protocol")\""
    warns=$((warns + 1))
  fi

  if public_origin="$(resolve_public_origin)"; then
    public_host_status="ok"
    lines+=("public_origin=${public_origin}")
  else
    warn "no https://…${HOST_MATCH}… in ADDITIONAL_REDIRECT_URLS — skip public probe"
    append_event "public_host_unresolved" "warn" "match=${HOST_MATCH}" "\"host_match\":\"$(json_escape "$HOST_MATCH")\""
    lines+=("public_origin=unresolved (match=${HOST_MATCH}) severity=warn")
    warns=$((warns + 1))
  fi

  probe_http "$LOCAL_HEALTH_URL"
  local_ms="$_ms"
  if [[ "$_code" == "200" ]]; then
    local_ok=1
    lines+=("local_health=200 ${local_ms}ms")
  else
    lines+=("local_health=${_code} ${local_ms}ms")
    append_event "local_health_fail" "error" "code=${_code} ms=${local_ms}" \
      "\"http_code\":\"${_code}\",\"ms\":${local_ms}"
    errors=$((errors + 1))
  fi

  if [[ -n "$public_origin" ]]; then
    probe_http "${public_origin}/api/health/live"
    public_ms="$_ms"
    if [[ "$_code" == "200" ]]; then
      public_ok=1
      lines+=("public_health=200 ${public_ms}ms")
      if [[ "$public_ms" -ge "$PUBLIC_SLOW_MS" ]]; then
        append_event "public_slow" "warn" "ms=${public_ms} threshold=${PUBLIC_SLOW_MS}" \
          "\"ms\":${public_ms},\"threshold_ms\":${PUBLIC_SLOW_MS},\"origin\":\"$(json_escape "$public_origin")\""
        warns=$((warns + 1))
        lines+=("public_slow=yes")
      fi
    else
      lines+=("public_health=${_code} ${public_ms}ms")
      if [[ "$local_ok" -eq 1 ]]; then
        append_event "public_down_local_up" "error" "public=${_code} local=200" \
          "\"public_code\":\"${_code}\",\"public_ms\":${public_ms},\"origin\":\"$(json_escape "$public_origin")\""
        errors=$((errors + 1))
      else
        append_event "public_health_fail" "error" "code=${_code}" \
          "\"http_code\":\"${_code}\",\"ms\":${public_ms}"
        errors=$((errors + 1))
      fi
    fi
  fi

  # Journal scan
  local jctl_args=(-u "$UNIT_NAME" --no-pager -o short-iso)
  local j_out=""
  if [[ "$mode" == "watch" ]]; then
    if [[ -f "$CURSOR_FILE" ]]; then
      j_out="$(journalctl "${jctl_args[@]}" --after-cursor="$(cat "$CURSOR_FILE")" 2>/dev/null || true)"
    else
      j_out="$(journalctl "${jctl_args[@]}" --since "15 min ago" 2>/dev/null || true)"
    fi
    # Advance cursor even when quiet
    journalctl -u "$UNIT_NAME" -n 0 --show-cursor --no-pager 2>/dev/null \
      | awk '/^-- cursor:/{print $3}' >"${CURSOR_FILE}.tmp" || true
    if [[ -s "${CURSOR_FILE}.tmp" ]]; then
      mv "${CURSOR_FILE}.tmp" "$CURSOR_FILE"
    else
      rm -f "${CURSOR_FILE}.tmp"
      # Fallback: store last cursor from full show
      journalctl -u "$UNIT_NAME" -n 1 --show-cursor --no-pager 2>/dev/null \
        | awk '/^-- cursor:/{print $3}' >"$CURSOR_FILE" || true
    fi
  else
    j_out="$(journalctl "${jctl_args[@]}" --since today 2>/dev/null || true)"
  fi

  local anomalies
  anomalies="$(printf '%s\n' "$j_out" | scan_journal_lines)"
  if [[ -n "$anomalies" ]]; then
    sample_count="$(printf '%s\n' "$anomalies" | grep -c . || true)"
    journal_snippet="$(printf '%s\n' "$anomalies" | tail -5 | tr '\n' ' | ')"
    local jwindow="today"
    [[ "$mode" == "watch" ]] && jwindow="incremental"
    append_event "edge_flap" "error" "$journal_snippet" \
      "\"count\":${sample_count},\"window\":\"${jwindow}\""
    errors=$((errors + 1))
    lines+=("journal_anomalies=${sample_count}")
    lines+=("journal_sample=${journal_snippet}")
  else
    lines+=("journal_anomalies=0")
  fi

  {
    printf 'Mesa tunnel-health (%s)\n' "$mode"
    printf '%s\n' "${lines[@]}"
    printf 'summary: errors=%s warns=%s public_host=%s\n' "$errors" "$warns" "$public_host_status"
    printf 'view: cat %s\n' "$LATEST_FILE"
    printf 'events: tail -50 %s\n' "$EVENTS_FILE"
  } | tee "$LATEST_FILE"

  if [[ "$mode" == "check" && "$errors" -gt 0 ]]; then
    return 1
  fi
  return 0
}

cmd_since() {
  local spec="${1:-today}"
  local since_arg
  case "$spec" in
    today) since_arg="today" ;;
    [0-9]*d|[0-9]*D)
      local n="${spec%[dD]}"
      since_arg="${n} days ago"
      ;;
    *) since_arg="$spec" ;;
  esac

  log "=== events.jsonl (file mtime filter best-effort) ==="
  if [[ -f "$EVENTS_FILE" ]]; then
    if command -v python3 >/dev/null 2>&1; then
      python3 - "$EVENTS_FILE" "$since_arg" <<'PY'
import json, sys, datetime as dt
path, since_arg = sys.argv[1], sys.argv[2]
now = dt.datetime.now(dt.timezone.utc)
if since_arg == "today":
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
elif since_arg.endswith(" days ago"):
    n = int(since_arg.split()[0])
    start = now - dt.timedelta(days=n)
else:
    try:
        start = dt.datetime.fromisoformat(since_arg.replace("Z", "+00:00"))
    except Exception:
        start = now - dt.timedelta(days=3)
counts = {}
rows = []
with open(path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        ts = o.get("ts") or ""
        try:
            t = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            continue
        if t < start:
            continue
        kind = o.get("kind", "?")
        counts[kind] = counts.get(kind, 0) + 1
        rows.append(o)
print(f"events={len(rows)} since={start.isoformat()}")
for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
    print(f"  {k}: {v}")
for o in rows[-20:]:
    print(f"  {o.get('ts')} [{o.get('severity')}] {o.get('kind')}: {o.get('sample','')[:120]}")
PY
    else
      tail -50 "$EVENTS_FILE"
    fi
  else
    log "(no events file yet)"
  fi

  log "=== journalctl -u cloudflared --since ${since_arg} (anomaly lines) ==="
  journalctl -u "$UNIT_NAME" --since "$since_arg" --no-pager -o short-iso 2>/dev/null \
    | scan_journal_lines \
    | tail -40 || true
  local n
  n="$(journalctl -u "$UNIT_NAME" --since "$since_arg" --no-pager 2>/dev/null | scan_journal_lines | grep -c . || true)"
  log "journal anomaly lines: ${n}"
  log "latest: ${LATEST_FILE}"
}

install_timer() {
  [[ "$(id -u)" -eq 0 ]] || die "install-timer needs root (sudo)"
  local home="${MESA_HOME:-/opt/mesa}"
  local onprem="${home}/current/deploy/on-prem"
  [[ -d "$onprem" ]] || onprem="$UNIT_ONPREM"
  [[ -f "$onprem/scripts/tunnel-health.sh" ]] || die "missing $onprem/scripts/tunnel-health.sh"
  [[ -f "$onprem/systemd/mesa-tunnel-health.service.in" ]] || die "missing systemd template"
  [[ -f "$onprem/systemd/mesa-tunnel-health.timer" ]] || die "missing timer unit"

  chmod +x "$onprem/scripts/tunnel-health.sh"
  sed \
    -e "s|__MESA_HOME__|${home}|g" \
    -e "s|__ONPREM_DIR__|${onprem}|g" \
    "$onprem/systemd/mesa-tunnel-health.service.in" >/etc/systemd/system/mesa-tunnel-health.service
  cp "$onprem/systemd/mesa-tunnel-health.timer" /etc/systemd/system/mesa-tunnel-health.timer
  systemctl daemon-reload
  systemctl enable --now mesa-tunnel-health.timer >/dev/null
  log "enabled mesa-tunnel-health.timer (OnUnitActiveSec=5min)"
  log "logs: ${home}/logs/tunnel/"
  systemctl list-timers mesa-tunnel-health.timer --no-pager || true
}

uninstall_timer() {
  [[ "$(id -u)" -eq 0 ]] || die "uninstall-timer needs root (sudo)"
  systemctl disable --now mesa-tunnel-health.timer 2>/dev/null || true
  rm -f /etc/systemd/system/mesa-tunnel-health.service
  rm -f /etc/systemd/system/mesa-tunnel-health.timer
  systemctl daemon-reload || true
  log "removed mesa-tunnel-health.timer"
}

case "$CMD" in
  check) run_probe check ;;
  watch) run_probe watch || true ;;
  since) cmd_since "${ARG:-today}" ;;
  install-timer) install_timer ;;
  uninstall-timer) uninstall_timer ;;
  -h|--help|"") usage; [[ -n "$CMD" ]] || exit 2 ;;
  *) usage >&2; die "unknown command: $CMD" ;;
esac
