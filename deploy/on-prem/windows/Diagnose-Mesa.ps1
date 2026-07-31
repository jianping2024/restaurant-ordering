#Requires -Version 5.1
<#
.SYNOPSIS
  Mesa on-prem 诊断：目录、Docker、健康检查、计划任务。
#>
param(
  [string]$MesaHome = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Check.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.WslDocker.psm1") -Force

if (-not $MesaHome) {
  $MesaHome = Get-MesaDefaultHome
  $cfg = Read-MesaInstallConfig -MesaHome $MesaHome
  if (-not $cfg) {
    Write-Host "未在默认路径找到安装。请传入 -MesaHome" -ForegroundColor Yellow
  }
}

Write-Host "MESA_HOME: $MesaHome"
$config = Read-MesaInstallConfig -MesaHome $MesaHome
if ($config) {
  $config | ConvertTo-Json -Depth 5
} else {
  Write-Host "无 install.json" -ForegroundColor Yellow
}

Write-Host "`n== Docker =="
if (Test-MesaDockerReady) {
  Write-Host "docker info: OK"
} else {
  Write-Host "docker info: FAIL" -ForegroundColor Red
}

Write-Host "`n== Ports =="
foreach ($p in 3000, 8000, 54329) {
  $free = Test-MesaPortAvailable -Port $p
  Write-Host ("port {0}: {1}" -f $p, $(if ($free) { "free" } else { "in use" }))
}

Write-Host "`n== Health =="
try {
  Write-Host "live :" (Invoke-RestMethod "http://127.0.0.1:3000/api/health/live" | ConvertTo-Json -Compress)
} catch { Write-Host "live : FAIL $_" -ForegroundColor Red }
try {
  Write-Host "ready:" (Invoke-RestMethod "http://127.0.0.1:3000/api/health/ready" | ConvertTo-Json -Compress)
} catch { Write-Host "ready: FAIL $_" -ForegroundColor Red }
try {
  Write-Host "setup:" (Invoke-RestMethod "http://127.0.0.1:3000/api/setup/status" | ConvertTo-Json -Compress)
} catch { Write-Host "setup: FAIL $_" -ForegroundColor Red }

Write-Host "`n== Scheduled task =="
try {
  Get-ScheduledTask -TaskName "MesaOnPremStack" -ErrorAction Stop | Format-List TaskName, State
} catch {
  Write-Host "MesaOnPremStack 未注册"
}
try {
  Get-ScheduledTask -TaskName "MesaOnPremBackup" -ErrorAction Stop | Format-List TaskName, State
} catch {
  Write-Host "MesaOnPremBackup 未注册"
}

Write-Host "`n== Backup =="
$last = Join-Path $MesaHome "backups\LAST_RESULT.json"
if (Test-Path $last) {
  Write-Host (Get-Content -Raw $last)
} else {
  Write-Host "尚无 LAST_RESULT.json（未跑过 Backup-Mesa.ps1）"
}
$backupEnv = Join-Path $MesaHome "config\backup.env"
if (Test-Path $backupEnv) {
  Write-Host "backup.env: present (secrets not printed)"
} else {
  Write-Host "backup.env: missing — 上传跳过直至配置 RESTIC_*"
}

Write-Host "`n== Upgrade =="
$up = Join-Path $MesaHome "logs\LAST_UPGRADE.json"
if (Test-Path $up) {
  Write-Host (Get-Content -Raw $up)
} else {
  Write-Host "尚无 LAST_UPGRADE.json"
}
$cur = Join-Path $MesaHome "config\current.json"
if (Test-Path $cur) {
  Write-Host "current.json:"
  Write-Host (Get-Content -Raw $cur)
} else {
  Write-Host "尚无 current.json"
}

Write-Host "`n日志: $(Join-Path $MesaHome 'logs\install.log')"
