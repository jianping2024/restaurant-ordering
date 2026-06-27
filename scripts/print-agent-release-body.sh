#!/usr/bin/env bash
# Compose GitHub Release body for print-agent-vX.Y.Z.
# Usage: ./scripts/print-agent-release-body.sh [VERSION]
# VERSION defaults to apps/print-agent/VERSION.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(tr -d '\r\n' < "$ROOT/apps/print-agent/VERSION")}"
NOTES="$ROOT/apps/print-agent/RELEASE_NOTES.md"

if [[ ! -f "$NOTES" ]]; then
  echo "Missing $NOTES" >&2
  exit 1
fi

PYTHON=""
for cmd in python3 python py; do
  if command -v "$cmd" >/dev/null 2>&1; then
    PYTHON=$cmd
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  echo "python not found (need python3 or python for release notes)" >&2
  exit 1
fi

"$PYTHON" - "$VERSION" "$NOTES" <<'PY'
import re
import sys

version, notes_path = sys.argv[1], sys.argv[2]
text = open(notes_path, encoding="utf-8").read()
pattern = rf"(?ms)^##\s+{re.escape(version)}\s*\n(.*?)(?=^##\s+\d|\Z)"
match = re.search(pattern, text)
if not match:
    print(
        f"::error::No release notes section '## {version}' in apps/print-agent/RELEASE_NOTES.md",
        file=sys.stderr,
    )
    sys.exit(1)

section = match.group(1).strip()
if not section:
    print(f"::error::Release notes for {version} are empty", file=sys.stderr)
    sys.exit(1)

print(section)
print()
print("---")
print()
print("Windows print agent for Mesa (thermal LAN printers, TCP 9100).")
print()
print("**Install (recommended, x64 PCs):** `MesaPrintAgent-Setup-amd64.exe`")
print()
print("**Portable:** `MesaPrintAgent-windows-amd64.zip`")
print()
print("Verify `SHA256SUMS`. Builds are not Authenticode-signed; see WINDOWS-README in the zip.")
PY
