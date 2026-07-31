# Mesa common helpers for on-prem Windows installer.
# Single install root: MESA_HOME (user-selectable; default %ProgramData%\Mesa).

Set-StrictMode -Version Latest

function Get-MesaDefaultHome {
  Join-Path $env:ProgramData "Mesa"
}

function Test-MesaIsAdministrator {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-MesaAdministrator {
  if (-not (Test-MesaIsAdministrator)) {
    throw "请以管理员身份运行安装器（右键 PowerShell → 以管理员身份运行）。"
  }
}

function Get-MesaLogPath {
  param([Parameter(Mandatory)][string]$MesaHome)
  $dir = Join-Path $MesaHome "logs"
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  Join-Path $dir "install.log"
}

function Write-MesaLog {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)][string]$Message,
    [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO"
  )
  $line = "{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}" -f (Get-Date), $Level, $Message
  $log = Get-MesaLogPath -MesaHome $MesaHome
  Add-Content -Path $log -Value $line -Encoding UTF8
  switch ($Level) {
    "WARN" { Write-Host $line -ForegroundColor Yellow }
    "ERROR" { Write-Host $line -ForegroundColor Red }
    default { Write-Host $line }
  }
}

function Get-MesaConfigPath {
  param([Parameter(Mandatory)][string]$MesaHome)
  Join-Path $MesaHome "config\install.json"
}

function Get-MesaStatePath {
  param([Parameter(Mandatory)][string]$MesaHome)
  Join-Path $MesaHome "config\install-state.json"
}

function Read-MesaInstallConfig {
  param([Parameter(Mandatory)][string]$MesaHome)
  $path = Get-MesaConfigPath -MesaHome $MesaHome
  if (-not (Test-Path $path)) { return $null }
  Get-Content -Raw -Path $path | ConvertFrom-Json
}

function Write-MesaInstallConfig {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)]$Config
  )
  $dir = Join-Path $MesaHome "config"
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $path = Get-MesaConfigPath -MesaHome $MesaHome
  ($Config | ConvertTo-Json -Depth 8) | Set-Content -Path $path -Encoding UTF8
}

function Read-MesaInstallState {
  param([Parameter(Mandatory)][string]$MesaHome)
  $path = Get-MesaStatePath -MesaHome $MesaHome
  if (-not (Test-Path $path)) { return $null }
  Get-Content -Raw -Path $path | ConvertFrom-Json
}

function Write-MesaInstallState {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)]$State
  )
  $dir = Join-Path $MesaHome "config"
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $path = Get-MesaStatePath -MesaHome $MesaHome
  ($State | ConvertTo-Json -Depth 8) | Set-Content -Path $path -Encoding UTF8
}

function Resolve-MesaHome {
  param(
    [string]$MesaHome,
    [switch]$NonInteractive
  )
  if ($MesaHome -and $MesaHome.Trim().Length -gt 0) {
    return [System.IO.Path]::GetFullPath($MesaHome.Trim())
  }
  $default = Get-MesaDefaultHome
  if ($NonInteractive) {
    return $default
  }
  Write-Host ""
  Write-Host "安装目录（MESA_HOME）：栈数据、配置、日志都会放在这里。"
  Write-Host "默认: $default"
  $reply = Read-Host "直接回车使用默认，或输入其他路径（例如 D:\Mesa）"
  if (-not $reply -or $reply.Trim().Length -eq 0) {
    return $default
  }
  return [System.IO.Path]::GetFullPath($reply.Trim())
}

function ConvertTo-MesaWslPath {
  param([Parameter(Mandatory)][string]$WindowsPath)
  $full = [System.IO.Path]::GetFullPath($WindowsPath)
  if ($full -match '^([A-Za-z]):\\(.*)$') {
    $drive = $Matches[1].ToLowerInvariant()
    $rest = ($Matches[2] -replace '\\', '/')
    return "/mnt/$drive/$rest"
  }
  throw "无法将路径转换为 WSL 路径: $WindowsPath"
}

function Get-MesaOnPremDir {
  param([Parameter(Mandatory)][string]$MesaHome)
  # Preferred layout after install copy:
  #   $MesaHome\current\deploy\on-prem
  # Dev / zip-run-in-place: installer lives under deploy/on-prem/windows
  $candidate = Join-Path $MesaHome "current\deploy\on-prem"
  if (Test-Path (Join-Path $candidate "compose.yaml")) {
    return $candidate
  }
  $here = $PSScriptRoot
  if ($here -match '[\\/]windows$') {
    $parent = Split-Path $here -Parent
    if (Test-Path (Join-Path $parent "compose.yaml")) {
      return $parent
    }
  }
  throw "找不到 Mode B 目录（期望 $MesaHome\current\deploy\on-prem 或仓库内 deploy/on-prem）。"
}

Export-ModuleMember -Function @(
  'Get-MesaDefaultHome',
  'Test-MesaIsAdministrator',
  'Assert-MesaAdministrator',
  'Get-MesaLogPath',
  'Write-MesaLog',
  'Get-MesaConfigPath',
  'Get-MesaStatePath',
  'Read-MesaInstallConfig',
  'Write-MesaInstallConfig',
  'Read-MesaInstallState',
  'Write-MesaInstallState',
  'Resolve-MesaHome',
  'ConvertTo-MesaWslPath',
  'Get-MesaOnPremDir'
)
