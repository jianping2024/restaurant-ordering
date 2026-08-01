#!/usr/bin/env bash
# Build mesa-on-prem-<version>.zip for Ubuntu / Windows on-prem (⑤a + ⑦a).
# Run from repo root or any cwd; does not print secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ONPREM="$ROOT/deploy/on-prem"
# Unique every pack: short-sha + UTC stamp (do not reuse "latest" as the only name).
GIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
STAMP_UTC="$(date -u +%Y%m%dT%H%MZ)"
VER="${MESA_ONPREM_VERSION:-${GIT_SHORT}-${STAMP_UTC}}"
OUT_DIR="${MESA_PACK_OUT:-$ROOT/dist}"
STAGE="$OUT_DIR/mesa-on-prem-$VER"
ZIP="$OUT_DIR/mesa-on-prem-$VER.zip"

MIG_HEAD=$(ls -1 "$ROOT"/supabase/migrations/*.sql 2>/dev/null | xargs -n1 basename | sort | tail -1 || true)
VENDOR_COMMIT=""
if [[ -f "$ONPREM/vendor/SUPABASE_DOCKER_VENDOR.md" ]]; then
  VENDOR_COMMIT=$(grep -Eo '[0-9a-f]{40}' "$ONPREM/vendor/SUPABASE_DOCKER_VENDOR.md" | head -1 || true)
fi
PRINT_AGENT_MIN="${MESA_PRINT_AGENT_MIN_VERSION:-}"

rm -rf "$STAGE"
mkdir -p "$STAGE/deploy" "$OUT_DIR"

echo "Staging $STAGE"

# Mode B tree (exclude local data / .env)
rsync -a --delete \
  --exclude '.env' \
  --exclude 'vendor/supabase-docker/volumes/db/data' \
  --exclude 'vendor/supabase-docker/volumes/storage' \
  --exclude 'data' \
  --exclude 'backups' \
  --exclude '.releases' \
  "$ONPREM/" "$STAGE/deploy/on-prem/"

# Minimal monorepo context for web image build
mkdir -p "$STAGE/apps" "$STAGE/packages" "$STAGE/supabase"
rsync -a --delete --exclude node_modules --exclude .next "$ROOT/apps/web/" "$STAGE/apps/web/"
rsync -a --delete --exclude node_modules "$ROOT/packages/shared/" "$STAGE/packages/shared/"
rsync -a --delete --exclude node_modules "$ROOT/packages/ui/" "$STAGE/packages/ui/"
rsync -a --delete "$ROOT/supabase/migrations/" "$STAGE/supabase/migrations/"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$STAGE/"
# Web Dockerfile COPYs this for pinned print-agent download links.
mkdir -p "$STAGE/apps/print-agent"
cp "$ROOT/apps/print-agent/VERSION" "$STAGE/apps/print-agent/VERSION"

# Build context is pack root (MESA_REPO_ROOT) — dockerignore must live here.
cat >"$STAGE/.dockerignore" <<'EOF'
node_modules
**/node_modules
**/.next
.git
.env
.env.*
!**/.env.example
dist
**/*.md
**/.DS_Store
coverage
.turbo
deploy/on-prem/backups
deploy/on-prem/.releases
deploy/on-prem/vendor/supabase-docker/volumes
EOF

# Install docs / verify entry at package root
cp "$ONPREM/linux/README-INSTALL.zh.txt" "$STAGE/README-UBUNTU.zh.txt"
cp "$ONPREM/windows/README-INSTALL.zh.txt" "$STAGE/README-WINDOWS.zh.txt"
cp "$ONPREM/windows/START-WSL-TEST.cmd" "$STAGE/START-WSL-TEST.cmd"
# Customer Ubuntu entry at pack root
cat >"$STAGE/install-ubuntu.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/deploy/on-prem/linux/install-mesa.sh" "$@"
EOF
chmod +x "$STAGE/install-ubuntu.sh" \
  "$STAGE/deploy/on-prem/linux/install-mesa.sh" \
  "$STAGE/deploy/on-prem/linux/uninstall-mesa.sh" \
  "$STAGE/deploy/on-prem/scripts/"*.sh

# Gate: Mode B Realtime publication ensure (baseline omits membership)
ENSURE_SQL="$STAGE/deploy/on-prem/schema/ensure_realtime_publication.sql"
APPLY_SH="$STAGE/deploy/on-prem/scripts/apply-migrations.sh"
if [[ ! -f "$ENSURE_SQL" ]]; then
  echo "ERROR: pack missing schema/ensure_realtime_publication.sql" >&2
  exit 1
fi
if ! grep -q 'ensure_realtime_publication' "$APPLY_SH"; then
  echo "ERROR: apply-migrations.sh must call ensure_realtime_publication" >&2
  exit 1
fi
if ! grep -qE "ARRAY\[.*'print_jobs'" "$ENSURE_SQL"; then
  echo "ERROR: ensure_realtime_publication.sql must include print_jobs (print-agent Realtime CDC)" >&2
  exit 1
fi
# Gate: web Dockerfile must use BuildKit npm cache (docs / on-prem-pack.mdc — not docs-only).
WEB_DOCKERFILE="$STAGE/apps/web/Dockerfile"
if ! grep -qE 'RUN --mount=type=cache,target=/root/\.npm[[:space:]]+npm ci' "$WEB_DOCKERFILE"; then
  echo "ERROR: apps/web/Dockerfile must use BuildKit npm cache: RUN --mount=type=cache,target=/root/.npm npm ci" >&2
  exit 1
fi
# Gate: never pass process.env into same-origin helper (breaks Next client inline).
# Ignore comments/docs that mention the antipattern by name.
SAME_ORIGIN_ANTIPATTERN="$(
  grep -R --include='*.ts' --include='*.tsx' -n 'menuImageSameOriginEnabled(process\.env)' \
    "$STAGE/apps/web/src" "$STAGE/packages/shared/src" 2>/dev/null \
    | grep -v '\.test\.' \
    | grep -vE '^\S+:[0-9]+:\s*\*' \
    | grep -vE '^\S+:[0-9]+:\s*//' \
    || true
)"
if [[ -n "$SAME_ORIGIN_ANTIPATTERN" ]]; then
  echo "ERROR: menuImageSameOriginEnabled(process.env) breaks NEXT_PUBLIC inlining:" >&2
  echo "$SAME_ORIGIN_ANTIPATTERN" >&2
  exit 1
