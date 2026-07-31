#!/usr/bin/env bash
# Pack a throwaway Windows Docker-Desktop test zip (no WSL installer).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VER="${MESA_ONPREM_VERSION:-win-test-$(date +%Y%m%d-%H%M)-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)}"
OUT="${MESA_PACK_OUT:-$ROOT/dist}"
export MESA_ONPREM_VERSION="$VER"
export MESA_PACK_OUT="$OUT"

# Only one Windows test zip may exist at a time — remove all older ones first.
rm -rf "$OUT"/mesa-on-prem-win-test-* "$OUT"/mesa-windows-test-latest.zip

"$ROOT/deploy/on-prem/scripts/pack-release.sh"

STAGE="$OUT/mesa-on-prem-$VER"
ZIP="$OUT/mesa-on-prem-$VER-windows-test.zip"

python3 - <<PY
import json
from pathlib import Path
p = Path("$STAGE") / "manifest.json"
m = json.loads(p.read_text())
m["kind"] = "on-prem-windows-test"
m["entrypoint"] = "START-HERE.cmd"
m["notes"] = [
  "Throwaway Windows test pack. Requires Docker Desktop already running.",
  "Double-click START-HERE.cmd at pack root. Does NOT install WSL.",
  "Compose runs on the Windows host; helper container is only for bash bootstrap/migrate.",
]
p.write_text(json.dumps(m, indent=2) + "\n")
PY

cp "$STAGE/deploy/on-prem/windows-test/README.txt" "$STAGE/README-WINDOWS-TEST.txt"
cp "$STAGE/deploy/on-prem/windows-test/README.txt" "$STAGE/README-INSTALL.zh.txt"
cp "$STAGE/deploy/on-prem/windows-test/START-HERE.cmd" "$STAGE/START-HERE.cmd"
cp "$STAGE/deploy/on-prem/windows-test/STOP-HERE.cmd" "$STAGE/STOP-HERE.cmd"
# Also place scripts at pack root so double-click works even if paths are messy
cp "$STAGE/deploy/on-prem/windows-test/Start-Mesa-Test.ps1" "$STAGE/Start-Mesa-Test.ps1"
cp "$STAGE/deploy/on-prem/windows-test/Stop-Mesa-Test.ps1" "$STAGE/Stop-Mesa-Test.ps1"

# Avoid accidental use of the old WSL store installer in this throwaway pack
rm -rf "$STAGE/deploy/on-prem/windows"

"$ROOT/deploy/on-prem/scripts/check-windows-test-pack.sh" "$STAGE"

rm -f "$ZIP" "$OUT/mesa-on-prem-$VER.zip"
(
  cd "$OUT"
  zip -qr "$(basename "$ZIP")" "mesa-on-prem-$VER"
)

# Stable alias so there is never a question of which zip to use.
cp "$ZIP" "$OUT/mesa-windows-test-latest.zip"

echo "Wrote $ZIP"
echo "Alias: $OUT/mesa-windows-test-latest.zip (always the newest)"
echo "On Windows: expand → double-click START-HERE.cmd"
