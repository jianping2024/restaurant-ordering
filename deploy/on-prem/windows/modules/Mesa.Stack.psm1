# Start Mode B stack from Windows via bash (Git Bash or WSL).

Set-StrictMode -Version Latest

function Get-MesaBashPath {
  $cmd = Get-Command bash -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $gitBash = "C:\Program Files\Git\bin\bash.exe"
  if (Test-Path $gitBash) { return $gitBash }
  # WSL bash as last resort
  $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
  if ($wsl) { return "WSL" }
  throw "未找到 bash。请安装 Git for Windows，或确保 WSL 可用。"
}

function Invoke-MesaOnPremScript {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)][string]$OnPremDir,
    [Parameter(Mandatory)][string]$ScriptRel,
    [string[]]$BashArgs = @()
  )
  $bash = Get-MesaBashPath
  $scriptWin = Join-Path $OnPremDir $ScriptRel
  if (-not (Test-Path $scriptWin)) {
    throw "缺少脚本: $scriptWin"
  }

  if ($bash -eq "WSL") {
    $wslDir = ConvertTo-MesaWslPath -WindowsPath $OnPremDir
    $argLine = ($BashArgs | ForEach-Object { $_ }) -join " "
    $cmd = "cd '$wslDir' && bash './$ScriptRel' $argLine"
    Write-MesaLog -MesaHome $MesaHome -Message "WSL: $cmd"
    & wsl.exe -e bash -lc $cmd
    if ($LASTEXITCODE -ne 0) { throw "脚本失败 ($ScriptRel)，退出码 $LASTEXITCODE。详见日志。" }
    return
  }

  Push-Location $OnPremDir
  try {
    Write-MesaLog -MesaHome $MesaHome -Message "bash $ScriptRel $($BashArgs -join ' ')"
    & $bash $ScriptRel @BashArgs
    if ($LASTEXITCODE -ne 0) { throw "脚本失败 ($ScriptRel)，退出码 $LASTEXITCODE。详见日志。" }
  } finally {
    Pop-Location
  }
}

function Start-MesaModeBStack {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)][string]$OnPremDir,
    [switch]$Pull
  )
  $envFile = Join-Path $OnPremDir ".env"
  if (-not (Test-Path $envFile)) {
    Write-MesaLog -MesaHome $MesaHome -Message "生成 Mode B .env…"
    Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $OnPremDir -ScriptRel "scripts/bootstrap-mode-b.sh"
  } else {
    Write-MesaLog -MesaHome $MesaHome -Message "复用已有 .env（幂等）"
  }

  if ($Pull) {
    Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $OnPremDir -ScriptRel "scripts/stack.sh" -BashArgs @("pull")
  }
  Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $OnPremDir -ScriptRel "scripts/stack.sh" -BashArgs @("up")
  Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $OnPremDir -ScriptRel "scripts/apply-migrations.sh"
  Invoke-MesaOnPremScript -MesaHome $MesaHome -OnPremDir $OnPremDir -ScriptRel "scripts/stack.sh" -BashArgs @("up", "web")
}

function Wait-MesaHealth {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [int]$TimeoutSec = 180
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $live = Invoke-RestMethod "$BaseUrl/api/health/live" -TimeoutSec 5
      $ready = Invoke-RestMethod "$BaseUrl/api/health/ready" -TimeoutSec 5
      if ($live.ok -and $ready.ok) {
        Write-MesaLog -MesaHome $MesaHome -Message "健康检查通过: live+ready"
        return $true
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  Write-MesaLog -MesaHome $MesaHome -Level WARN -Message "等待健康检查超时。可稍后运行 Diagnose-Mesa.ps1"
  return $false
}

Export-ModuleMember -Function @(
  'Get-MesaBashPath',
  'Invoke-MesaOnPremScript',
  'Start-MesaModeBStack',
  'Wait-MesaHealth'
)
