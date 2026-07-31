#Requires -Version 5.1
<#
.SYNOPSIS
  Mesa 门店纯本地完整安装器（步骤 ⑤a）

.DESCRIPTION
  可选安装根目录 MESA_HOME（默认 %ProgramData%\Mesa）。
  检查环境 → WSL/Docker → 落盘 → Mode B 起栈 → 迁移 → 开户引导 → 开机自启 → 打印说明。

.PARAMETER MesaHome
  安装根目录。省略则交互询问（非交互默认 %ProgramData%\Mesa）。

.PARAMETER Resume
  重启后续跑（读取 MESA_HOME\config\install-state.json）。

.PARAMETER SkipDockerInstall
  不自动装 Docker；仅检测。

.PARAMETER NonInteractive
  不提问；目录用 -MesaHome 或默认。

.PARAMETER SkipAutostart
  不注册开机任务。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Install-Mesa.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Install-Mesa.ps1 -MesaHome D:\Mesa -NonInteractive
#>
param(
  [string]$MesaHome = "",
  [switch]$Resume,
  [switch]$SkipDockerInstall,
  [switch]$NonInteractive,
  [switch]$SkipAutostart,
  [switch]$SkipPull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$WindowsDir = $PSScriptRoot
$ModulesDir = Join-Path $WindowsDir "modules"
Import-Module (Join-Path $ModulesDir "Mesa.Common.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Check.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.WslDocker.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Layout.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Stack.psm1") -Force
Import-Module (Join-Path $ModulesDir "Mesa.Agent.psm1") -Force

Assert-MesaAdministrator

if ($Resume) {
  if (-not $MesaHome) {
    # Try default then prompt
    $cfgDefault = Get-MesaDefaultHome
    $cfgPath = Join-Path $cfgDefault "config\install.json"
    if (Test-Path $cfgPath) {
      $MesaHome = $cfgDefault
    }
  }
}

$MesaHome = Resolve-MesaHome -MesaHome $MesaHome -NonInteractive:$NonInteractive
if (-not (Test-Path $MesaHome)) {
  New-Item -ItemType Directory -Path $MesaHome -Force | Out-Null
}

Write-MesaLog -MesaHome $MesaHome -Message "=== Mesa Install 开始 === MESA_HOME=$MesaHome"

# Source on-prem: prefer running from repo/zip windows folder parent
$sourceOnPrem = Split-Path $WindowsDir -Parent
if (-not (Test-Path (Join-Path $sourceOnPrem "compose.yaml"))) {
  throw "找不到 Mode B compose.yaml（期望与 windows\ 同级的 deploy\on-prem）。"
}

$pre = Invoke-MesaPreflight -MesaHome $MesaHome
foreach ($r in $pre.Results) {
  $level = if ($r.Ok) { "INFO" } else { "ERROR" }
  Write-MesaLog -MesaHome $MesaHome -Level $level -Message $r.Message
}
if (-not $pre.Ok) {
  $detail = ($pre.Failed | ForEach-Object { $_.Message }) -join "`n - "
  throw "预检未通过:`n - $detail"
}

$docker = Ensure-MesaWslDocker -MesaHome $MesaHome -SkipInstall:$SkipDockerInstall
if ($docker.NeedsReboot -and -not $docker.Ready) {
  Write-MesaInstallConfig -MesaHome $MesaHome -Config ([pscustomobject]@{
      mesaHome     = $MesaHome
      version      = "5a"
      installedAt  = (Get-Date).ToString("o")
      pendingResume = $true
    })
  Write-Host ""
  Write-Host "需要重启 Windows 以完成 WSL 安装。" -ForegroundColor Yellow
  Write-Host "重启后请管理员执行:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -MesaHome `"$MesaHome`" -Resume" -ForegroundColor Yellow
  exit 2
}

$onPremDir = Initialize-MesaLayout -MesaHome $MesaHome -SourceOnPremDir $sourceOnPrem
Write-MesaLog -MesaHome $MesaHome -Message "Mode B 目录: $onPremDir"

Start-MesaModeBStack -MesaHome $MesaHome -OnPremDir $onPremDir -Pull:(-not $SkipPull)
$null = Wait-MesaHealth -MesaHome $MesaHome

if (-not $SkipAutostart) {
  $reg = Join-Path $WindowsDir "Register-Autostart.ps1"
  & $reg -MesaHome $MesaHome
}

$regBackup = Join-Path $WindowsDir "Register-BackupTask.ps1"
if (Test-Path $regBackup) {
  & $regBackup -MesaHome $MesaHome
}

Write-MesaInstallConfig -MesaHome $MesaHome -Config ([pscustomobject]@{
    mesaHome      = $MesaHome
    onPremDir     = $onPremDir
    version       = "5a"
    webUrl        = "http://127.0.0.1:3000"
    apiUrl        = "http://127.0.0.1:8000"
    installedAt   = (Get-Date).ToString("o")
    pendingResume = $false
  })

$migHead = $null
$migDir = Join-Path $MesaHome "current\supabase\migrations"
if (Test-Path $migDir) {
  $migHead = Get-ChildItem "$migDir\*.sql" -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -Last 1 -ExpandProperty Name
}
$currentPath = Join-Path $MesaHome "config\current.json"
@{
  schemaVersion         = 1
  version               = "5a-install"
  releaseDir            = (Join-Path $MesaHome "current")
  migrationsHead        = $migHead
  supabaseVendorCommit  = $null
  printAgentMinVersion  = $null
  updatedAt             = (Get-Date).ToUniversalTime().ToString("o")
  note                  = "Initial install; use Upgrade-Mesa.ps1 for later versions."
} | ConvertTo-Json -Depth 5 | Set-Content -Path $currentPath -Encoding UTF8

Write-MesaInstallState -MesaHome $MesaHome -State ([pscustomobject]@{
    phase      = "complete"
    needsReboot = $false
    updatedAt  = (Get-Date).ToString("o")
  })

Show-MesaPrintAgentGuidance -MesaHome $MesaHome -MesaUrl "http://127.0.0.1:3000"

Write-Host ""
Write-Host "安装完成。" -ForegroundColor Green
Write-Host "  MESA_HOME: $MesaHome"
Write-Host "  开户/登录: http://127.0.0.1:3000/setup  （空库）或 /auth/login"
Write-Host "  诊断:      powershell -File `"$(Join-Path $WindowsDir 'Diagnose-Mesa.ps1')`" -MesaHome `"$MesaHome`""
Write-Host "  日备:      powershell -File `"$(Join-Path $WindowsDir 'Backup-Mesa.ps1')`" -MesaHome `"$MesaHome`""
Write-Host "  升级:      powershell -File `"$(Join-Path $WindowsDir 'Upgrade-Mesa.ps1')`" -MesaHome `"$MesaHome`" -SourcePack <解压的新包>"
Write-Host "  备份上传:  复制 config\backup.env.example → backup.env 并填写 RESTIC_*"
Write-Host ""

try {
  Start-Process "http://127.0.0.1:3000/setup"
} catch {
  Write-MesaLog -MesaHome $MesaHome -Level WARN -Message "无法自动打开浏览器，请手动访问 /setup"
}
