# ADR-003：打印策略

> **状态**：骨架（阶段 1）— 待阶段 5 定稿  
> **日期**：待定

## 背景

餐馆需要后厨出品联与前台账单/小票。需在浏览器打印、云端队列 + 本地代理之间选型。

## 当前决策（初稿）

| 路径 | 场景 |
|------|------|
| **`print_jobs` + print-agent** | 已配对代理时的主路径（TCP / WinSpool ESC/POS） |
| **`window.print()` HTML** | 无代理或未配对时的兜底 |
| **向导本地试打** | 代理配置阶段，不经过生产队列 |

打印任务类型：`station_ticket` · `order_receipt` · `pre_bill`

## 理由

- 热敏 ESC/POS 需字节级控制，浏览器打印不可靠
- 本地代理可访问局域网打印机与 Windows 驱动
- 云端 `print_jobs` 统一入队，便于 Dashboard 重试与审计

## 后果

- 需维护 Go 代理发布流水线（`print-agent-v*` 标签）
- Web / `packages/shared` / Go 三处 JWT、路由、编码需同步
- 吊销设备后 RLS 须立即拒绝代理访问（P0 验收项）

## 详细说明

- [`../technical/04-printing.md`](../technical/04-printing.md)
- [`../print-agent-plan.md`](../print-agent-plan.md)

## 相关 ADR

- [ADR-001 离线优先](./ADR-001-offline-first.md)
- [ADR-002 本地数据库](./ADR-002-local-database.md)
