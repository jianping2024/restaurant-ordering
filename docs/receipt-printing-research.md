# 热敏小票打印（调研摘要）

**应用形态**：Next.js + Supabase 云端；浏览器无法直连店内 `ESC/POS` 或 `IP:9100`。  
**当前实现**：`OrdersHistoryManager` 使用 HTML + `window.print()`（系统打印队列）；有 print-agent 时 **`print_jobs` 热敏为主路径**。

**桌位与 payload（已定）**：与 [`restaurant-tables-design.zh.md`](./restaurant-tables-design.zh.md) 一致——`station_ticket` / `order_receipt` / `pre_bill` 入队时 **成对写入** `table_id` + `display_name` 快照；**纸面只印 display_name**；`table_id` 供日志、队列筛选与重打关联。

---

## 路线对比

| 路线 | 说明 |
|------|------|
| **HTML 打印** | 零安装；调 `@page` 80mm、等宽字体；钱箱/静默控制弱。 |
| **店内打印代理** | 收银机常驻小进程，拉 `print_jobs` → TCP 写网口 `9100`；无第三方许可；需自研安装与分发。 |
| **QZ Tray** | 浏览器经本机 QZ 打 RAW；见 [qz.io](https://qz.io) 文档与许可；**本仓库未集成**，需时自行接入。 |

---

## 自建代理（简单场景）步骤与成本

**步骤**：**网口热敏** + 路由器 **DHCP 保留**（或静态私网 IP）→ Supabase `print_jobs` + Realtime → Mesa 入队 → **`apps/print-agent`（Go）** 订阅/补偿拉取 → `TCP` 写 **`IP:9100`** → 更新状态；Windows 计划任务保活。  
**成本**：一般无额外服务器；开发量见 `print-agent-plan.md`；维护主要为 **换网段时改代理里的打印机地址**。

---

*许可与第三方产品以各官方为准。*

详细分端实施步骤见 **[docs/print-agent-plan.md](./print-agent-plan.md)**（应用端 Mesa/Supabase vs 安装包/代理端）。
