#Requires -Version 5.1
<#
.SYNOPSIS
  从本地 snapshot 恢复（或先 restic restore 到目录再指向该目录）。
#>
param(
  [string]$MesaHome = "",
  [Parameter(Mandatory)][string]$SnapshotDir,
  [switch]$Force,
  [switch]$NoStorage
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
  throw "未找到安装配置。请传入 -MesaHome。"
}
$onPremDir = [string]$config.onPremDir
$env:MESA_HOME = $MesaHome

if (-not (Test-Path $SnapshotDir)) {
  throw "Snapshot 不存在: $SnapshotDir"
}

$flagArgs = @()
if ($Force) { $flagArgs += "--Force" }
if ($NoStorage) { $flagArgs += "--NoStorage" }

Write-MesaLog -MesaHome $MesaHome -Message "开始恢复 Restore-Mesa snapshot=$SnapshotDir"

$code = 1
if (Get-Command bash -ErrorAction SilentlyContinue) {
  Push-Location $onPremDir
  try {
    & bash ./scripts/restore-local.sh @flagArgs $SnapshotDir
    $code = $LASTEXITCODE
  } finally { Pop-Location }
} elseif (Test-Path "C:\Program Files\Git\bin\bash.exe") {
  Push-Location $onPremDir
  try {
    & "C:\Program Files\Git\bin\bash.exe" ./scripts/restore-local.sh @flagArgs $SnapshotDir
    $code = $LASTEXITCODE
  } finally { Pop-Location }
} else {
  $wslOnPrem = ConvertTo-MesaWslPath $onPremDir
  $wslSnap = ConvertTo-MesaWslPath $SnapshotDir
  $wslHome = ConvertTo-MesaWslPath $MesaHome
  $extra = ($flagArgs -join " ")
  & wsl.exe -e bash -lc "export MESA_HOME='$wslHome'; cd '$wslOnPrem' && ./scripts/restore-local.sh $extra '$wslSnap'"
  $code = $LASTEXITCODE
}

if ($code -ne 0) {
  throw "恢复失败 exit=$code"
}
Write-Host "恢复完成。请检查 Web 健康与登录。" -ForegroundColor Green
