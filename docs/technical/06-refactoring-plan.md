# 分阶段重构计划

> **状态**：阶段 6 已定稿（2026-06-30）  
> **读者**：产品、开发、AI 代理  
> **前置**：阶段 0 审计 + `docs/product/*`、`docs/design/*`、`docs/technical/01–05`

## 用途

指导阶段 7「小步重构」的执行顺序与边界。**每次只做一个任务**，完成后停止等确认。

**全局禁止**

- 未更新 `docs/product/04-business-rules.md` 就改业务规则
- 纸面打印 `table_id` 或恢复 `table_number`
- 削弱 RLS / 暴露 service role
- 使用 `window.confirm`、无说明整文件重写
- 高风险与低风险任务混在同一 PR

---

## 1. 当前主要结构问题

| # | 问题 | 证据 / 影响 |
|---|------|-------------|
| P1 | API 命名空间三套（`dashboard` / `restaurants/[slug]` / `print-agent`） | 难定位；易改错路由 |
| P2 | `lib/` 扁平与深嵌混用 | `dashboard-menu-server.ts`（927 行）、`bill-split-by-item.ts`（923 行） |
| P3 | 巨型 UI 组件 | `MenuManager` ~1635 行、`BillPage` ~1050、`CheckoutRequestsManager` ~689 |
| P4 | 类型/常量分散 | `types/index.ts` 膨胀 + 字面量重复 |
| P5 | 结账/关台/转台强依赖 RPC | 须 migration + app 同步 |
| P6 | 打印三端同步 | web 入队 + `packages/shared` + Go |
| P7 | 测试不均 | lib 有单测；巨型组件/RPC 路径少集成测试 |
| P8 | 设计组件未统一 | 多套确认框；状态 badge 未抽取 |
| P9 | `print_locale` 无 Dashboard UI | DB 已用，设置缺口 |

---

## 2. 建议目标目录结构

**原则**：按领域分包；route 薄；UI 薄；RPC/RLS 不动除非单列高风险任务。

```text
apps/web/src/
  app/                          # 路由薄层（不变更 URL）
  components/
    ui/                         # 设计系统
    dashboard/<domain>/         # 按领域拆 Manager
    menu/  waiter/  kitchen/
  lib/
    constants/                  # 状态枚举单点
    types/                      # 或 domain/*.types.ts
    <domain>/
      *.repository.ts
      *.service.ts
      *.test.ts
    checkout/  bill-split/  print/  buffet/  table-session/  analytics/  audit/
packages/shared/                # 跨 web/ops（保持）
```

**不建议**现阶段：换框架、全局 store、微服务、迁移离 Supabase。

---

## 3. 低风险任务

### L1 — 文档与索引维护

| 项 | 内容 |
|----|------|
| 目标 | 业务改动同步 `docs/product`、`docs/technical`；ADR-001/002 定稿 |
| 允许修改 | `docs/**` |
| 禁止修改 | 业务代码、migration |
| 测试 | 人工对照代码路径 |
| 验收 | 功能地图与 API 清单无过时路径 |
| 回滚 | Git revert 文档 |

### L2 — 统一状态常量与类型出口 ⭐ 阶段 7 首个任务

| 项 | 内容 |
|----|------|
| 目标 | `OrderStatus`、`SessionStatus`、`BillStatus` 等单点定义；等价替换字面量 |
| 允许修改 | `lib/constants/*` 或 `types/`；仅等价 import 替换 |
| 禁止修改 | 订单/结账/打印业务逻辑；RPC；UI 行为 |
| 测试 | `npm run lint`；相关单测；print-agent 无变更则不必 Docker go test |
| 验收 | 无行为变化；常量单点 |
| 回滚 | revert 单 PR；无数据影响 |

### L3 — 抽取状态 Badge / 金额展示组件

| 项 | 内容 |
|----|------|
| 目标 | `OrderStatusBadge`、`MoneyAmount`（`tabular-nums` + €） |
| 允许修改 | `components/ui/`；替换展示层 |
| 禁止修改 | 金额计算、结账状态机 |
| 测试 | lint；目视结账/订单页 |
| 验收 | 符合 `docs/design/03-component-rules.md` |
| 回滚 | UI-only revert |

### L4 — 确认对话框收敛

| 项 | 内容 |
|----|------|
| 目标 | 明确 `ConfirmModal` vs `ReasonConfirmDialog` 选用；小步替换 |
| 允许修改 | 设计文档 + 可选 1–2 处示范 |
| 禁止修改 | 退菜/关台原因校验逻辑 |
| 测试 | 关台、退菜、恢复点餐弹窗 |
| 验收 | 无 `window.confirm` 新增 |
| 回滚 | 低 |

### L5 — `print_locale` Dashboard 设置 UI

