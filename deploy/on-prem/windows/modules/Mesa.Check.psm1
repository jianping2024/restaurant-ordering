# Preflight checks for Mesa on-prem installer.

Set-StrictMode -Version Latest

function Test-MesaWindowsSupported {
  $os = Get-CimInstance Win32_OperatingSystem
  $caption = [string]$os.Caption
  $build = [int]$os.BuildNumber
  $ok = ($caption -match 'Windows 10|Windows 11') -and ($build -ge 19041)
  [pscustomobject]@{
    Ok      = [bool]$ok
    Caption = $caption
    Build   = $build
    Message = if ($ok) { "操作系统可用: $caption (build $build)" } else { "需要 Windows 10 2004+ / Windows 11（正式支持 Win11 Pro）。当前: $caption build $build" }
  }
}

function Test-MesaVirtualizationEnabled {
  try {
    $out = (systeminfo.exe 2>$null | Select-String 'Hyper-V Requirements','Virtualization Enabled In Firmware','A hypervisor has been detected') -join "`n"
  } catch {
    $out = ""
  }
  $enabled = $false
  if ($out -match 'Virtualization Enabled In Firmware:\s*Yes') { $enabled = $true }
  if ($out -match 'A hypervisor has been detected') { $enabled = $true }
  # Fallback: Win32
  try {
    $proc = Get-CimInstance Win32_Processor | Select-Object -First 1
    if ($proc.VirtualizationFirmwareEnabled) { $enabled = $true }
  } catch {}
  [pscustomobject]@{
    Ok      = $enabled
    Message = if ($enabled) { "固件虚拟化已启用" } else { "未检测到固件虚拟化。请在 BIOS/UEFI 打开 Intel VT-x / AMD-V 后重试。" }
  }
}

function Test-MesaMemoryAndDisk {
  param([Parameter(Mandatory)][string]$MesaHome)
  $ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
  $driveRoot = [System.IO.Path]::GetPathRoot($MesaHome)
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($driveRoot.TrimEnd('\'))'"
  $freeGb = if ($disk) { [math]::Round($disk.FreeSpace / 1GB, 1) } else { 0 }
  $ramOk = $ramGb -ge 8
  $diskOk = $freeGb -ge 40
  $msgs = @()
  if (-not $ramOk) { $msgs += "内存建议 ≥8GB（正式建议 16GB），当前 ${ramGb}GB" }
  if (-not $diskOk) { $msgs += "安装盘可用空间建议 ≥40GB，当前 ${freeGb}GB（$driveRoot）" }
  if ($ramOk -and $diskOk) { $msgs += "内存 ${ramGb}GB，磁盘剩余 ${freeGb}GB（$driveRoot）" }
  [pscustomobject]@{
    Ok      = ($ramOk -and $diskOk)
    RamGb   = $ramGb
    FreeGb  = $freeGb
    Message = ($msgs -join '; ')
  }
}

function Test-MesaPortAvailable {
  param([Parameter(Mandatory)][int]$Port)
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $Port }
  -not [bool]$listeners
}

function Invoke-MesaPreflight {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [int[]]$Ports = @(3000, 8000, 54329)
  )
  $results = @()
  $results += Test-MesaWindowsSupported
  $results += Test-MesaVirtualizationEnabled
  $results += Test-MesaMemoryAndDisk -MesaHome $MesaHome

  foreach ($p in $Ports) {
    $free = Test-MesaPortAvailable -Port $p
    $results += [pscustomobject]@{
      Ok      = $free
      Message = if ($free) { "端口 $p 空闲" } else { "端口 $p 已被占用。请关闭占用进程或改 .env 端口后再装。" }
    }
  }

  $failed = @($results | Where-Object { -not $_.Ok })
  [pscustomobject]@{
    Ok      = ($failed.Count -eq 0)
    Results = $results
    Failed  = $failed
  }
}

Export-ModuleMember -Function @(
  'Test-MesaWindowsSupported',
  'Test-MesaVirtualizationEnabled',
  'Test-MesaMemoryAndDisk',
  'Test-MesaPortAvailable',
  'Invoke-MesaPreflight'
)
