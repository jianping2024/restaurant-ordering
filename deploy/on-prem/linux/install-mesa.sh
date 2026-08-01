#!/usr/bin/env bash
# Mesa on-prem installer for Ubuntu / Debian (customer path).
# Usage:
#   sudo ./install-mesa.sh [--mesa-home /opt/mesa] [--skip-pull] [--skip-autostart] [--build-web]
# Run from the unpacked pack (or from deploy/on-prem/linux/).
set -euo pipefail

MESA_HOME_DEFAULT="/opt/mesa"
MESA_HOME="${MESA_HOME:-$MESA_HOME_DEFAULT}"
SKIP_PULL=0
SKIP_AUTOSTART=0
BUILD_WEB=0

usage() {
  cat <<EOF
Usage: sudo $0 [options]

Options:
  --mesa-home DIR     Install root (default: /opt/mesa or \$MESA_HOME)
  --skip-pull         Do not docker compose pull (use local images)
  --skip-autostart    Do not install systemd unit
  --build-web         Force docker compose --build for web
  -h, --help          Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mesa-home)
      MESA_HOME="${2:?}"
      shift 2
      ;;
    --skip-pull) SKIP_PULL=1; shift ;;
    --skip-autostart) SKIP_AUTOSTART=1; shift ;;
    --build-web) BUILD_WEB=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() { printf '[mesa-install] %s\n' "$*"; }
