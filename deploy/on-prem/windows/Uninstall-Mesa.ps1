#Requires -Version 5.1
<#
.SYNOPSIS
  卸载 Mesa 服务（默认保留 MESA_HOME 数据目录）。

.PARAMETER RemoveData
  同时删除 MESA_HOME 下 data/（危险；需显式传入）。
#>
param(
  [Parameter(Mandatory)][string]$MesaHome,
  [switch]$RemoveData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Stack.psm1") -Force

Assert-MesaAdministrator

$config = Read-MesaInstallConfig -MesaHome $MesaHome
$onPremDir = if ($config -and $config.onPremDir) { [string]$config.onPremDir } else { $null }

Write-Host "停止计划任务…"
Unregister-ScheduledTask -TaskName "MesaOnPremStack" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "MesaOnPremBackup" -Confirm:$false -ErrorAction SilentlyContinue

if ($onPremDir -and (Test-Path $onPremDir)) {
  Write-Host "停止 Docker 栈…"
  try {
    Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $onPremDir -ScriptRel "scripts/stack.sh" -BashArgs @("down")
  } catch {
    Write-Host "stack down 失败（可忽略）: $_" -ForegroundColor Yellow
  }
}

if ($RemoveData) {
  Write-Host "删除数据目录 $MesaHome\data …" -ForegroundColor Red
  Remove-Item -Recurse -Force (Join-Path $MesaHome "data") -ErrorAction SilentlyContinue
  Write-Host "删除备份目录 $MesaHome\backups …" -ForegroundColor Red
  Remove-Item -Recurse -Force (Join-Path $MesaHome "backups") -ErrorAction SilentlyContinue
} else {
  Write-Host "已保留数据与备份（未传 -RemoveData）:"
  Write-Host "  $(Join-Path $MesaHome 'data')"
  Write-Host "  $(Join-Path $MesaHome 'backups')"
}

Write-Host "卸载完成。current/ 发行文件可手动删除；$MesaHome\config 仍保留以便查路径。"