fi
# Gate: Mode B auth cookie name must be one helper, wired into every SSR/browser client.
for f in \
  "$STAGE/apps/web/src/lib/supabase/client.ts" \
  "$STAGE/apps/web/src/lib/supabase/server.ts" \
  "$STAGE/apps/web/src/lib/supabase/middleware.ts" \
  "$STAGE/apps/web/src/lib/supabase/route-handler-auth.ts"
do
  if ! grep -q 'getSupabaseAuthCookieOptions' "$f"; then
    echo "ERROR: $f must use getSupabaseAuthCookieOptions (Mode B Realtime JWT)" >&2
    exit 1
  fi
done
COOKIE_NAME_HITS="$(
  grep -R --include='*.ts' --include='*.tsx' -n 'sb-kong-auth-token' \
    "$STAGE/apps/web/src" 2>/dev/null \
    | grep -v '\.test\.' \
    || true
)"
# Literal cookie name may appear only as the documented expected value in url.ts comments
# or nowhere — the runtime name is built from MODE_B_SUPABASE_URL_HOSTNAME. Fail if a
# second call-site hardcodes the full cookie string.
if echo "$COOKIE_NAME_HITS" | grep -v 'lib/supabase/url\.ts' | grep -q .; then
  echo "ERROR: sb-kong-auth-token must not be hardcoded outside url.ts:" >&2
  echo "$COOKIE_NAME_HITS" >&2
  exit 1
fi
if ! grep -q 'MODE_B_SUPABASE_URL_HOSTNAME' "$STAGE/apps/web/src/lib/supabase/url.ts"; then
  echo "ERROR: url.ts must define MODE_B_SUPABASE_URL_HOSTNAME for auth cookie alignment" >&2
  exit 1
fi
# Gate: print-agent download panel must survive on-prem builds — the web image
# needs the GitHub repo baked (ARG/ENV) and the pinned VERSION file copied in,
# otherwise the dashboard silently hides the installer download card.
if ! grep -q 'NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO' "$WEB_DOCKERFILE"; then
  echo "ERROR: apps/web/Dockerfile must bake NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO (download panel)" >&2
  exit 1
fi
if ! grep -q 'apps/print-agent/VERSION' "$WEB_DOCKERFILE"; then
  echo "ERROR: apps/web/Dockerfile must COPY apps/print-agent/VERSION (pinned download links)" >&2
  exit 1
fi
if [[ ! -s "$STAGE/apps/print-agent/VERSION" ]]; then
  echo "ERROR: pack missing apps/print-agent/VERSION" >&2
  exit 1
