# Layout under MESA_HOME: current / data / logs / config / bin

Set-StrictMode -Version Latest

function Initialize-MesaLayout {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [Parameter(Mandatory)][string]$SourceOnPremDir
  )
  $dirs = @(
    $MesaHome,
    (Join-Path $MesaHome "current"),
    (Join-Path $MesaHome "data"),
    (Join-Path $MesaHome "data\postgres"),
    (Join-Path $MesaHome "data\storage"),
    (Join-Path $MesaHome "logs"),
    (Join-Path $MesaHome "config"),
    (Join-Path $MesaHome "backups"),
    (Join-Path $MesaHome "releases"),
    (Join-Path $MesaHome "bin")
  )
  foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
  }

  $sourceOnPrem = [System.IO.Path]::GetFullPath($SourceOnPremDir)
  $destOnPrem = [System.IO.Path]::GetFullPath((Join-Path $MesaHome "current\deploy\on-prem"))
  # SourceOnPremDir = <root>/deploy/on-prem → repo/pack root is two levels up
  $packRoot = [System.IO.Path]::GetFullPath((Split-Path (Split-Path $sourceOnPrem -Parent) -Parent))

  if ($sourceOnPrem -eq $destOnPrem) {
    Write-MesaLog -MesaHome $MesaHome -Message "已在 MESA_HOME\current 内运行，跳过文件同步"
    return $destOnPrem
  }

  Write-MesaLog -MesaHome $MesaHome -Message "同步发行文件到 $(Join-Path $MesaHome 'current')"

  $envBackup = $null
  $envFile = Join-Path $destOnPrem ".env"
  if (Test-Path $envFile) {
    $envBackup = Get-Content -Raw $envFile
  }

  New-Item -ItemType Directory -Path (Split-Path $destOnPrem -Parent) -Force | Out-Null
  robocopy $sourceOnPrem $destOnPrem /E /XD `
    "vendor\supabase-docker\volumes\db\data" `
    "vendor\supabase-docker\volumes\storage" `
    /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  # robocopy exit 0-7 are success
  if ($LASTEXITCODE -ge 8) {
    throw "同步 deploy/on-prem 失败（robocopy=$LASTEXITCODE）"
  }
  if ($envBackup) {
    Set-Content -Path $envFile -Value $envBackup -Encoding UTF8
  }

  foreach ($rel in @("apps\web", "packages\shared", "packages\ui", "package.json", "package-lock.json", "supabase\migrations")) {
    $src = Join-Path $packRoot $rel
    $dst = Join-Path $MesaHome "current\$rel"
    if (-not (Test-Path $src)) {
      Write-MesaLog -MesaHome $MesaHome -Level WARN -Message "缺少源路径（打包不完整？）: $src"
      continue
    }
    if (Test-Path $src -PathType Container) {
      New-Item -ItemType Directory -Path $dst -Force | Out-Null
      robocopy $src $dst /E /XD "node_modules" ".next" /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
      if ($LASTEXITCODE -ge 8) {
        throw "同步 $rel 失败（robocopy=$LASTEXITCODE）"
      }
    } else {
      $parent = Split-Path $dst -Parent
      if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
      Copy-Item $src $dst -Force
    }
  }

  $vendorDbData = Join-Path $destOnPrem "vendor\supabase-docker\volumes\db\data"
  $vendorStorage = Join-Path $destOnPrem "vendor\supabase-docker\volumes\storage"
  $dataPg = Join-Path $MesaHome "data\postgres"
  $dataSt = Join-Path $MesaHome "data\storage"

  foreach ($pair in @(
      @{ Link = $vendorDbData; Target = $dataPg },
      @{ Link = $vendorStorage; Target = $dataSt }
    )) {
    if (Test-Path $pair.Link) { continue }
    $parent = Split-Path $pair.Link -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    cmd.exe /c "mklink /J `"$($pair.Link)`" `"$($pair.Target)`"" | Out-Null
  }

  return $destOnPrem
}

Export-ModuleMember -Function @('Initialize-MesaLayout')
