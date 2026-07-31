#Requires -Version 5.1
<#
.SYNOPSIS
  注册每日备份计划任务 MesaOnPremBackup（默认每天 03:00）。
#>
param(
  [Parameter(Mandatory)][string]$MesaHome,
  [string]$TimeOfDay = "03:00"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force

Assert-MesaAdministrator

$config = Read-MesaInstallConfig -MesaHome $MesaHome
if (-not $config -or -not $config.onPremDir) {
  throw "未找到安装配置 $MesaHome\config\install.json。"
}

$taskName = "MesaOnPremBackup"
$cmdPath = Join-Path $MesaHome "bin\run-backup.cmd"
$backupPs1 = Join-Path $PSScriptRoot "Backup-Mesa.ps1"

$cmd = @"
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "$backupPs1" -MesaHome "$MesaHome"
"@
$binDir = Split-Path $cmdPath -Parent
if (-not (Test-Path $binDir)) {
  New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}
Set-Content -Path $cmdPath -Value $cmd -Encoding ASCII

# Ensure backup.env.example is present for operators
$exampleSrc = Join-Path (Split-Path $PSScriptRoot -Parent) "config\backup.env.example"
$exampleDst = Join-Path $MesaHome "config\backup.env.example"
if ((Test-Path $exampleSrc) -and -not (Test-Path $exampleDst)) {
  Copy-Item $exampleSrc $exampleDst -Force
}

$action = New-ScheduledTaskAction -Execute $cmdPath
$trigger = New-ScheduledTaskTrigger -Daily -At $TimeOfDay
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-MesaLog -MesaHome $MesaHome -Message "已注册计划任务: $taskName @ $TimeOfDay → $cmdPath"
Write-Host "日备任务已注册: $taskName （每天 $TimeOfDay）"
Write-Host "可选：复制 $exampleDst 为 backup.env 并填写 RESTIC_* / AWS_* 以启用上传。"
Write-Host "手动跑一次: powershell -File `"$backupPs1`" -MesaHome `"$MesaHome`""
