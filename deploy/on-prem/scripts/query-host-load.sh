#!/usr/bin/env bash
# Query host load / CPU / memory for a fixed time window via sysstat (sar).
#
# Designed for Mesa store Ubuntu hosts (sysstat samples ~every 10 min into
# /var/log/sysstat/saDD). Can run on the host, or from a laptop over SSH.
#
# Usage:
#   # on store host
#   ./query-host-load.sh last-night
#   ./query-host-load.sh dinner
#   ./query-host-load.sh 2026-08-06 18:00 23:59
#   ./query-host-load.sh yesterday 12:00 15:00 --what cpu,load,mem
#
#   # from laptop (Tailscale SSH)
#   ./query-host-load.sh --host remoteadmin@pirata-ms-7e05 last-night
#   MESA_STORE_SSH=remoteadmin@100.83.99.13 ./query-host-load.sh dinner
#
# Presets:
#   last-night  yesterday 18:00–23:59 (host local time)
#   dinner      today (or --date) 18:00–23:59
#   lunch       today (or --date) 12:00–15:00
#   today       today 00:00–now
#   yesterday   yesterday 00:00–23:59
set -euo pipefail

HOST="${MESA_STORE_SSH:-}"
WHAT="load,cpu,mem"
DATE_ARG=""
START=""
END=""
PRESET=""
RESOLUTION_HINT=10

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

die() { echo "error: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --host) HOST="${2:?}"; shift 2 ;;
    --what) WHAT="${2:?}"; shift 2 ;;
    --date) DATE_ARG="${2:?}"; shift 2 ;;
    --) shift; break ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    *)
      if [[ -z "$PRESET" && -z "$START" && "$1" =~ ^(last-night|dinner|lunch|today|yesterday)$ ]]; then
        PRESET="$1"
        shift
      elif [[ -z "$DATE_ARG" && "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        DATE_ARG="$1"
        shift
      elif [[ -z "$START" && "$1" =~ ^[0-9]{1,2}:[0-9]{2}$ ]]; then
        START="$1"
        shift
      elif [[ -z "$END" && "$1" =~ ^[0-9]{1,2}:[0-9]{2}$ ]]; then
        END="$1"
        shift
      else
        die "unexpected arg: $1 (try --help)"
      fi
      ;;
  esac
done

[[ -n "$PRESET" || -n "$DATE_ARG" || -n "$START" ]] || usage 1

# --- remote path: re-exec on host ---
if [[ -n "$HOST" ]]; then
  remote_args=(--what "$WHAT")
  [[ -n "$DATE_ARG" ]] && remote_args+=(--date "$DATE_ARG")
  [[ -n "$PRESET" ]] && remote_args+=("$PRESET")
  [[ -n "$START" ]] && remote_args+=("$START")
  [[ -n "$END" ]] && remote_args+=("$END")
  # shellcheck disable=SC2029
  exec ssh -o BatchMode=yes -o ConnectTimeout=12 "$HOST" \
    "bash -s -- $(printf '%q ' "${remote_args[@]}")" <"$0"
fi

command -v sar >/dev/null || die "sar not found (apt install sysstat)"
SYSSTAT_DIR="${SYSSTAT_DIR:-/var/log/sysstat}"
[[ -d "$SYSSTAT_DIR" ]] || die "missing $SYSSTAT_DIR (is sysstat-collect.timer running?)"

normalize_hhmm() {
  local t="$1"
  if [[ "$t" =~ ^([0-9]):([0-9]{2})$ ]]; then
    printf '%02d:%s:00' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  elif [[ "$t" =~ ^([0-9]{2}):([0-9]{2})$ ]]; then
    printf '%s:00' "$t"
  else
    die "bad time: $t (want HH:MM)"
  fi
}

# Resolve DATE_ARG / PRESET → YYYY-MM-DD + START/END (host local TZ)
case "$PRESET" in
  last-night)
    DATE_ARG="$(date -d yesterday +%F 2>/dev/null || date -v-1d +%F)"
    START="${START:-18:00}"
    END="${END:-23:59}"
    ;;
  dinner)
    DATE_ARG="${DATE_ARG:-$(date +%F)}"
    START="${START:-18:00}"
    END="${END:-23:59}"
    ;;
  lunch)
    DATE_ARG="${DATE_ARG:-$(date +%F)}"
    START="${START:-12:00}"
    END="${END:-15:00}"
    ;;
  today)
    DATE_ARG="$(date +%F)"
    START="${START:-00:00}"
    END="${END:-$(date +%H:%M)}"
    ;;
  yesterday)
    DATE_ARG="$(date -d yesterday +%F 2>/dev/null || date -v-1d +%F)"
    START="${START:-00:00}"
    END="${END:-23:59}"
    ;;
  "")
    DATE_ARG="${DATE_ARG:-$(date +%F)}"
    [[ -n "$START" && -n "$END" ]] || die "need START END, or a preset"
    ;;
