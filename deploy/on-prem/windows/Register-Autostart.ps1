#Requires -Version 5.1
<#
.SYNOPSIS
  注册 Mesa 开机自启：拉起 Mode B 栈（不依赖店员登录桌面才启动 Docker 任务）。
#>
param(
  [Parameter(Mandatory)][string]$MesaHome
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force

Assert-MesaAdministrator

$config = Read-MesaInstallConfig -MesaHome $MesaHome
if (-not $config -or -not $config.onPremDir) {
  throw "未找到安装配置 $MesaHome\config\install.json。请先运行 Install-Mesa.ps1。"
}
$onPremDir = [string]$config.onPremDir
$taskName = "MesaOnPremStack"

$bashHint = Join-Path $MesaHome "bin\start-stack.cmd"
$startCmd = @"
@echo off
setlocal
cd /d "$onPremDir"
where bash >nul 2>&1
if %ERRORLEVEL%==0 (
  bash ./scripts/stack.sh up
  exit /b %ERRORLEVEL%
)
if exist "C:\Program Files\Git\bin\bash.exe" (
  "C:\Program Files\Git\bin\bash.exe" ./scripts/stack.sh up
  exit /b %ERRORLEVEL%
)
wsl.exe -e bash -lc "cd '$(ConvertTo-MesaWslPath $onPremDir)' && ./scripts/stack.sh up"
"@
Set-Content -Path $bashHint -Value $startCmd -Encoding ASCII

$action = New-ScheduledTaskAction -Execute $bashHint
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-MesaLog -MesaHome $MesaHome -Message "已注册计划任务: $taskName → $bashHint"
Write-Host "开机自启已注册: $taskName"
Write-Host "print-agent 请在其安装向导中勾选「登录时启动」，或托盘常驻。"
