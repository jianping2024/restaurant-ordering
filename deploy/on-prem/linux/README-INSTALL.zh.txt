Mesa 门店纯本地 — Ubuntu / Debian 安装说明
==========================================

一、你需要什么
- Ubuntu 22.04 / 24.04（或兼容的 Debian）
- root（sudo）
- Docker Engine + Compose 插件（docker compose）
- 装机时建议有外网（首次拉镜像）
- 远程运维强烈建议：Tailscale + openssh-server（运维通道；不是顾客入口）
- 公网扫码：Cloudflare Tunnel（cloudflared）指到本机 :80；与 Tailscale 分工
- 打印：另需一台可跑 Windows MesaPrintAgent 的电脑（打印不进 Docker）

二、安装目录（MESA_HOME）
- 默认：/opt/mesa
- 可自选，例如：/var/lib/mesa 或 /home/mesa
- 栈代码、数据、日志、配置都在该目录下；只有一份 MESA_HOME

三、安装步骤
1. 解压 mesa-on-prem-<version>.zip
2. 安装 Docker（若尚未安装），官方文档：
   https://docs.docker.com/engine/install/ubuntu/
3. 在解压目录执行：
   chmod +x install-ubuntu.sh
   sudo ./install-ubuntu.sh
   # 或指定目录：
   sudo ./install-ubuntu.sh --mesa-home /opt/mesa
4. 浏览器打开 http://127.0.0.1/setup 完成开户（安装码 + 店主密码）
   （同域 edge 默认 :80；不要用 :3000 当正式入口）
5. 局域网访问用 http://<店内IP>/ ；Print Agent 见下一步
6. Print Agent（Windows MesaPrintAgent）「服务器地址」（完整见仓库
   docs/technical/on-prem-pack-install-upgrade.zh.md §2.2）：
   - 推荐：http://<店内IP>   （edge :80，不要 :3000）
   - 可选：http://<局域网名>  （DNS 已好且 Auth 白名单已含）
   - 不要：localhost / 127.0.0.1（Agent 在别的电脑上指不到店机）
   - 不要把公网域当店内主配置（断 Tunnel/外网则打印断）
7. Auth 多入口白名单（易漏；完整说明见 §2.1 同文档）：
   - 配置文件：MESA_HOME/current/deploy/on-prem/.env
   - 默认常只有 SITE_URL=http://<店内IP>，无 ADDITIONAL_REDIRECT_URLS
   - 启用 Cloudflare Tunnel（公网域）或局域网域名（如 pirata.lan）时，必须手写：
     ADDITIONAL_REDIRECT_URLS=http://<店内IP>/**,http://<局域网名>/**,https://<公网域>/**
   - 仅 ADDITIONAL_REDIRECT_URLS 即可；MESA_TUNNEL_ORIGIN 可选（bootstrap 时设可自动并入）
   - 改完：sudo /opt/mesa/bin/mesa-stack up -d --force-recreate auth
   - 店内断网仍用局域网 IP；DNS 未配好也可先写白名单
8. 可选：Cloudflare Tunnel 指到本机 :80（公网入口）；白名单见上一步
9. 看板不实时：见文档 §2.3（publication；升级包会跑 ensure）

四、连云 Ops 授权
- 先在云 Ops 登记「本地」门店并签发安装码
- /setup 认领成功后会写入本机配置；若需手改 .env：
  MESA_HOME/current/deploy/on-prem/.env
  授权：MESA_PLATFORM_LICENSE_URL / MESA_LICENSE_CHECKIN_CREDENTIAL / MESA_LICENSE_LEASE_SECRET
  Auth 白名单：ADDITIONAL_REDIRECT_URLS（见上「三、7」）
- 改授权后：sudo /opt/mesa/bin/mesa-stack up -d web
- 改 Auth 白名单后：sudo /opt/mesa/bin/mesa-stack up -d --force-recreate auth

五、常用命令
- 启停：  sudo /opt/mesa/bin/mesa-stack up|down|ps|logs
- 备份：  cd /opt/mesa/current/deploy/on-prem && sudo ./scripts/backup-local.sh
- 恢复：  sudo ./scripts/restore-local.sh [--Force] backups/<stamp>
- 升级：  （完整流程见仓库 docs/technical/on-prem-pack-install-upgrade.zh.md）
          export MESA_HOME=/opt/mesa
          cd /opt/mesa/current/deploy/on-prem
          sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>
- 回滚：  sudo ./scripts/rollback.sh   （已跑迁移则拒绝，请用恢复）
- 健康：  curl -sS http://127.0.0.1:3000/api/health/live
          curl -sS http://127.0.0.1:3000/api/health/ready
- 卸载服务（保留数据）：
  sudo ./deploy/on-prem/linux/uninstall-mesa.sh --mesa-home /opt/mesa
- 卸载并删数据：
  sudo ./deploy/on-prem/linux/uninstall-mesa.sh --mesa-home /opt/mesa --remove-data

六、开机自启
- 安装器默认注册 systemd：mesa-on-prem.service
- 跳过：sudo ./install-ubuntu.sh --skip-autostart
- 手动：sudo systemctl enable --now mesa-on-prem

七、注意
- 禁止营业中乱拉 latest；只装我们打好的 stamped 版本包
- 首次 web 镜像若未预构建，可加 --build-web（耗内存/时间）
- 升级含前端变更时不要 --SkipBuild；必须带 MESA_HOME 才能同步 apps/web
- 桌位二维码：用局域网 IP 或公网域打开后台再生成，勿用 localhost / 127.0.0.1
- 有 Tunnel / 局域网域名却漏 ADDITIONAL_REDIRECT_URLS → 登录回调失败（见三、7）
- Print Agent 勿填 localhost / :3000；推荐 http://<店内IP>（见三、6）
- 扫码下单不实时 → §2.3 / 三、9（勿轮询）
- Supabase vendor 大版本升级不在一键脚本内
- 完整说明：docs/technical/on-prem-pack-install-upgrade.zh.md
- 技术工具清单：docs/technical/local-perm-install-tools.zh.md
