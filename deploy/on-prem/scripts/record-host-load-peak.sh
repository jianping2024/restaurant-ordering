#!/usr/bin/env bash
# Sole store-side high-water mark for host load (ldavg-1).
#
# One representation: $MESA_HOME/logs/host-load-peak-record.json
# (metric + value + at + source_day). Daily compare updates only when beaten.
#
# Usage (on store host):
#   ./record-host-load-peak.sh show
#   ./record-host-load-peak.sh compare              # yesterday vs record
#   ./record-host-load-peak.sh compare --date 2026-08-30
#   ./record-host-load-peak.sh seed-retained        # max over retained sa*
#
# From laptop (Tailscale SSH):
#   ./record-host-load-peak.sh --host remoteadmin@pirata-ms-7e05 show
#   RECORD_FILE=/tmp/mesa-peak-test.json ./record-host-load-peak.sh --host … seed-retained
set -euo pipefail

HOST="${MESA_STORE_SSH:-}"
CMD=""
DATE_ARG=""
SYSSTAT_DIR="${SYSSTAT_DIR:-/var/log/sysstat}"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

die() { echo "error: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --host) HOST="${2:?}"; shift 2 ;;
    --date) DATE_ARG="${2:?}"; shift 2 ;;
    --) shift; break ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    show|compare|seed-retained)
      [[ -z "$CMD" ]] || die "duplicate command"
      CMD="$1"
      shift
      ;;
    *) die "unexpected arg: $1 (try --help)" ;;
  esac
done

[[ -n "$CMD" ]] || usage 1

# --- remote path: re-exec on host ---
if [[ -n "$HOST" ]]; then
  remote_args=("$CMD")
  [[ -n "$DATE_ARG" ]] && remote_args+=(--date "$DATE_ARG")
  # Preserve RECORD_FILE / SYSSTAT_DIR / MESA_HOME overrides on the remote side.
  remote_env=()
  [[ -n "${RECORD_FILE:-}" ]] && remote_env+=("RECORD_FILE=$(printf '%q' "$RECORD_FILE")")
  [[ -n "${SYSSTAT_DIR:-}" && "$SYSSTAT_DIR" != /var/log/sysstat ]] && \
    remote_env+=("SYSSTAT_DIR=$(printf '%q' "$SYSSTAT_DIR")")
  [[ -n "${MESA_HOME:-}" ]] && remote_env+=("MESA_HOME=$(printf '%q' "$MESA_HOME")")
  # shellcheck disable=SC2029
  exec ssh -o BatchMode=yes -o ConnectTimeout=12 "$HOST" \
    "env ${remote_env[*]-} bash -s -- $(printf '%q ' "${remote_args[@]}")" <"$0"
fi

command -v sar >/dev/null || die "sar not found (apt install sysstat)"
[[ -d "$SYSSTAT_DIR" ]] || die "missing $SYSSTAT_DIR"

if [[ -z "${RECORD_FILE:-}" ]]; then
  if [[ -n "${MESA_HOME:-}" ]]; then
    RECORD_FILE="${MESA_HOME}/logs/host-load-peak-record.json"
  else
    ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    RECORD_FILE="${ONPREM_DIR}/logs/host-load-peak-record.json"
  fi
fi

METRIC="ldavg-1"

read_record() {
  if [[ ! -f "$RECORD_FILE" ]]; then
    echo ""
    return 0
  fi
  python3 - "$RECORD_FILE" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    d = json.load(f)
print(f"{d.get('value','')}\t{d.get('at','')}\t{d.get('source_day','')}\t{d.get('metric','')}")
PY
}