esac

START_S="$(normalize_hhmm "$START")"
END_S="$(normalize_hhmm "$END")"
DAY="$(date -d "$DATE_ARG" +%d 2>/dev/null || date -j -f %F "$DATE_ARG" +%d)"
SA_FILE="${SYSSTAT_DIR}/sa${DAY}"
[[ -f "$SA_FILE" ]] || die "no sysstat file for $DATE_ARG ($SA_FILE)"

# If querying "today" but sa file is from a previous month rollover of same day number,
# sar still scopes by -s/-e on that file's date; warn if file mtime day != DATE_ARG.
FILE_DAY="$(date -r "$SA_FILE" +%F 2>/dev/null || stat -c %y "$SA_FILE" | cut -d' ' -f1)"
if [[ "$FILE_DAY" != "$DATE_ARG" && "$FILE_DAY" != "${DATE_ARG}"* ]]; then
  # saDD is day-of-month only; accept same calendar day-of-month within ~2 days of mtime
  :
fi

HOSTNAME_S="$(hostname -s 2>/dev/null || hostname)"
NCPU="$(nproc 2>/dev/null || echo '?')"
echo "host=$HOSTNAME_S  cpus=$NCPU  window=${DATE_ARG} ${START_S:0:5}–${END_S:0:5}  file=$SA_FILE  sample~${RESOLUTION_HINT}m"
echo

run_sar() {
  local flag="$1"
  sar "$flag" -f "$SA_FILE" -s "$START_S" -e "$END_S" 2>/dev/null
}

summarize_load() {
  echo "=== load average (ldavg-1 / 5 / 15) ==="
  run_sar -q
  echo
  echo "--- top ldavg-1 in window ---"
  run_sar -q | awk 'NR>3 && $1 ~ /^[0-9]/ && !/Average/ {print}' \
    | sort -k4 -nr | head -8
  echo
  echo "--- average ---"
  run_sar -q | awk '/Average/'
  echo
}

summarize_cpu() {
  echo "=== CPU (%user / %system / %iowait / %idle) ==="
  run_sar -u | awk 'NR<=3 || $2=="all" || /Average/'
  echo
  echo "--- busiest %user (all) ---"
  run_sar -u | awk 'NR>3 && $2=="all" && !/Average/ {print}' \
    | sort -k3 -nr | head -8
  echo
}

summarize_mem() {
  echo "=== memory (%memused / kbavail) ==="
  run_sar -r | awk 'NR<=3 || /Average/ || $1 ~ /^[0-9]/ {print}' \
    | awk 'NR<=3 || /Average/ || NR%3==0'
  echo
  echo "--- peak %memused ---"
  run_sar -r | awk 'NR>3 && $1 ~ /^[0-9]/ && !/Average/ {print}' \
    | sort -k5 -nr | head -5
  echo
}

summarize_io() {
  echo "=== disk I/O wait + block devices (if available) ==="
  run_sar -d 2>/dev/null | awk 'NR<=3 || /Average/ || /dev/ {print}' | head -40 || true
  echo
}

IFS=',' read -r -a parts <<<"$WHAT"
for p in "${parts[@]}"; do
  case "$p" in
    load) summarize_load ;;
    cpu) summarize_cpu ;;
    mem|memory) summarize_mem ;;
    io|disk) summarize_io ;;
    *) die "unknown --what piece: $p (load,cpu,mem,io)" ;;
  esac
done

echo "tip: full raw series →  sar -q -f $SA_FILE -s $START_S -e $END_S"
echo "     retention is ~saDD files under $SYSSTAT_DIR (about 7–10 days here)."
