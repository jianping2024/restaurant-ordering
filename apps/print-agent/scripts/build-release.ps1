# Build Mesa Print Agent Windows release artifacts (run on Windows with Go + Inno Setup 6).
# Usage: .\scripts\build-release.ps1 [-Version 0.1.0] [-Amd64Only]

param(
  [string]$Version = "",
  [switch]$Amd64Only
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Version) {
  $Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
}

$Dist = Join-Path $Root "dist"
if (Test-Path $Dist) {
  Remove-Item -Recurse -Force $Dist
}
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$archs = @(
  @{ Name = "amd64"; GoArch = "amd64" }
)
if (-not $Amd64Only) {
  $archs += @{ Name = "arm64"; GoArch = "arm64" }
}

foreach ($a in $archs) {
  $outDir = Join-Path $Dist $a.Name
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $env:GOOS = "windows"
  $env:GOARCH = $a.GoArch
  $exe = Join-Path $outDir "MesaPrintAgent.exe"
  Push-Location $Root
  try {
    go build -ldflags "-s -w -X main.Version=$Version" -o $exe .
    if ($LASTEXITCODE -ne 0) { throw "go build failed for $($a.Name) (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }

  Copy-Item (Join-Path $Root "installer\WINDOWS-README.txt") $outDir -Force
  $zipName = "MesaPrintAgent-windows-$($a.Name).zip"
  $zipPath = Join-Path $Dist $zipName
  if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
  Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zipPath -Force
  Write-Host "zip: $zipPath"
}

$iscc = $null
foreach ($candidate in @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
  )) {
  if (Test-Path $candidate) {
    $iscc = $candidate
    break
  }
}
if (-not $iscc) {
  $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($cmd) { $iscc = $cmd.Source }
}
if (-not $iscc) {
  throw "Inno Setup ISCC.exe not found. Install Inno Setup 6 or run: choco install innosetup -y"
}

$iss = Join-Path $Root "installer\mesa-print-agent.iss"
foreach ($a in $archs) {
  $src = Join-Path $Dist $a.Name
  $srcAbs = (Resolve-Path $src).Path
  Write-Host "ISCC $($a.Name) SourceDir=$srcAbs"
  & $iscc "/DMyAppVersion=$Version" "/DMyArch=$($a.Name)" "/DSourceDir=$srcAbs" $iss
  if ($LASTEXITCODE -ne 0) { throw "ISCC failed for $($a.Name) (exit $LASTEXITCODE)" }
}

$hashFile = Join-Path $Dist "SHA256SUMS"
$lines = Get-ChildItem $Dist -File | ForEach-Object {
  $h = Get-FileHash $_.FullName -Algorithm SHA256
  "$($h.Hash.ToLower())  $($_.Name)"
}
$lines | Set-Content $hashFile -Encoding ascii

Write-Host "Done. Version $Version — artifacts in $Dist"
Get-ChildItem $Dist -File | Format-Table Name, Length