| 项 | 内容 |
|----|------|
| 目标 | `SettingsForm` 三选一写入 `restaurants.print_locale` |
| 允许修改 | `SettingsForm.tsx`、`api/restaurant/settings`、i18n |
| 禁止修改 | 入队算法、ESC/POS |
| 测试 | lint；改设置 → 检查入队 payload |
| 验收 | 可读写；默认 `pt` |
| 回滚 | UI revert |

### L6 — 设置页与空状态整理

| 项 | 内容 |
|----|------|
| 目标 | 设置子页统一空态/错误态 |
| 允许修改 | `dashboard/settings/**`、`components/dashboard/settings/**` |
| 禁止修改 | `feature_flags` 语义、RLS |
| 测试 | lint；各设置子页点击 |
| 验收 | 无功能变化 |
| 回滚 | 低 |

### L7 — i18n 小模块外移

| 项 | 内容 |
|----|------|
| 目标 | `CartDrawer` 等内联文案迁入 `messages.ts` |
| 允许修改 | 文案文件 + 引用组件 |
| 禁止修改 | 三语文案含义 |
| 测试 | lint；三语切换目视 |
| 验收 | 无单语硬编码 |
| 回滚 | 低 |

---

## 4. 中风险任务

### M1 — `MenuManager` 拆分

| 项 | 内容 |
|----|------|
| 目标 | 按 Tab 拆子 Panel；server 逻辑可后续拆 repository |
| 允许修改 | `MenuManager.tsx`、新子组件 |
| 禁止修改 | schema；append 价格；VAT |
| 测试 | lint；`dashboard-menu.test.ts`；手动 CRUD/上下架 |
| 验收 | 功能一致 |
| 回滚 | UI revert |

### M2 — `dashboard-menu-server` 分层

| 项 | 内容 |
|----|------|
| 目标 | `menu.repository.ts` + `menu.service.ts` |
| 允许修改 | `lib/dashboard-menu-*`、`api/dashboard/menu/*` |
| 禁止修改 | Storage 路径；租户过滤 |
| 测试 | `dashboard-menu.test.ts` |
| 验收 | API 契约不变（`03-api-contracts.md`） |
| 回滚 | 中；查询错误可能越权 |

### M3 — 经营分析模块巩固

| 项 | 内容 |
|----|------|
| 目标 | 页面只调 `analytics.service` |
| 允许修改 | `lib/analytics/*`、`ValueAnalyticsPageClient.tsx` |
| 禁止修改 | 营业额/客数口径（改须同步 `04-business-rules.md`） |
| 测试 | `analytics.service.test.ts` |
| 验收 | 与 `value-analytics-design.zh.md` 一致 |
| 回滚 | 中 |

### M4 — 按菜分单 UI 组件化

| 项 | 内容 |
|----|------|
| 目标 | `BillPage` 减重；hooks 抽离 |
| 允许修改 | `BillPage.tsx`、`components/menu/*` |
| 禁止修改 | `bill-split-by-item.ts` 算法；checkout payload |
| 测试 | `bill-split-*.test.ts`；手动三种分单 |
| 验收 | 续结锁定不变 |
| 回滚 | 中 |

### M5 — 筛选组件统一

| 项 | 内容 |
|----|------|
| 目标 | 订单历史、异常操作共用日期/筛选模式 |
| 允许修改 | `OrdersHistoryManager`、`AbnormalOperationsManager` |
| 禁止修改 | 查询语义、Lisbon 日历 |
| 测试 | abnormal 相关单测 |
| 验收 | 列表结果一致 |
| 回滚 | 低–中 |

### M6 — 单 route 薄封装

| 项 | 内容 |
|----|------|
| 目标 | 厚 route 迁入 service；route 保持薄 |
| 允许修改 | 单个 `route.ts` + 对应 service |
| 禁止修改 | HTTP 路径、状态码、error code |
| 测试 | 路由相关 test 或手动流程 |
| 验收 | 契约不变 |
| 回滚 | 中 |

---

## 5. 高风险任务

> 阶段 7 每次一个；先出方案等确认；RPC/RLS 须评审。

### H1 — 结账确认收款路径加固

| 项 | 内容 |
|----|------|
| 目标 | 并发竞态验收；补测试/剧本 |
| 允许修改 | `checkout-confirm-payment.ts`、测试、仅必要时 RPC |
| 禁止修改 | 收款金额公式；台账语义 |
| 测试 | `checkout-confirm-payment.test.ts`；并发场景 |
| 验收 | `checkout-confirm-payment-race.zh.md` |
| 回滚 | **高** |

### H2 — 恢复点餐 / 续结锁定

