#!/usr/bin/env bash
# Fail packing if the Windows test zip would be missing critical pieces.
set -euo pipefail

STAGE="${1:?stage dir}"
START="$STAGE/deploy/on-prem/windows-test/Start-Mesa-Test.ps1"

fail() { echo "PACK CHECK FAIL: $*" >&2; exit 1; }
ok() { echo "  OK: $*"; }

[[ -f "$STAGE/START-HERE.cmd" ]] || fail "root START-HERE.cmd"
[[ -f "$STAGE/STOP-HERE.cmd" ]] || fail "root STOP-HERE.cmd"
[[ -f "$STAGE/Start-Mesa-Test.ps1" ]] || fail "root Start-Mesa-Test.ps1"
[[ -f "$STAGE/Stop-Mesa-Test.ps1" ]] || fail "root Stop-Mesa-Test.ps1"
[[ -f "$STAGE/apps/web/Dockerfile" ]] || fail "apps/web/Dockerfile"
[[ -f "$STAGE/apps/web/.dockerignore" ]] || fail "apps/web/.dockerignore"
grep -q "DOCKER_BUILD" "$STAGE/apps/web/next.config.mjs" || fail "next.config.mjs missing DOCKER_BUILD standalone"
[[ -f "$STAGE/deploy/on-prem/compose.yaml" ]] || fail "compose.yaml"
[[ -f "$STAGE/deploy/on-prem/schema/baseline_public.sql" ]] || fail "baseline_public.sql"
[[ -f "$STAGE/deploy/on-prem/schema/ensure_realtime_publication.sql" ]] || fail "ensure_realtime_publication.sql"
grep -q 'ensure_realtime_publication' "$STAGE/deploy/on-prem/scripts/apply-migrations.sh" || fail "apply-migrations must call ensure_realtime_publication"
grep -qE 'RUN --mount=type=cache,target=/root/\.npm[[:space:]]+npm ci' "$STAGE/apps/web/Dockerfile" || fail "web Dockerfile must use BuildKit npm cache mount"
for f in client.ts server.ts middleware.ts route-handler-auth.ts; do
  grep -q 'getSupabaseAuthCookieOptions' "$STAGE/apps/web/src/lib/supabase/$f" \
    || fail "supabase/$f must use getSupabaseAuthCookieOptions"
done
grep -q 'MODE_B_SUPABASE_URL_HOSTNAME' "$STAGE/apps/web/src/lib/supabase/url.ts" \
  || fail "url.ts must define MODE_B_SUPABASE_URL_HOSTNAME"
[[ -f "$STAGE/deploy/on-prem/vendor/supabase-docker/.env.example" ]] || fail "vendor .env.example"
[[ -f "$START" ]] || fail "Start-Mesa-Test.ps1"
[[ ! -d "$STAGE/deploy/on-prem/windows" ]] || fail "WSL Install-Mesa tree must be removed"
grep -q 'host-only-v7' "$START" || fail "Start script stamp host-only-v7 missing"
grep -q 'Initialize-MesaEnv' "$START" || fail "Start must bootstrap .env on host"
grep -q 'Invoke-MesaMigrations' "$START" || fail "Start must migrate via docker exec on host"
grep -q 'ConvertTo-DockerEnginePath' "$START" || fail "Start must convert Windows paths to /mnt/c/..."
grep -q '/mnt/' "$START" || fail "Start must emit /mnt/<drive>/... for MESA_REPO_ROOT"
grep -q 'context: \${MESA_REPO_ROOT' "$STAGE/deploy/on-prem/compose.yaml" || fail "compose.yaml must use MESA_REPO_ROOT context"
if ! grep -q -- '--env-file .env' "$START"; then
  fail "Start must pass --env-file .env"
fi
if grep -E -- '--env-file \$envPath|--env-file \$envFile' "$START" "$STAGE/deploy/on-prem/windows-test/Stop-Mesa-Test.ps1"; then
  fail "Start/Stop must use relative --env-file .env"
fi
# PowerShell 5.1 mis-parses UTF-8 punctuation without BOM - keep .ps1 ASCII-only
python3 - <<PY
from pathlib import Path
paths = list(Path("$STAGE/deploy/on-prem/windows-test").glob("*.ps1"))
paths += [Path("$STAGE/Start-Mesa-Test.ps1"), Path("$STAGE/Stop-Mesa-Test.ps1")]
for p in paths:
    text = p.read_text(encoding="utf-8")
    bad = sorted({ch for ch in text if ord(ch) > 127})
    if bad:
        raise SystemExit(f"PACK CHECK FAIL: {p} has non-ASCII {bad!r}")
print("  OK: PowerShell scripts are ASCII-only")
PY
[[ -f "$STAGE/package-lock.json" ]] || fail "package-lock.json"
[[ -f "$STAGE/packages/shared/package.json" ]] || fail "packages/shared"
[[ -f "$STAGE/packages/ui/package.json" ]] || fail "packages/ui"

ok "host-only-v7 + /mnt/c MESA_REPO_ROOT + relative env-file"
echo "PACK CHECK PASS: $STAGE"