write_record() {
  local value="$1" at_local="$2" source_day="$3"
  mkdir -p "$(dirname "$RECORD_FILE")"
  local tmp="${RECORD_FILE}.tmp.$$"
  python3 - "$tmp" "$value" "$at_local" "$source_day" "$METRIC" <<'PY'
import json, sys, datetime
path, value, at_local, source_day, metric = sys.argv[1:6]
# Prefer zone from `date` ISO; fall back to local offset via datetime.
try:
    at_iso = at_local
    # validate
    datetime.datetime.fromisoformat(at_iso.replace("Z", "+00:00"))
except Exception:
    at_iso = at_local
payload = {
    "schemaVersion": 1,
    "metric": metric,
    "value": float(value),
    "at": at_iso,
    "source_day": source_day,
    "updated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
  mv -f "$tmp" "$RECORD_FILE"
}

# Peak ldavg-1 for one sa file: prints "value\tHH:MM:SS" or empty if no samples.
peak_from_sa() {
  local sa_file="$1"
  [[ -f "$sa_file" ]] || return 0
  sar -q -f "$sa_file" 2>/dev/null | awk '
    /ldavg-1/ {
      for (i = 1; i <= NF; i++) if ($i == "ldavg-1") c = i
      next
    }
    /^Average:/ { next }
    c && $1 ~ /^[0-9]/ {
      v = $c + 0
      if (v > max || !seen) { max = v; t = $1; seen = 1 }
    }
    END {
      if (seen) printf "%.2f\t%s\n", max, t
    }
  '
}

# Map saDD → YYYY-MM-DD using file mtime calendar date (sysstat day-of-month naming).
day_for_sa() {
  local sa_file="$1"
  date -d "$(stat -c %y "$sa_file" | cut -d' ' -f1)" +%F 2>/dev/null \
    || date -r "$sa_file" +%F
}

# Build ISO timestamp from source day + sar clock (host local TZ).
iso_at() {
  local day="$1" clock="$2"
  # clock may be HH:MM:SS
  date -d "${day} ${clock}" +%Y-%m-%dT%H:%M:%S%z 2>/dev/null \
    | sed -E 's/([+-][0-9]{2})([0-9]{2})$/\1:\2/' \
    || date -j -f '%Y-%m-%d %H:%M:%S' "${day} ${clock}" +%Y-%m-%dT%H:%M:%S%z 2>/dev/null \
    | sed -E 's/([+-][0-9]{2})([0-9]{2})$/\1:\2/' \
    || echo "${day}T${clock}"
}

consider_peak() {
  local value="$1" at_iso="$2" source_day="$3" reason="$4"
  local cur
  cur="$(read_record)"
  if [[ -z "$cur" ]]; then
    write_record "$value" "$at_iso" "$source_day"
    echo "updated  reason=${reason}  value=${value}  at=${at_iso}  file=${RECORD_FILE}"
    return 0
  fi
  local cur_val
  cur_val="$(printf '%s' "$cur" | cut -f1)"
  # bash float compare via awk
  if awk -v n="$value" -v o="$cur_val" 'BEGIN { exit !(n > o) }'; then
    write_record "$value" "$at_iso" "$source_day"
    echo "updated  reason=${reason}  value=${value}  at=${at_iso}  prev=${cur_val}  file=${RECORD_FILE}"
  else
    echo "unchanged  reason=${reason}  candidate=${value}  record=${cur_val}  file=${RECORD_FILE}"
  fi
}

cmd_show() {
  if [[ ! -f "$RECORD_FILE" ]]; then
    echo "no record yet  path=${RECORD_FILE}"
    exit 0
  fi
  python3 - "$RECORD_FILE" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)
print(
    f"metric={d.get('metric')}  value={d.get('value')}  at={d.get('at')}  "
    f"source_day={d.get('source_day')}  updated_at={d.get('updated_at')}  "
    f"file={sys.argv[1]}"
)
PY
}

cmd_compare() {
  local day
  if [[ -n "$DATE_ARG" ]]; then
    day="$DATE_ARG"
  else
    day="$(date -d yesterday +%F 2>/dev/null || date -v-1d +%F)"
  fi
  local dd sa_file peak value clock at_iso
  dd="$(date -d "$day" +%d 2>/dev/null || date -j -f %F "$day" +%d)"
  sa_file="${SYSSTAT_DIR}/sa${dd}"
  [[ -f "$sa_file" ]] || die "no sysstat file for ${day} (${sa_file})"
  # Guard month rollover: mtime calendar day should match requested day.
  local file_day
  file_day="$(day_for_sa "$sa_file")"
  if [[ "$file_day" != "$day" ]]; then
    die "sa file day mismatch: want ${day}, file mtime day ${file_day} (${sa_file})"
  fi
  peak="$(peak_from_sa "$sa_file")"
  [[ -n "$peak" ]] || die "no ldavg-1 samples in ${sa_file}"
  value="$(printf '%s' "$peak" | cut -f1)"
  clock="$(printf '%s' "$peak" | cut -f2)"
  at_iso="$(iso_at "$day" "$clock")"
  consider_peak "$value" "$at_iso" "$day" "compare:${day}"
}

cmd_seed_retained() {
  local best_v="" best_at="" best_day="" f day peak value clock at_iso
  shopt -s nullglob
  for f in "${SYSSTAT_DIR}"/sa[0-9][0-9]; do
    day="$(day_for_sa "$f")"
    peak="$(peak_from_sa "$f")"
    [[ -n "$peak" ]] || continue
    value="$(printf '%s' "$peak" | cut -f1)"
    clock="$(printf '%s' "$peak" | cut -f2)"
    at_iso="$(iso_at "$day" "$clock")"
    if [[ -z "$best_v" ]] || awk -v n="$value" -v o="$best_v" 'BEGIN { exit !(n > o) }'; then
      best_v="$value"
      best_at="$at_iso"
      best_day="$day"
    fi
  done
  shopt -u nullglob
  [[ -n "$best_v" ]] || die "no ldavg-1 samples under ${SYSSTAT_DIR}"
  consider_peak "$best_v" "$best_at" "$best_day" "seed-retained"
}

case "$CMD" in
  show) cmd_show ;;
  compare) cmd_compare ;;
  seed-retained) cmd_seed_retained ;;
  *) die "unknown command: $CMD" ;;
esac
