#Requires -Version 5.1
# Backward-compatible entry: thin N2 script now forwards to Install-Mesa.ps1 (⑤a).
param(
  [string]$MesaHome = "",
  [switch]$NonInteractive,
  [switch]$SkipDockerInstall
)
$here = $PSScriptRoot
& (Join-Path $here "Install-Mesa.ps1") -MesaHome $MesaHome -NonInteractive:$NonInteractive -SkipDockerInstall:$SkipDockerInstall
