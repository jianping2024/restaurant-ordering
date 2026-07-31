Mesa 门店纯本地 — 安装说明（步骤 ⑤a）
=====================================

一、你需要什么
- Windows 11（正式支持 Pro；需开启固件虚拟化）
- 管理员权限
- 装机时建议有外网（拉 Docker 镜像）
- 可选：Git for Windows（提供 bash；否则用 WSL bash）

二、安装目录（MESA_HOME）
- 默认：%ProgramData%\Mesa
- 可自选其它盘，例如 D:\Mesa
- 栈数据、日志、配置都在该目录下；只有一份 MESA_HOME

三、安装步骤
1. 解压 mesa-on-prem-<version>.zip
2. 管理员打开 PowerShell：
   cd <解压目录>\deploy\on-prem\windows
   powershell -ExecutionPolicy Bypass -File .\Install-Mesa.ps1
3. 按提示选择安装目录，或：
   .\Install-Mesa.ps1 -MesaHome D:\Mesa -NonInteractive
4. 若提示重启以完成 WSL：重启后执行
   .\Install-Mesa.ps1 -MesaHome <你的目录> -Resume
5. 浏览器打开 http://127.0.0.1:3000/setup 完成开户
6. 安装 MesaPrintAgent，服务器地址填 http://127.0.0.1:3000

六、连云 Ops 授权（测试续期/远程停运时）
- 先在 https://restaurant-ordering-ops.vercel.app 登记「本地」门店并签发安装码
- claim 成功后把凭证写入 MESA_HOME 下 on-prem .env（或 compose 环境）：
  MESA_PLATFORM_LICENSE_URL=https://restaurant-ordering-ops.vercel.app
  MESA_LICENSE_CHECKIN_CREDENTIAL=<claim 返回的凭证>
  MESA_LICENSE_LEASE_SECRET=<与云 Ops 相同>
- 改完后重启 web 容器；进店主后台会做一次 check-in（非轮询）
- 注意：云 Ops 需已部署含 /api/platform/license/* 的版本并配置 MESA_LICENSE_LEASE_SECRET

七、常用命令
- 诊断：  .\Diagnose-Mesa.ps1 -MesaHome <目录>
- 日备：  .\Backup-Mesa.ps1 -MesaHome <目录>
- 恢复：  .\Restore-Mesa.ps1 -MesaHome <目录> -SnapshotDir <backups\时间戳> [-Force]
- 升级：  .\Upgrade-Mesa.ps1 -MesaHome <目录> -SourcePack <解压的 mesa-on-prem-新版本>
- 回滚：  .\Rollback-Mesa.ps1 -MesaHome <目录>   （已跑迁移则拒绝，请用恢复）
- 卸载服务（保留数据）：.\Uninstall-Mesa.ps1 -MesaHome <目录>
- 卸载并删数据：.\Uninstall-Mesa.ps1 -MesaHome <目录> -RemoveData

八、开机自启与日备
- 安装器注册计划任务 MesaOnPremStack（开机拉 Docker 栈）
- 安装器注册 MesaOnPremBackup（默认每天 03:00 本机备份；有 backup.env 则 restic 上传）
- 上传配置：复制 MESA_HOME\config\backup.env.example → backup.env，填写 RESTIC_* / AWS_*
- 打印助手请在 agent 安装向导勾选登录自启

九、升级注意
- 禁止营业中乱拉 latest；只装我们打好的版本包
- 升级会先备份；若迁移已写入库，失败请 Restore，不要只 Rollback 文件
- Supabase 大版本 / vendor 整栈升级不在一键脚本内

十、不做（本包仍不含）
- 代码签名 MSI、离线全量镜像包、自动升级代理
- 授权变量自动写入（claim 后需手写进 .env）
