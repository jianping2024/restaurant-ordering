# WSL2 + Docker readiness for Mesa on-prem (Engine-in-WSL; Desktop optional if already present).

Set-StrictMode -Version Latest

function Test-MesaDockerReady {
  try {
    $null = & docker info 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Test-MesaWslReady {
  try {
    $null = & wsl.exe -l -v 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Enable-MesaWslFeatures {
  param([Parameter(Mandatory)][string]$MesaHome)
  Write-MesaLog -MesaHome $MesaHome -Message "启用 Windows 功能: WSL + VirtualMachinePlatform"
  $features = @(
    "Microsoft-Windows-Subsystem-Linux",
    "VirtualMachinePlatform"
  )
  foreach ($f in $features) {
    $state = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue
    if ($state -and $state.State -eq 'Enabled') {
      Write-MesaLog -MesaHome $MesaHome -Message "功能已启用: $f"
      continue
    }
    Write-MesaLog -MesaHome $MesaHome -Message "正在启用: $f"
    Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart -ErrorAction Stop | Out-Null
  }
}

function Install-MesaWslDistroIfNeeded {
  param([Parameter(Mandatory)][string]$MesaHome)
  $list = & wsl.exe -l -q 2>$null
  if ($LASTEXITCODE -eq 0 -and $list) {
    Write-MesaLog -MesaHome $MesaHome -Message "已检测到 WSL 发行版"
    return
  }
  Write-MesaLog -MesaHome $MesaHome -Message "安装默认 WSL 发行版（可能较久）…"
  & wsl.exe --install --no-launch
  if ($LASTEXITCODE -ne 0) {
    throw "wsl --install 失败（退出码 $LASTEXITCODE）。请手动安装 WSL2 后重跑安装器。"
  }
}

function Install-MesaDockerEngineInWsl {
  param([Parameter(Mandatory)][string]$MesaHome)
  Write-MesaLog -MesaHome $MesaHome -Message "在 WSL 内安装 Docker Engine（官方 convenience script）…"
  $script = @'
set -euo pipefail
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "docker already ready"
  exit 0
fi
if ! command -v curl >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates
fi
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$(whoami)" || true
sudo service docker start || sudo systemctl start docker || true
docker info >/dev/null
'@
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
  & wsl.exe -e bash -lc "echo $b64 | base64 -d | bash"
  if ($LASTEXITCODE -ne 0) {
    throw "WSL 内 Docker Engine 安装失败。可进入 WSL 手动执行 get.docker.com 后重试。"
  }
}

function Ensure-MesaDockerWindowsShim {
  param([Parameter(Mandatory)][string]$MesaHome)
  $bin = Join-Path $MesaHome "bin"
  if (-not (Test-Path $bin)) {
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
  }
  $dockerCmd = Join-Path $bin "docker.cmd"
  $composeCmd = Join-Path $bin "docker-compose.cmd"
  @"
@echo off
wsl.exe -e docker %*
"@ | Set-Content -Path $dockerCmd -Encoding ASCII
  @"
@echo off
wsl.exe -e docker compose %*
"@ | Set-Content -Path $composeCmd -Encoding ASCII

  $path = [Environment]::GetEnvironmentVariable("Path", "Machine")
  if ($path -notlike "*$bin*") {
    [Environment]::SetEnvironmentVariable("Path", "$bin;$path", "Machine")
    $env:Path = "$bin;$env:Path"
    Write-MesaLog -MesaHome $MesaHome -Message "已将 $bin 加入系统 PATH（新开终端生效）"
  }
}

function Ensure-MesaWslDocker {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [switch]$SkipInstall
  )
  if (Test-MesaDockerReady) {
    Write-MesaLog -MesaHome $MesaHome -Message "Docker 已可用（docker info OK）"
    return [pscustomobject]@{ Ready = $true; NeedsReboot = $false }
  }

  if ($SkipInstall) {
    throw "未检测到可用的 Docker，且指定了 -SkipDockerInstall。请先安装 Docker Engine（WSL）或 Docker Desktop 后重试。"
  }

  Assert-MesaAdministrator
  Enable-MesaWslFeatures -MesaHome $MesaHome

  $state = Read-MesaInstallState -MesaHome $MesaHome
  if (-not $state) {
    $state = [pscustomobject]@{ phase = "wsl_features"; needsReboot = $true; updatedAt = (Get-Date).ToString("o") }
  } else {
    $state | Add-Member -NotePropertyName phase -NotePropertyValue "wsl_features" -Force
    $state | Add-Member -NotePropertyName needsReboot -NotePropertyValue $true -Force
    $state | Add-Member -NotePropertyName updatedAt -NotePropertyValue (Get-Date).ToString("o") -Force
  }
  Write-MesaInstallState -MesaHome $MesaHome -State $state

  # Feature enable often needs reboot before wsl --install works reliably.
  if (-not (Test-MesaWslReady)) {
    Write-MesaLog -MesaHome $MesaHome -Level WARN -Message "WSL 尚未就绪。请重启电脑后以管理员重新运行 Install-Mesa.ps1 -MesaHome `"$MesaHome`" -Resume"
    return [pscustomobject]@{ Ready = $false; NeedsReboot = $true }
  }

  Install-MesaWslDistroIfNeeded -MesaHome $MesaHome
  Install-MesaDockerEngineInWsl -MesaHome $MesaHome
  Ensure-MesaDockerWindowsShim -MesaHome $MesaHome

  # Re-check via wsl docker if native docker still missing
  if (-not (Test-MesaDockerReady)) {
    & wsl.exe -e docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Docker 安装后仍不可用。请重启后执行 Diagnose-Mesa.ps1，或在 WSL 内运行: sudo service docker start"
    }
    Ensure-MesaDockerWindowsShim -MesaHome $MesaHome
  }

  Write-MesaLog -MesaHome $MesaHome -Message "Docker / WSL 准备完成"
  return [pscustomobject]@{ Ready = $true; NeedsReboot = $false }
}

Export-ModuleMember -Function @(
  'Test-MesaDockerReady',
  'Test-MesaWslReady',
  'Enable-MesaWslFeatures',
  'Ensure-MesaWslDocker'
)
