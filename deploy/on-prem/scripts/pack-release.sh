#!/usr/bin/env bash
# Build mesa-on-prem-<version>.zip for Ubuntu on-prem (Mode B + ⑦a).
# Store host = native Ubuntu + Docker Engine. Print-agent stays a separate Windows install.
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
  --exclude 'vendor/supabase-docker/volumes/db/data.legacy*' \
  --exclude 'vendor/supabase-docker/volumes/storage' \
  --exclude 'data' \
  --exclude 'backups' \
  --exclude '.releases' \
  "$ONPREM/" "$STAGE/deploy/on-prem/"

# Minimal monorepo context for web image build
mkdir -p "$STAGE/apps" "$STAGE/packages" "$STAGE/supabase"
# Exclude every Next build dir (.next, .next-uat, .next-typecheck, …) — only excluding
# literal `.next` left local webpack caches in the zip (~hundreds of MB).
rsync -a --delete --exclude node_modules --exclude '.next' --exclude '.next-*' \
  "$ROOT/apps/web/" "$STAGE/apps/web/"
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
**/.next-*
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

# Install docs at package root
cp "$ONPREM/linux/README-INSTALL.zh.txt" "$STAGE/README-UBUNTU.zh.txt"
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

# Gate: never ship local Next build caches (only excluding `.next` is not enough).
if find "$STAGE/apps/web" -maxdepth 1 \( -type d -o -type l \) -name '.next*' -print -quit | grep -q .; then
  echo "ERROR: staged apps/web still contains a .next* dir (exclude .next and .next-* in rsync)" >&2
  find "$STAGE/apps/web" -maxdepth 1 \( -type d -o -type l \) -name '.next*' -print >&2
  exit 1
fi

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
# Gate: on-prem must NOT bake a non-empty GitHub repo — download card visibility is
# solely getPrintAgentDownloadUrls() (null when NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO unset).
if grep -E '^[[:space:]]*ARG[[:space:]]+NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO=[^[:space:]]+' "$WEB_DOCKERFILE" | grep -vq '=$'; then
  echo "ERROR: apps/web/Dockerfile must not default NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO (on-prem hides download panel)" >&2
  exit 1
fi
if ! grep -q 'apps/print-agent/VERSION' "$WEB_DOCKERFILE"; then
  echo "ERROR: apps/web/Dockerfile must COPY apps/print-agent/VERSION (recommended agent version)" >&2
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
# Gate: claim/check-in config must survive web rebuild (host license-state volume).
COMPOSE_YAML="$STAGE/deploy/on-prem/compose.yaml"
if ! grep -q 'license-state:/mesa-license-state' "$COMPOSE_YAML"; then
  echo "ERROR: compose.yaml must bind-mount deploy/on-prem/license-state for durable check-in config" >&2
  exit 1
fi
if ! grep -q 'MESA_LICENSE_CONFIG_PATH: /mesa-license-state/platform.json' "$COMPOSE_YAML"; then
  echo "ERROR: compose.yaml must set MESA_LICENSE_CONFIG_PATH to mounted platform.json" >&2
  exit 1
fi
if ! grep -q "exclude 'license-state'" "$UPGRADE_SH"; then
  echo "ERROR: upgrade.sh must preserve license-state across sync" >&2
  exit 1
fi
if ! grep -q "exclude 'license-state'" "$INSTALL_SH"; then
  echo "ERROR: install-mesa.sh must preserve license-state across sync" >&2
  exit 1
fi
VERIFY_SH="$STAGE/deploy/on-prem/scripts/verify-on-prem-ready.sh"
if [[ ! -f "$VERIFY_SH" ]]; then
  echo "ERROR: pack must include scripts/verify-on-prem-ready.sh" >&2
  exit 1
fi
if ! grep -q 'verify-on-prem-ready.sh install' "$INSTALL_SH"; then
  echo "ERROR: install-mesa.sh must run verify-on-prem-ready.sh install" >&2
  exit 1
fi
if ! grep -q 'verify-on-prem-ready.sh upgrade' "$UPGRADE_SH"; then
  echo "ERROR: upgrade.sh must run verify-on-prem-ready.sh upgrade" >&2
  exit 1
fi
# Gate: web build identity must be MESA_WEB_VERSION (getWebAppBuildInfo) — not package.json.
if ! grep -q 'MESA_WEB_VERSION' "$WEB_DOCKERFILE"; then
  echo "ERROR: apps/web/Dockerfile must bake MESA_WEB_VERSION (web build identity)" >&2
  exit 1
fi
if ! grep -q 'MESA_WEB_VERSION' "$STAGE/deploy/on-prem/compose.yaml"; then
  echo "ERROR: compose.yaml must pass MESA_WEB_VERSION into web build/runtime" >&2
  exit 1
fi
if ! grep -q 'MESA_WEB_VERSION' "$UPGRADE_SH"; then
  echo "ERROR: upgrade.sh must set MESA_WEB_VERSION from pack version before web rebuild" >&2
  exit 1
fi
if ! grep -q 'MESA_WEB_VERSION' "$INSTALL_SH"; then
  echo "ERROR: install-mesa.sh must set MESA_WEB_VERSION from pack manifest" >&2
  exit 1
fi

cat >"$STAGE/README-VERIFY.zh.txt" <<EOF
Mesa 安装验证 / 客户安装
========================
本包 ID（每次打包唯一，勿与旧包混淆）:
  mesa-on-prem-${VER}
解压后文件夹名必须是上面这一串。不要用旧的 mesa-on-prem-latest / 旧 sha 目录。

店机 = 原生 Ubuntu + Docker Engine（Windows/WSL 全栈安装已作废）。

【客户 · Ubuntu】
1. 解压本 zip
2. 已装 Docker Engine + Compose 后执行：
   chmod +x install-ubuntu.sh
   sudo ./install-ubuntu.sh
   （默认装到 /opt/mesa；详见 README-UBUNTU.zh.txt）
3. 浏览器打开：http://<店内IP>/setup（edge :80；本机可用 http://127.0.0.1/setup）
4. 打印：另机安装 Windows MesaPrintAgent（apps/print-agent 发行包），
   服务器地址填 http://<店内局域网IP>（edge，勿 :3000、勿 localhost）

【已作废】
- Windows 主机 Install-Mesa.ps1 / MesaOnPremBackup / MesaOnPremStack
- START-WSL-TEST.cmd（Windows+WSL 验证入口）
EOF
printf '%s\n' "mesa-on-prem-${VER}" >"$STAGE/PACK-ID.txt"

cat >"$STAGE/manifest.json" <<EOF
{
  "name": "mesa-on-prem",
  "version": "$VER",
  "kind": "on-prem-release",
  "mesaHomeDefaultLinux": "/opt/mesa",
  "mesaHomeSelectable": true,
  "entrypoint": "install-ubuntu.sh",
  "customerEntrypointLinux": "install-ubuntu.sh",
  "upgradeEntrypoint": "deploy/on-prem/scripts/upgrade.sh",
  "stack": "mode-b",
  "hostOs": "ubuntu",
  "migrationsHead": "$MIG_HEAD",
  "supabaseVendorCommit": "$VENDOR_COMMIT",
  "printAgentMinVersion": "$PRINT_AGENT_MIN",
  "imagesLock": "deploy/on-prem/images.lock",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": [
    "Customer Ubuntu: sudo ./install-ubuntu.sh (default MESA_HOME=/opt/mesa).",
    "Print-agent: separate Windows install (not in this zip).",
    "Windows/WSL full-stack host install is retired.",
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
echo "Print-agent: separate Windows MesaPrintAgent install (not in this zip)"