die() { printf '[mesa-install] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  die "请用 root 运行（sudo）。示例: sudo ./install-mesa.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# .../mesa-on-prem-*/deploy/on-prem/linux → pack root is ../../..
SOURCE_ONPREM="$(cd "$SCRIPT_DIR/.." && pwd)"
PACK_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

[[ -f "$SOURCE_ONPREM/compose.yaml" ]] || die "缺少 compose.yaml: $SOURCE_ONPREM"
[[ -f "$PACK_ROOT/apps/web/Dockerfile" ]] || die "缺少 apps/web/Dockerfile（打包不完整）: $PACK_ROOT"

command -v docker >/dev/null 2>&1 || die "未找到 docker。请先安装 Docker Engine + Compose 插件（Ubuntu 官方文档）。"
docker info >/dev/null 2>&1 || die "无法连接 Docker daemon。请确认 docker 服务已启动，且当前用户可访问。"
docker compose version >/dev/null 2>&1 || die "需要 Docker Compose v2 插件（docker compose）。"

MESA_HOME="$(cd / && mkdir -p "$MESA_HOME" && cd "$MESA_HOME" && pwd)"
log "MESA_HOME=$MESA_HOME"
log "PACK_ROOT=$PACK_ROOT"

mkdir -p \
  "$MESA_HOME/current" \
  "$MESA_HOME/data/postgres" \
  "$MESA_HOME/data/storage" \
  "$MESA_HOME/logs" \
  "$MESA_HOME/config" \
  "$MESA_HOME/backups" \
  "$MESA_HOME/releases" \
  "$MESA_HOME/bin"

DEST_ROOT="$MESA_HOME/current"
DEST_ONPREM="$DEST_ROOT/deploy/on-prem"
ENV_FILE="$DEST_ONPREM/.env"
ENV_BACKUP=""
if [[ -f "$ENV_FILE" ]]; then
  ENV_BACKUP="$(mktemp)"
  cp -a "$ENV_FILE" "$ENV_BACKUP"
  log "已有 .env，安装后会保留"
fi

sync_tree() {
  local src="$1" dst="$2"
  mkdir -p "$dst"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.env' \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude 'vendor/supabase-docker/volumes/db/data' \
      --exclude 'vendor/supabase-docker/volumes/storage' \
      --exclude 'data' \
      --exclude 'backups' \
      --exclude '.releases' \
      "$src/" "$dst/"
  else
    # Fallback without rsync: copy then strip excluded
    rm -rf "$dst"
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

log "同步发行文件 → $DEST_ROOT"
mkdir -p "$DEST_ROOT/deploy" "$DEST_ROOT/apps" "$DEST_ROOT/packages" "$DEST_ROOT/supabase"
sync_tree "$SOURCE_ONPREM" "$DEST_ONPREM"
sync_tree "$PACK_ROOT/apps/web" "$DEST_ROOT/apps/web"
sync_tree "$PACK_ROOT/packages/shared" "$DEST_ROOT/packages/shared"
sync_tree "$PACK_ROOT/packages/ui" "$DEST_ROOT/packages/ui"
rsync -a --delete "$PACK_ROOT/supabase/migrations/" "$DEST_ROOT/supabase/migrations/" 2>/dev/null \
  || { mkdir -p "$DEST_ROOT/supabase/migrations"; cp -a "$PACK_ROOT/supabase/migrations/." "$DEST_ROOT/supabase/migrations/"; }
cp -a "$PACK_ROOT/package.json" "$PACK_ROOT/package-lock.json" "$DEST_ROOT/"
[[ -f "$PACK_ROOT/PACK-ID.txt" ]] && cp -a "$PACK_ROOT/PACK-ID.txt" "$DEST_ROOT/"
[[ -f "$PACK_ROOT/manifest.json" ]] && cp -a "$PACK_ROOT/manifest.json" "$DEST_ROOT/"
# Dockerfile COPYs this for pinned print-agent download links (must be in build context).
if [[ -f "$PACK_ROOT/apps/print-agent/VERSION" ]]; then
  mkdir -p "$DEST_ROOT/apps/print-agent"
  cp -a "$PACK_ROOT/apps/print-agent/VERSION" "$DEST_ROOT/apps/print-agent/VERSION"
fi
[[ -f "$PACK_ROOT/.dockerignore" ]] && cp -a "$PACK_ROOT/.dockerignore" "$DEST_ROOT/.dockerignore"

if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  rm -f "$ENV_BACKUP"
fi

# Persist DB/storage under MESA_HOME/data via bind mounts (symlinks into vendor volumes).
link_vol() {
  local link="$1" target="$2"
  mkdir -p "$(dirname "$link")" "$target"
  if [[ -L "$link" ]]; then
    return 0
  fi
  if [[ -e "$link" && ! -L "$link" ]]; then
    # Existing real dir from a previous vendor layout — leave alone if non-empty.
    if [[ -n "$(ls -A "$link" 2>/dev/null || true)" ]]; then
      log "保留已有数据目录: $link"
      return 0
    fi
    rmdir "$link" 2>/dev/null || true
  fi
  ln -sfn "$target" "$link"
}
link_vol "$DEST_ONPREM/vendor/supabase-docker/volumes/db/data" "$MESA_HOME/data/postgres"
link_vol "$DEST_ONPREM/vendor/supabase-docker/volumes/storage" "$MESA_HOME/data/storage"

chmod +x "$DEST_ONPREM"/scripts/*.sh "$DEST_ONPREM"/linux/*.sh 2>/dev/null || true

export MESA_REPO_ROOT="$DEST_ROOT"
cd "$DEST_ONPREM"

if [[ ! -f .env ]]; then
  log "生成 Mode B .env…"
  ./scripts/bootstrap-mode-b.sh
else
  log "复用已有 .env"
fi

if [[ "$SKIP_PULL" != "1" ]]; then
  log "拉取镜像…"
  ./scripts/stack.sh pull || log "WARN: pull 有错误，继续尝试 up"
fi

if [[ "$BUILD_WEB" == "1" ]]; then
  log "启动栈（含 --build web）…"
  ./scripts/stack.sh up -d --build
else
  log "启动栈…"
  ./scripts/stack.sh up -d
fi

log "等待数据库…"
for _ in $(seq 1 90); do
  if docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "应用 schema…"
MESA_SKIP_STACK_UP=1 ./scripts/apply-migrations.sh
./scripts/stack.sh up -d web

# Write install config (no secrets)
PACK_ID=""
[[ -f "$DEST_ROOT/PACK-ID.txt" ]] && PACK_ID="$(tr -d '[:space:]' <"$DEST_ROOT/PACK-ID.txt")"
cat >"$MESA_HOME/config/install.json" <<EOF
{
  "mesaHome": "$MESA_HOME",
  "onPremDir": "$DEST_ONPREM",
  "mesaRepoRoot": "$DEST_ROOT",
  "packId": "$PACK_ID",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": "linux"
}
EOF
chmod 644 "$MESA_HOME/config/install.json"

# Convenience wrappers
cat >"$MESA_HOME/bin/mesa-stack" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export MESA_REPO_ROOT="$DEST_ROOT"
cd "$DEST_ONPREM"
exec ./scripts/stack.sh "\$@"
EOF
chmod +x "$MESA_HOME/bin/mesa-stack"

if [[ "$SKIP_AUTOSTART" != "1" ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    UNIT=/etc/systemd/system/mesa-on-prem.service
    cat >"$UNIT" <<EOF
[Unit]
Description=Mesa on-prem Docker stack
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=MESA_REPO_ROOT=$DEST_ROOT
WorkingDirectory=$DEST_ONPREM
ExecStart=$DEST_ONPREM/scripts/stack.sh up -d
ExecStop=$DEST_ONPREM/scripts/stack.sh down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable mesa-on-prem.service >/dev/null
    log "已启用 systemd: mesa-on-prem.service"

    CUTOVER_UNIT=/etc/systemd/system/mesa-daily-cutover.service
    CUTOVER_TIMER=/etc/systemd/system/mesa-daily-cutover.timer
    sed \
      -e "s|__MESA_HOME__|${MESA_HOME}|g" \
      -e "s|__ONPREM_DIR__|${DEST_ONPREM}|g" \
      "$DEST_ONPREM/systemd/mesa-daily-cutover.service.in" >"$CUTOVER_UNIT"
    cp "$DEST_ONPREM/systemd/mesa-daily-cutover.timer" "$CUTOVER_TIMER"
    chmod +x "$DEST_ONPREM/scripts/daily-cutover.sh"
    systemctl daemon-reload
    systemctl enable --now mesa-daily-cutover.timer >/dev/null
    log "已启用 systemd timer: mesa-daily-cutover.timer（OnCalendar Europe/Lisbon 05:05）"
  else
    log "WARN: 无 systemctl，跳过开机自启"
  fi
fi

# Health (best-effort) — prefer edge origin from .env
WEB_URL="http://127.0.0.1"
if [[ -f "$DEST_ONPREM/.env" ]]; then
  base="$(grep -E '^NEXT_PUBLIC_BASE_URL=' "$DEST_ONPREM/.env" | head -1 | cut -d= -f2- || true)"
  [[ -n "$base" ]] && WEB_URL="$base"
fi
for _ in $(seq 1 60); do
  if curl -fsS "$WEB_URL/api/health/live" >/dev/null 2>&1; then
    log "健康检查: live OK ($WEB_URL)"
    break
  fi
  sleep 3
done

log ""
log "安装完成。"
log "  开户:  ${WEB_URL}/setup"
log "  主页:  $WEB_URL"
log "  栈目录: $DEST_ONPREM"
log "  启停:  $MESA_HOME/bin/mesa-stack up|down|ps|logs"
log "  打印:  另装 Windows MesaPrintAgent，服务器地址填 $WEB_URL"
log "  Cloudflare Tunnel → 本机 edge :${MESA_EDGE_PORT:-80}；店内断网仍用局域网打开同一套路径。"
log ""
