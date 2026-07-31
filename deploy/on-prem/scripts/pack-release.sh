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
