# Build Mesa Print Agent Windows release artifacts (run on Windows with Go + Inno Setup 6).
# Usage: .\scripts\build-release.ps1 [-Version 0.1.0]

param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $Version) {
  $Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
}

$Dist = Join-Path $Root "dist"
Remove-Item -Recurse -Force $Dist -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$archs = @(
  @{ Name = "amd64"; GoArch = "amd64" },
  @{ Name = "arm64"; GoArch = "arm64" }
)

foreach ($a in $archs) {
  $outDir = Join-Path $Dist $a.Name
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $env:GOOS = "windows"
  $env:GOARCH = $a.GoArch
  $exe = Join-Path $outDir "MesaPrintAgent.exe"
  Push-Location $Root
  go build -ldflags "-s -w -X main.Version=$Version" -o $exe .
  Pop-Location
  if ($LASTEXITCODE -ne 0) { throw "go build failed for $($a.Name)" }

  Copy-Item (Join-Path $Root "installer\WINDOWS-README.txt") $outDir
  $zipName = "MesaPrintAgent-windows-$($a.Name).zip"
  $zipPath = Join-Path $Dist $zipName
  Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zipPath -Force
  Write-Host "zip: $zipPath"
}

$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
  $iscc = "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $iscc)) {
  Write-Warning "Inno Setup not found — skipping .exe installers (zip builds OK)."
  exit 0
}

foreach ($a in $archs) {
  $src = Join-Path $Dist $a.Name
  & $iscc "/DMyAppVersion=$Version" "/DMyArch=$($a.Name)" "/DSourceDir=$src" (Join-Path $Root "installer\mesa-print-agent.iss")
  if ($LASTEXITCODE -ne 0) { throw "ISCC failed for $($a.Name)" }
}

$hashFile = Join-Path $Dist "SHA256SUMS"
Get-ChildItem $Dist -File | ForEach-Object {
  $h = Get-FileHash $_.FullName -Algorithm SHA256
  "$($h.Hash.ToLower())  $($_.Name)"
} | Set-Content $hashFile -Encoding ascii

Write-Host "Done. Version $Version — artifacts in $Dist"
