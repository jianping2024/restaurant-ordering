# Print-agent guidance for on-prem (agent stays on Windows; points at local Mesa).

Set-StrictMode -Version Latest

function Show-MesaPrintAgentGuidance {
  param(
    [Parameter(Mandatory)][string]$MesaHome,
    [string]$MesaUrl = "http://127.0.0.1:3000"
  )
  $msg = @"

======== 打印助手（print-agent）========
1. 安装现有 Windows 包：MesaPrintAgent-Setup-amd64.exe（或仓库 apps/print-agent 发行物）
2. 配对时「服务器地址」填本机 Mesa：$MesaUrl
   （局域网其它设备用 http://<本机局域网IP>:3000）
3. 不要填 Vercel / 平台云域名
4. Dashboard → 打印助手 → 生成配对码 → 托盘配对 → 映射档口 → 试打

配置目录示例: %USERPROFILE%\.config\mesa-print-agent\config.json
=====================================
"@
  Write-Host $msg -ForegroundColor Cyan
  Write-MesaLog -MesaHome $MesaHome -Message "已显示 print-agent 连接本机引导 ($MesaUrl)"
}

Export-ModuleMember -Function @('Show-MesaPrintAgentGuidance')
