#Requires -Version 5.1
<#
.SYNOPSIS
  升级已安装的 Mesa on-prem（⑦a）：备份 → 同步新包 → 增量迁移 → 重建 Web → 健康检查。
#>
param(
  [string]$MesaHome = "",
  [Parameter(Mandatory)][string]$SourcePack,
  [switch]$SkipBackup,
  [switch]$SkipBuild
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
  throw "未找到安装配置。请先 Install-Mesa.ps1 或传入正确 -MesaHome。"
}
if (-not (Test-Path $SourcePack)) {
  throw "SourcePack 不存在: $SourcePack"
}

$SourcePack = [System.IO.Path]::GetFullPath($SourcePack)
$env:MESA_HOME = $MesaHome

$releases = Join-Path $MesaHome "releases"
if (-not (Test-Path $releases)) {
  New-Item -ItemType Directory -Path $releases -Force | Out-Null
}

$bashArgs = @()
if ($SkipBackup) { $bashArgs += "--SkipBackup" }
if ($SkipBuild) { $bashArgs += "--SkipBuild" }
$bashArgs += $SourcePack

# Prefer upgrade.sh from the *new* pack if present, else current install
$onPremDir = [string]$config.onPremDir
$newOnPrem = Join-Path $SourcePack "deploy\on-prem"
if (Test-Path (Join-Path $newOnPrem "scripts\upgrade.sh")) {
  $runDir = $newOnPrem
} else {
  $runDir = $onPremDir
}

Write-MesaLog -MesaHome $MesaHome -Message "Upgrade-Mesa source=$SourcePack"
Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $runDir -ScriptRel "scripts/upgrade.sh" -BashArgs $bashArgs

# Refresh install.json pointers
$currentJson = Join-Path $MesaHome "config\current.json"
$ver = $null
if (Test-Path $currentJson) {
  $cur = Get-Content -Raw $currentJson | ConvertFrom-Json
  $ver = $cur.version
}
Write-MesaInstallConfig -MesaHome $MesaHome -Config ([pscustomobject]@{
    mesaHome      = $MesaHome
    onPremDir     = (Join-Path $MesaHome "current\deploy\on-prem")
    version       = $(if ($ver) { $ver } else { "upgraded" })
    webUrl        = "http://127.0.0.1:3000"
    apiUrl        = "http://127.0.0.1:8000"
    installedAt   = $(if ($config.installedAt) { $config.installedAt } else { (Get-Date).ToString("o") })
    upgradedAt    = (Get-Date).ToString("o")
    pendingResume = $false
  })

Write-Host "升级完成。详见 $(Join-Path $MesaHome 'logs\LAST_UPGRADE.json')" -ForegroundColor Green
Write-Host "若 print-agent 低于 manifest.printAgentMinVersion，请单独升级 Windows 安装包。"
