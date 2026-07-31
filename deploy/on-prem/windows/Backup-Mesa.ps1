#Requires -Version 5.1
<#
.SYNOPSIS
  运行本机日备（Postgres + Storage）并在配置了 restic 时上传。
#>
param(
  [string]$MesaHome = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ModulesDir = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force

if (-not $MesaHome) {
  $MesaHome = Get-MesaDefaultHome
}
$config = Read-MesaInstallConfig -MesaHome $MesaHome
if (-not $config -or -not $config.onPremDir) {
  throw "未找到安装配置。请传入 -MesaHome 或先 Install-Mesa.ps1。"
}
$onPremDir = [string]$config.onPremDir

$backupRoot = Join-Path $MesaHome "backups"
if (-not (Test-Path $backupRoot)) {
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

$env:MESA_HOME = $MesaHome
$env:BACKUP_ROOT = $backupRoot

function Invoke-MesaBash {
  param([string]$ScriptRel)
  $scriptPath = Join-Path $onPremDir $ScriptRel
  if (-not (Test-Path $scriptPath)) {
    throw "缺少脚本: $scriptPath"
  }
  $wslPath = ConvertTo-MesaWslPath $onPremDir
  if (Get-Command bash -ErrorAction SilentlyContinue) {
    Push-Location $onPremDir
    try {
      & bash "./$ScriptRel"
      return $LASTEXITCODE
    } finally {
      Pop-Location
    }
  }
  $gitBash = "C:\Program Files\Git\bin\bash.exe"
  if (Test-Path $gitBash) {
    Push-Location $onPremDir
    try {
      & $gitBash "./$ScriptRel"
      return $LASTEXITCODE
    } finally {
      Pop-Location
    }
  }
  & wsl.exe -e bash -lc "export MESA_HOME='$(ConvertTo-MesaWslPath $MesaHome)'; export BACKUP_ROOT='$(ConvertTo-MesaWslPath $backupRoot)'; cd '$wslPath' && ./$ScriptRel"
  return $LASTEXITCODE
}

Write-MesaLog -MesaHome $MesaHome -Message "开始日备 Backup-Mesa"
$code = Invoke-MesaBash -ScriptRel "scripts/backup-local.sh"
$last = Join-Path $backupRoot "LAST_RESULT.json"
if (Test-Path $last) {
  Write-Host (Get-Content -Raw $last)
  Write-MesaLog -MesaHome $MesaHome -Message "LAST_RESULT: $(Get-Content -Raw $last)"
}
if ($code -ne 0) {
  Write-MesaLog -MesaHome $MesaHome -Level ERROR -Message "日备失败 exit=$code"
  exit $code
}
Write-Host "日备完成（上传失败仍算本地成功，见 LAST_RESULT.uploadStatus）" -ForegroundColor Green