fi
# Gate: install/upgrade must place VERSION into MESA_HOME/current build context
# (Dockerfile COPY fails otherwise → silent keep of old web image).
UPGRADE_SH="$STAGE/deploy/on-prem/scripts/upgrade.sh"
INSTALL_SH="$STAGE/deploy/on-prem/linux/install-mesa.sh"
if ! grep -q 'apps/print-agent/VERSION' "$UPGRADE_SH"; then
  echo "ERROR: upgrade.sh must sync apps/print-agent/VERSION into MESA_HOME/current" >&2
  exit 1
fi
if ! grep -q 'apps/print-agent/VERSION' "$INSTALL_SH"; then
  echo "ERROR: install-mesa.sh must copy apps/print-agent/VERSION into MESA_HOME/current" >&2
  exit 1
fi

cat >"$STAGE/README-VERIFY.zh.txt" <<EOF
Mesa 安装验证 / 客户安装
========================
本包 ID（每次打包唯一，勿与旧包混淆）:
  mesa-on-prem-${VER}
解压后文件夹名必须是上面这一串。不要用旧的 mesa-on-prem-latest / 旧 sha 目录。

【客户 · 原生 Ubuntu】
1. 解压本 zip
2. 已装 Docker Engine + Compose 后执行：
   chmod +x install-ubuntu.sh
   sudo ./install-ubuntu.sh
   （默认装到 /opt/mesa；详见 README-UBUNTU.zh.txt）
3. 浏览器打开：http://127.0.0.1:3000/setup
4. 打印：另装 Windows MesaPrintAgent，服务器地址填本机 http://<店内IP>:3000

【研发验证 · Windows + WSL】
1. 解压本 zip
2. 双击：START-WSL-TEST.cmd
3. 完成后打开：http://127.0.0.1:3000/setup

【客户 · Windows 主机】
  deploy\\on-prem\\windows\\Install-Mesa.ps1（详见 README-WINDOWS.zh.txt）
EOF
printf '%s\n' "mesa-on-prem-${VER}" >"$STAGE/PACK-ID.txt"

cat >"$STAGE/manifest.json" <<EOF
{
  "name": "mesa-on-prem",
  "version": "$VER",
  "kind": "on-prem-release",
  "mesaHomeDefaultLinux": "/opt/mesa",
  "mesaHomeDefaultWindows": "%ProgramData%\\\\Mesa",
  "mesaHomeSelectable": true,
  "entrypoint": "install-ubuntu.sh",
  "customerEntrypointLinux": "install-ubuntu.sh",
  "customerEntrypointWindows": "deploy/on-prem/windows/Install-Mesa.ps1",
  "verifyEntrypoint": "START-WSL-TEST.cmd",
  "upgradeEntrypoint": "deploy/on-prem/scripts/upgrade.sh",
  "stack": "mode-b",
  "migrationsHead": "$MIG_HEAD",
  "supabaseVendorCommit": "$VENDOR_COMMIT",
  "printAgentMinVersion": "$PRINT_AGENT_MIN",
  "imagesLock": "deploy/on-prem/images.lock",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": [
    "Customer Ubuntu: sudo ./install-ubuntu.sh (default MESA_HOME=/opt/mesa).",
    "Customer Windows: deploy/on-prem/windows/Install-Mesa.ps1.",
    "Verify (WSL): START-WSL-TEST.cmd.",
    "Never use floating :latest on customer installs."
  ]
}
EOF

rm -f "$ZIP"
(
  cd "$OUT_DIR"
  zip -qr "mesa-on-prem-$VER.zip" "mesa-on-prem-$VER"
)
# Convenience pointer only — always prefer the stamped zip name below.
cp -f "$ZIP" "$OUT_DIR/mesa-on-prem-latest.zip"
printf '%s\n' "mesa-on-prem-${VER}.zip" >"$OUT_DIR/mesa-on-prem-LATEST-NAME.txt"

echo ""
echo "=========================================="
echo "USE THIS ZIP (unique name):"
echo "  $ZIP"
echo "Folder inside zip:"
echo "  mesa-on-prem-$VER"
echo "=========================================="
echo "Pointer copy (easy to overwrite — prefer stamped name): $OUT_DIR/mesa-on-prem-latest.zip"
echo "Ubuntu customer: Expand -> sudo ./install-ubuntu.sh"
echo "Windows customer: Expand -> deploy\\on-prem\\windows\\Install-Mesa.ps1"
echo "WSL verify: Expand -> START-WSL-TEST.cmd"
