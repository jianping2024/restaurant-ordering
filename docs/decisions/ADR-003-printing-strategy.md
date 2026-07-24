# ADR-003：打印策略

> **状态**：已定稿（本地交付对齐 2026-07-24）  
> **日期**：2026-07-24

## 背景

餐馆需要后厨出品联与前台账单/小票。需在浏览器打印、队列 + 本地代理之间选型。

## 决策

| 路径 | 场景 |
|------|------|
| **`print_jobs` + Windows print-agent** | 主路径（TCP 9100 / WinSpool USB ESC/POS） |
| **`window.print()` HTML** | 无代理或未配对时的兜底 |
| **向导本地试打** | 代理配置阶段，不经过生产队列 |

打印任务类型：`station_ticket` · `order_receipt` · `pre_bill`

### 云 SaaS（当前主产品）

- Web 写云库 `print_jobs`；agent 配对后连云 API claim / 回报。

### 门店纯本地（客户交付定稿）

- Web 写**本机**库 `print_jobs`；**同一套** Windows print-agent 作桥，服务器地址改为本机 Mesa。  
- agent **不进 Docker**；USB 与网口能力与现在相同。  
- 不做容器内 `print-worker` 替代（远期备选，见落地文档）。

落地：[`../local-only-rollout-steps.zh.md`](../local-only-rollout-steps.zh.md) §2.1、步骤 ③。

## 理由

- 热敏 ESC/POS 需字节级控制，浏览器打印不可靠  
- Windows agent 能稳定访问 USB（WinSpool）与局域网打印机  
- 统一 `print_jobs` 入队，便于重试与审计  

## 后果

- 需维护 Go 代理发布流水线（`print-agent-v*` 标签）  
- Web / `packages/shared` / Go 三处 JWT、路由、编码需同步  
- 吊销设备后 RLS 须立即拒绝代理访问（P0；本地实例同样适用）  
- 本地交付：安装器写本机 URL；自签证书时需 agent 信任策略  

## 详细说明

- [`../technical/04-printing.md`](../technical/04-printing.md)
- [`../print-agent-plan.md`](../print-agent-plan.md)

## 相关 ADR

- [ADR-001 离线 / 本地经营](./ADR-001-offline-first.md)
- [ADR-002 本地数据库](./ADR-002-local-database.md)
