#!/usr/bin/env bash
# Evidence check: tray must start before blocking init (Windows agent_entry_windows.go).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/agent_entry_windows.go"
if ! grep -q 'runAgentTrayFirst' "$FILE"; then
  echo "FAIL: missing runAgentTrayFirst"
  exit 1
fi
if ! grep -q 'systray.Run' "$FILE"; then
  echo "FAIL: missing systray.Run"
  exit 1
fi
python3 <<PY
from pathlib import Path
text = Path("$FILE").read_text()
# Tray path: after console early-return, runAgent must go straight to runAgentTrayFirst.
ra = text[text.index("func runAgent(") : text.index("func runAgentTrayFirst")]
tray_tail = ra.split("runAgentTrayFirst", 1)[0]
# Only the block after the console branch should be checked.
if "if agentArgsWantConsole" in tray_tail:
    tray_tail = tray_tail.split("if agentArgsWantConsole", 1)[1]
    tray_tail = tray_tail.split("return", 1)[-1]  # after console return
if "initAgentSession" in tray_tail:
    print("FAIL: tray path still calls initAgentSession before runAgentTrayFirst")
    raise SystemExit(1)
block = text[text.index("func runAgentTrayFirst") : text.index("func onTrayReady")]
if "go func()" not in block or block.find("initAgentSession") < block.find("go func()"):
    print("FAIL: initAgentSession must run inside go func in runAgentTrayFirst")
    raise SystemExit(1)
if "systray.Run" not in block:
    print("FAIL: missing systray.Run in runAgentTrayFirst")
    raise SystemExit(1)
print("OK: tray path calls systray.Run on main thread; initAgentSession runs in background goroutine")
PY
if ! grep -q 'acquireAgentSingleInstance' "$ROOT/single_instance_windows.go"; then
  echo "FAIL: missing single-instance mutex"
  exit 1
fi
echo "OK: tray startup order + single instance present"
