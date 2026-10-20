#!/usr/bin/env bash
# Summarize Caddy edge access latency from docker logs (Mode B).
#
# Usage (on store host, MESA stack up):
#   ./edge-access-summary.sh
#   ./edge-access-summary.sh --since 2h
#   ./edge-access-summary.sh --since 30m --slow-ms 1000
#   MESA_EDGE_CONTAINER=mesa-on-prem-edge-1 ./edge-access-summary.sh
#
# Requires: docker, python3 (stdlib only).
set -euo pipefail

SINCE="1h"
SLOW_MS=1000
CONTAINER="${MESA_EDGE_CONTAINER:-mesa-on-prem-edge-1}"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --since) SINCE="${2:?}"; shift 2 ;;
    --slow-ms) SLOW_MS="${2:?}"; shift 2 ;;
    --container) CONTAINER="${2:?}"; shift 2 ;;
    *) echo "error: unknown arg: $1" >&2; usage 1 ;;
  esac
done

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "error: container not found: $CONTAINER" >&2
  exit 1
fi

export EDGE_ACCESS_SLOW_MS="$SLOW_MS"
export EDGE_ACCESS_SINCE="$SINCE"

docker logs --since "$SINCE" "$CONTAINER" 2>&1 | python3 -c '
import json, os, sys
from collections import defaultdict

slow_ms = float(os.environ.get("EDGE_ACCESS_SLOW_MS", "1000"))
since = os.environ.get("EDGE_ACCESS_SINCE", "?")
rows = []  # (path, duration_ms, status, method)

def path_only(uri: str) -> str:
    if not uri:
        return "?"
    return uri.split("?", 1)[0] or "?"

def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    i = min(len(sorted_vals) - 1, max(0, int(round((p / 100.0) * (len(sorted_vals) - 1)))))
    return sorted_vals[i]

for line in sys.stdin:
    line = line.strip()
    if not line or line[0] not in "{":
        continue
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    # Raw docker json-file blob (rare via `docker logs`, common if cat log file)
    if "log" in obj and "stream" in obj and "duration" not in obj:
        inner = (obj.get("log") or "").strip()
        if not inner.startswith("{"):
            continue
        try:
            obj = json.loads(inner)
        except json.JSONDecodeError:
            continue
    if "duration" not in obj:
        continue
    req = obj.get("request") or {}
    method = req.get("method") or "?"
    uri = req.get("uri") or req.get("url") or "?"
    status = obj.get("status")
    try:
        dur_f = float(obj.get("duration"))
    except (TypeError, ValueError):
        continue
    rows.append((path_only(str(uri)), dur_f, status, method))

if not rows:
    print("no access log lines with duration in window (edge up? Caddyfile log enabled? since=%s)" % since)
    sys.exit(0)

all_d = sorted(r[1] for r in rows)
print("requests=%d  since=%s  duration=ms" % (len(rows), since))
print(
    "all  min=%.1f  p50=%.1f  p90=%.1f  p95=%.1f  p99=%.1f  max=%.1f"
    % (all_d[0], pct(all_d, 50), pct(all_d, 90), pct(all_d, 95), pct(all_d, 99), all_d[-1])
)

by_path = defaultdict(list)
for path, dur, status, method in rows:
    by_path[path].append(dur)

print("\n--- by path (top 20 by p95) ---")
ranked = []
for path, ds in by_path.items():
    ds = sorted(ds)
    ranked.append((pct(ds, 95), len(ds), path, pct(ds, 50), ds[-1]))
ranked.sort(reverse=True)
for p95, n, path, p50, mx in ranked[:20]:
    print("n=%5d  p50=%8.1f  p95=%8.1f  max=%8.1f  %s" % (n, p50, p95, mx, path))

slow = [r for r in rows if r[1] >= slow_ms]
print("\n--- slower than %g ms (up to 30) ---" % slow_ms)
if not slow:
    print("(none)")
else:
    slow.sort(key=lambda r: r[1], reverse=True)
    for path, dur, status, method in slow[:30]:
        print("%8.1f ms  %s  %s  %s" % (dur, status, method, path))
'
