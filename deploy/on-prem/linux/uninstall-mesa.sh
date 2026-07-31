#!/usr/bin/env bash
# Uninstall Mesa on-prem systemd unit and optionally remove MESA_HOME data.
# Usage:
#   sudo ./uninstall-mesa.sh [--mesa-home /opt/mesa] [--remove-data]
set -euo pipefail

MESA_HOME="${MESA_HOME:-/opt/mesa}"
REMOVE_DATA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mesa-home) MESA_HOME="${2:?}"; shift 2 ;;
    --remove-data) REMOVE_DATA=1; shift ;;
    -h|--help)
      echo "Usage: sudo $0 [--mesa-home DIR] [--remove-data]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 运行（sudo）。" >&2
  exit 1
fi

ONPREM=""
if [[ -f "$MESA_HOME/config/install.json" ]]; then
  ONPREM="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('onPremDir',''))" "$MESA_HOME/config/install.json" 2>/dev/null || true)"
fi
if [[ -z "$ONPREM" && -d "$MESA_HOME/current/deploy/on-prem" ]]; then
  ONPREM="$MESA_HOME/current/deploy/on-prem"
fi

if [[ -n "$ONPREM" && -x "$ONPREM/scripts/stack.sh" ]]; then
  echo "Stopping stack…"
  (
    export MESA_REPO_ROOT="$(cd "$ONPREM/../.." && pwd)"
    cd "$ONPREM"
    ./scripts/stack.sh down || true
  ) || true
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl disable --now mesa-on-prem.service 2>/dev/null || true
  rm -f /etc/systemd/system/mesa-on-prem.service
  systemctl daemon-reload || true
  echo "已移除 systemd: mesa-on-prem.service"
fi

if [[ "$REMOVE_DATA" == "1" ]]; then
  echo "删除 MESA_HOME=$MESA_HOME（含数据）…"
  # Prefer docker root wipe for volume-owned files
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    parent="$(dirname "$MESA_HOME")"
    base="$(basename "$MESA_HOME")"
    docker run --rm -v "${parent}:/parent" alpine:3.20 rm -rf "/parent/${base}" || rm -rf "$MESA_HOME"
  else
    rm -rf "$MESA_HOME"
  fi
  echo "数据已删除。"
else
  echo "已卸载服务；数据保留在 $MESA_HOME（加 --remove-data 可删除）。"
fi