| 项 | 内容 |
|----|------|
| 目标 | 前端与 `resume_table_session_ordering` 对齐 |
| 允许修改 | `BillPage`、`checkout-split-continuation*` |
| 禁止修改 | 已收台账不可删 |
| 测试 | `checkout-split-continuation.test.ts` 等 |
| 验收 | `checkout-resume-ordering.zh.md` |
| 回滚 | **高** |

### H3 — 关台清理单路径

| 项 | 内容 |
|----|------|
| 目标 | 禁止「只 update session」分支 |
| 允许修改 | `table-session/*`、close API |
| 禁止修改 | RPC 语义（除非 migration） |
| 测试 | `close-table-session.service.test.ts` |
| 验收 | `table-session-close.zh.md` |
| 回滚 | **高** |

### H4 — 转台 / 并台

| 项 | 内容 |
|----|------|
| 目标 | RPC 与看板、`display_name` 快照一致 |
| 允许修改 | waiter action、看板刷新 |
| 禁止修改 | `uniq_active_table_session`；RPC 无 migration 不改 |
| 测试 | 转台/并台手工 |
| 验收 | `table-transfer-merge-plan.zh.md` |
| 回滚 | **高** |

### H5 — 点餐门禁与 append

| 项 | 内容 |
|----|------|
| 目标 | 单管道：`guestOrderingEnabled` + append |
| 允许修改 | `orders/append`、`MenuPage` |
| 禁止修改 | 服务端价格信任；地理围栏 |
| 测试 | `resolve-append-cart-items.test.ts` 等 |
| 验收 | 未开台/`billing` 不可点 |
| 回滚 | **高** |

### H6 — 订单/厨房状态推导

| 项 | 内容 |
|----|------|
| 目标 | 所有 persist 经 `deriveOrderStatusFromItems` |
| 允许修改 | 调用点、void 服务 |
| 禁止修改 | 推导规则（除非产品+文档改） |
| 测试 | order-status 相关；厨房 void |
| 验收 | 看板与 status 一致 |
| 回滚 | **高** |

### H7 — 打印入队与 RLS 吊销（P0 上线门槛）

| 项 | 内容 |
|----|------|
| 目标 | 吊销后 JWT/RLS 端到端；租户隔离审计 |
| 允许修改 | print API、RLS migration、shared JWT |
| 禁止修改 | 出品联触发时机；payload 必需字段 |
| 测试 | `order-receipt-enqueue.test.ts`；Docker go test；吊销后拒绝 |
| 验收 | `print-agent-device-revocation-auth.zh.md` |
| 回滚 | **高** |

### H8 — `bill-split-by-item` 算法（原则上避免）

| 项 | 内容 |
|----|------|
| 目标 | 仅业务改规则时做；先改 `04-business-rules.md` |
| 允许修改 | `bill-split-by-item.ts`、校验、RPC |
| 禁止修改 | 无文档批准的口径 |
| 测试 | `bill-split-by-item.test.ts` 全绿 |
| 验收 | 各人合计 = 消费额 |
| 回滚 | **极高** |

### H9 — 数据模型 migration（单独立项）

| 项 | 内容 |
|----|------|
| 目标 | 新 timestamp migration；不改历史 |
| 允许修改 | `supabase/migrations/`、`docs/ai-schema.md` |
| 测试 | `supabase db push`；RLS 用例 |
| 验收 | `db-migration-runbook.zh.md` |
| 回滚 | **极高** |

---

## 6. 推荐执行顺序

```text
L2 常量类型
  → L3/L4 UI 小组件 → L5 print_locale → L7 i18n
  → M1 MenuManager 拆分 → M2 menu 分层
  → M4 BillPage 减重（不动算法）
  → M3 分析 → M5 筛选 → M6 单 route 薄化
  → H7 打印 RLS（P0）
  → H1 结账竞态 → H2 续结 → H3 关台 → H4 转台
  → H5/H6 仅明确 bug 时
  → H8/H9 单独立项
```

---

## 7. 阶段 7 指令模板

```txt
请执行阶段 7 的一个小步重构任务。

任务名称：【从 L/M/H 编号选取】

任务目标：【】

允许修改：【文件/目录】

禁止修改：【结账/打印/会话/RPC/migration 等】

执行要求：
1. 先读 docs/product、docs/design、docs/technical 相关章节
2. 先输出影响范围和方案
3. 等我确认后再改代码
4. 改完后跑测试并输出摘要

完成后停止，等待我确认。
```

---

## 相关文档

- 指挥文档：[`../optimization.md`](../optimization.md)
- 架构：[`01-architecture.md`](./01-architecture.md)
- 业务规则：[`../product/04-business-rules.md`](../product/04-business-rules.md)
- 待开发 P0/P1：[`../development-backlog.zh.md`](../development-backlog.zh.md)
