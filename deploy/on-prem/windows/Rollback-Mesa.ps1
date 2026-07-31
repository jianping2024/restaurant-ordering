#Requires -Version 5.1
<#
.SYNOPSIS
  文件回滚到上一 release。若升级已跑迁移，默认拒绝并指引 Restore-Mesa。
#>
param(
  [string]$MesaHome = "",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Stack.psm1") -Force

Assert-MesaAdministrator

if (-not $MesaHome) {
  $MesaHome = Get-MesaDefaultHome
}
$config = Read-MesaInstallConfig -MesaHome $MesaHome
if (-not $config -or -not $config.onPremDir) {
  throw "未找到安装配置。"
}

$env:MESA_HOME = $MesaHome
$onPremDir = [string]$config.onPremDir
$bashArgs = @()
if ($Force) { $bashArgs += "--Force" }

Write-MesaLog -MesaHome $MesaHome -Message "Rollback-Mesa Force=$Force"
try {
  Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $onPremDir -ScriptRel "scripts/rollback.sh" -BashArgs $bashArgs
} catch {
  Write-Host "文件回滚不可用或已拒绝。若升级已应用迁移，请用:" -ForegroundColor Yellow
  Write-Host "  .\Restore-Mesa.ps1 -MesaHome `"$MesaHome`" -SnapshotDir <backups\\时间戳> -Force"
  throw
}

Write-Host "回滚完成。请确认营业冒烟（登录/开台）。" -ForegroundColor Green
