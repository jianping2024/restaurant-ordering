# Mesa 待开发工作总览

> **状态**：整合稿（2026-06-24）  
> **用途**：汇总各专项计划文档中**尚未完成**或**仅差验收/上线**的工作，便于排期。  
> **说明**：部分源文档 checklist 未同步更新；本文在整合时对照了代码现状，并在各节标注「实现状态」。

## 源文档索引

| 领域 | 原文档 |
|------|--------|
| 打印代理（协议 / API / 上线门槛） | [`print-agent-plan.md`](./print-agent-plan.md) |
| 打印代理（客户体验 / 托盘 / 向导） | [`print-agent-ux-packaging.zh.md`](./print-agent-ux-packaging.zh.md) |
| 打印代理 USB | [`print-agent-usb-plan.md`](./print-agent-usb-plan.md) |
| 设备吊销鉴权 | [`print-agent-device-revocation-auth.zh.md`](./print-agent-device-revocation-auth.zh.md) |
| 平台运营后台 | [`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md) |
| 员工账号 | [`staff-accounts-plan.md`](./staff-accounts-plan.md) |
| 关台守卫 | [`table-session-close-guards-plan.md`](./table-session-close-guards-plan.md) |
| 关台语义 | [`table-session-close.zh.md`](./table-session-close.zh.md) |
| 结账并发确认 | [`checkout-confirm-payment-race.zh.md`](./checkout-confirm-payment-race.zh.md) |
| 本地私有化部署 | [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) |
| 转台 / 并台 | [`table-transfer-merge-plan.zh.md`](./table-transfer-merge-plan.zh.md) |
| 自助餐周五晚周末价 | [`friday-evening-weekend-plan.md`](./friday-evening-weekend-plan.md) |

---

## 优先级总览

| 优先级 | 含义 | 代表项 |
|--------|------|--------|
| **P0** | 对外上线硬门槛 / 安全 | 打印代理吊销 RLS 验收、实机 ESC/POS 定稿 |
| **P1** | 核心产品闭环收尾 | 结账 RPC 生产验收、关台 Phase 5 回归上线 |
| **P2** | 扩展与运营增强 | 运营后台商业化、单档重打、USB 实机验收 |
| **P3** | 中长期 / 单独立项 | 本地私有化、Stripe 计费、GDPR |

```mermaid
flowchart LR
  P0[打印代理上线闭环] --> P1[结账验收 + 关台 Phase5]
  P1 --> P2[运营 P2 + 打印 P2]
  P2 --> P3[私有化 / 计费 / 合规]
```

---

## 1. 打印代理（`apps/print-agent` + Web API）

**已落地（摘要）**：`print_stations`、出品联自动入队、`print_jobs`、配对/claim、Go 代理轮询 + TCP/WinSpool、Inno 安装包、Dashboard 打印助手、设备心跳、到期提醒（30 天）、配对码作废、20 分钟任务过期、托盘/向导/S0 configure 等（见 [`print-agent-ux-packaging.zh.md`](./print-agent-ux-packaging.zh.md) 进度表）。

### 1.1 P0 — 上线硬门槛

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 1 | **吊销后 JWT 立即失效（RLS 全路径验收）** | 代理经 `agentjwt` 访问 `print_jobs`（含 Realtime）时，须校验 `print_agent_devices.revoked_at IS NULL` 且 `valid_until > now()`；写 `revoked_at` 后 REST + Realtime 均拒绝。**对外上线前必须完成。** | `print-agent-plan.md`、`print-agent-device-revocation-auth.zh.md` |
| 2 | **实机 ESC/POS 打样与编码定稿** | 参考样机 UNYKA UK56009；zh / pt / en 字符集（UTF-8 vs Code Page）以实机为准；含 DHCP 保留与私网 IP 运维说明 | `print-agent-plan.md` §七 checklist |
| 3 | **§五 安全加固（应用端）** | 配对限流、HTTPS、claim 只信服务端 `restaurant_id`、scoped JWT、payload 大小限制、创建任务限流 | `print-agent-plan.md` §七 |
| 4 | **§五 安全加固（代理端）** | 本地 token 加密存储、日志脱敏、设备/版本回写 | `print-agent-plan.md` §七 |

**实现状态备注**：`print_agent_devices` 表、Dashboard 设备列表与吊销 UI、运营代客吊销（`apps/ops`）**已有代码**；**RLS 即时失效的端到端验收**仍为文档硬底线。

### 1.2 P1 — 产品闭环

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 5 | **订单小票 + 预结单完整链路** | Web 侧已有 `order-receipt-enqueue.ts` 与 `bill_receipt_print` 功能开关；需对齐代理端 `order_receipt` / `pre_bill` 模板与生产拉取/确认路径 | `print-agent-plan.md` §七 |
| 6 | **试打链路（服务端 P0-3）** | `claim` 成功后插入 `type=order_receipt` + `payload.connection_test: true` 的 `print_jobs`，代理走与生产相同路径（与向导本地试打互补） | `print-agent-plan.md`、`print-agent-ux-packaging.zh.md` |
| 7 | **无代理兜底策略验收** | 未配对/无代理时 Mesa 保留 `window.print()` HTML；有代理时以 `print_jobs` 为主路径 | `print-agent-plan.md` |
| 8 | **`restaurants.print_locale` Dashboard UI** | DB 与入队已读库；餐厅设置页三选一 UI 待接（若尚未完成） | `print-agent-plan.md` §七 |
| 9 | **`restaurants.country_code` 全链路** | 代建/注册必填 + Dashboard 可编辑（与票面语言解耦）；schema 部分已有 | `print-agent-plan.md`、`platform-admin-plan.zh.md` |

### 1.3 P2 — 扩展

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 10 | **仅重打单一 `print_station`（UI + 入队）** | 全单重打、`reprint_scope` 等 | `print-agent-plan.md` P2 |
| 11 | **多打印机 / 档口订阅** | `print_agent_devices.subscribed_station_ids`、类目多对多、沿 `parent_id` 继承 | `print-agent-plan.md` |
| 12 | **58mm 纸宽第二套模板** | 首期锁定 80mm | `print-agent-plan.md` |
| 13 | **Authenticode 代码签名** | 第一期不签；后续评估 OV 证书接入 CI | `print-agent-plan.md` |
| 14 | **自有 OSS/CDN 镜像** | GitHub 访问或合规问题时 | `print-agent-plan.md` P2 |
| 15 | **Mac 安装包** | 可选 | `print-agent-plan.md` P2 |
| 16 | **短 access + refresh JWT** | 替代单条 180d JWT；签名密钥轮换 | `print-agent-plan.md` |
| 17 | **企业代理 / `HTTPS_PROXY`** | 封闭网络例外支持 | `print-agent-plan.md` |
| 18 | **票面多语言并列** | 第一期整张票单一 `locale`；双语对照列 P2 | `print-agent-plan.md` |
| 19 | **`client_request_id` / Idempotency-Key** | 更强入队去重 | `print-agent-plan.md` |
| 20 | **独立「店长」角色** | `restaurant_staff` + role，RLS 从仅 owner 扩展 | `print-agent-plan.md` |

### 1.4 体验 backlog（[`print-agent-ux-packaging.zh.md`](./print-agent-ux-packaging.zh.md) §10）

| # | 工作项 | 说明 |
|---|--------|------|
| 21 | **Realtime 推任务** | 降低延迟；代理端当前无 Realtime 实现，仍以轮询为主 |
| 22 | **日志按大小轮转** | 现有固定 `agent.log` + 托盘「打开日志」 |
| 23 | **Windows 服务模式** | 多用户 / 无登录自启；优先级低于托盘 |
| 24 | **configure 页 QR** | 将 `configure?api=&code=` 发给另一台设备 |
| 25 | **每档口各打一条试打** | 当前为单档口试打 |
| 26 | **托盘打印机硬件离线态** | 仅 Mesa 连接态绿/黄/红；未区分 Spooler 脱机 |
| 27 | **版本提示增强** | 代理直连 GitHub 查 tag；heartbeat 带回推荐版 |

### 1.5 USB（[`print-agent-usb-plan.md`](./print-agent-usb-plan.md)）

| # | 工作项 | 说明 |
|---|--------|------|
| 28 | **WinSpool RAW 实机验收** | 代码已有 `winspool:` 前缀与 `sink.go`；须在 UK56009 等机型上验收 |
| 29 | **文档与 checklist 同步** | 主计划 P2-6 §4 与 USB 专文档对齐 |

---

## 2. 结账与关台（租户业务）

### 2.1 结账并发确认 — 阶段 6（发布验收）

**背景**：`confirm_bill_split_payment` RPC + 行锁已实现（阶段 0–5，2026-05-29）。

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 30 | **预发/生产并发验证** | 同一 `bill_split_id` 上不同 `person_index` 并发确认不丢 `paid` | `checkout-confirm-payment-race.zh.md` |
| 31 | **观察 print_jobs 与 UI 一致** | 付清后 session 关闭、小票不重复/遗漏 | 同上 |
| 32 | **回归转台/并台后结账** | 与桌位 RPC 无冲突 | 同上 |
| 33 | **验收 checklist 勾选** | 租户隔离、重复确认 409、lint/build | 同上 §验收标准 |

**性质**：无新功能代码；**运维 / QA 发布门禁**。

### 2.2 关台守卫 — Phase 5（回归与上线）

**背景**：Phase 1–4 已完成（2026-05-29）— 已呼叫结账（`requested` split）关台须 `confirm_checkout_close: true`，否则 409；UI ConfirmModal 已接。

**产品语义**：见 [`table-session-close.zh.md`](./table-session-close.zh.md)（强制关台 = 取消未付分账 + 作废订单行 + 关闭 session）。

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 34 | **回归矩阵 — 空桌关台** | 无分账 → 200 | `table-session-close-guards-plan.md` Phase 5 |
| 35 | **回归矩阵 — 已付清** | session 已关 → close API 404 `no_session` | 同上 |
| 36 | **回归矩阵 — 转台/并台** | 来源空桌关台不影响目标桌活跃 session | 同上 |
| 37 | **回归矩阵 — 订单历史** | 关台后 void 订单仍可在历史审计 | 同上 |
| 38 | **回归矩阵 — 鉴权** | 未登录 / 错 slug → 401 | 同上 |
| 39 | **文档标记 Phase 5 完成** | 更新 guards 计划与关台语义文档 | 同上 |
| 40 | **按需上线** | lint → build → `pnpm push` → 确认 Vercel Production Ready | 同上、AGENTS.md |

**性质**：**不是新功能**；发布前 QA + 文档收尾。

---

## 3. 平台运营后台（`apps/ops`）

**已落地（摘要）**：`platform_admin_accounts` / audit migration、登录 bootstrap、餐厅 CRUD、重置店主密码、跨店打印 devices/jobs/吊销、暂停恢复、员工只读与停用、运营账号 CRUD、审计导出；`/auth/admin/register` 已 deprecated 并重定向 ops。

源文档 [`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md) §12 验收 checklist 仍为 `[ ]`，需 **端到端 QA 后勾选**。

### 3.1 待验收（P0 + P1 文档清单）

| # | 工作项 |
|---|--------|
| 41 | 非运营账号访问 `/ops/*` → 403 或跳转登录 |
| 42 | 创建餐厅 + 店主与旧 register 行为等价 |
| 43 | 餐厅列表搜索；详情含菜单链接 |
| 44 | 重置店主密码 + 审计记录 |
| 45 | 跨店 `print_agent_devices` 代客吊销 + Agent API 拒绝（依赖 §1.1 吊销 RLS） |
| 46 | 跨店只读 `print_jobs`，页面不展示 `agentjwt` |

### 3.2 P2 — 租户治理（部分可能已实现，需产品验收）

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 47 | **Plan 与功能开关运营覆盖** | 写 `plan`；`feature_flags` 平台强制项；UI 标明合并策略 | §4.3 |
| 48 | **编辑餐厅元数据** | slug 变更二次确认（QR 失效风险） | §4.3 |
| 49 | **审计日志完整化 + 导出** | 吊销、暂停、改 plan、停用员工等全覆盖 | §4.3 |
| 50 | **一次性 support token** | 极端排障；短效只读；不可替代长期 `agentjwt` 展示 | §4.3 |
| 51 | **运营侧 i18n** | 默认中文；P2 可选 | §6 |

### 3.3 P3 — 后续可选

| # | 工作项 | 说明 | 源文档 |
|---|--------|------|--------|
| 52 | **Stripe 计费 / 订阅** | `plan` 与 entitlements 联动 | §4.4 |
| 53 | **只读「进店」** | 以店主身份只读 dashboard；高风险 | §4.4 |
| 54 | **GDPR 数据导出 / 注销** | 按餐厅合规流程 | §4.4 |
| 55 | **运营看板** | 全平台订单量、活跃门店、代理版本分布 | §4.4 |

---

## 4. 租户侧收尾与可选

### 4.1 员工账号（[`staff-accounts-plan.md`](./staff-accounts-plan.md)）

**主流程已完成**（PIN 下线、双入口登录、CRUD、RLS）。

| # | 工作项 | 优先级 |
|---|--------|--------|
| 56 | DB 废弃 `kitchen_password` / `waiter_password` 列 | 可选 |
| 57 | 进一步收紧 anon RLS（顾客下单仍走服务端 API） | 可选 |
| 58 | 修改 `login_name`（首期不可改，删账号重建） | 未来单独立项 |

### 4.2 转台 / 并台（[`table-transfer-merge-plan.zh.md`](./table-transfer-merge-plan.zh.md)）

| # | 工作项 | 说明 |
|---|--------|------|
| 59 | **文档验证清单执行** | RPC 与前后端已接入；按文档 §验证清单做 QA |
| 60 | **与并台产品规则对齐** | 以 [`table-merge-product.zh.md`](./table-merge-product.zh.md) 为准 |

### 4.3 自助餐周五晚周末价（[`friday-evening-weekend-plan.md`](./friday-evening-weekend-plan.md)）

**实现状态**：`buffet_friday_weekend_from`、SQL、`getDayKindForDateTime`、Dashboard UI **已有**。

| # | 工作项 | 说明 |
|---|--------|------|
| 61 | **归档计划文档** | §9 实施步骤、§10 Open questions 标记完成或关闭 |
| 62 | **方案 B（时段级 `friday_uses_weekend_pricing`）** | 仅当运营需要更细粒度时再开 |

### 4.4 餐厅功能开关（[`restaurant-features.zh.md`](./restaurant-features.zh.md)）

无固定 backlog；新增功能按注册表扩展（`RESTAURANT_FEATURE_DEFINITIONS`）。

---

## 5. 本地私有化部署（[`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md)）

**独立大项**；与当前 Vercel + Supabase Cloud 主线并行，**不建议与首期打印代理上线混排**。

| 阶段 | 内容 | 预估 |
|------|------|------|
| **0** | 产品决策、支持矩阵、验收清单定稿 | ~1 周 |
| **1** | 单机生产栈（Windows 客户侧 Docker/WSL2 + Supabase 栈产品化） | ~2–3 周 |
| **2** | 备份与可观测性 | ~2 周 |
| **3** | 签名升级系统 | ~2–3 周 |
| **4** | 试点与运营 | ~4 周 |

§13 上线验收清单（断网营业、重启恢复、TCP 9100、备份恢复、升级回滚等）**全部待勾**。

---

## 6. 建议排期（维护者参考）

| 顺序 | 工作包 | 包含条目（#） |
|------|--------|----------------|
| **1** | 打印代理上线闭环 | 1–4，45（与 ops 吊销联调），5–7 |
| **2** | 业务发布门禁 | 30–40（结账验收 + 关台 Phase 5） |
| **3** | 运营后台 QA + P2 | 41–51 |
| **4** | 打印 P2 + 体验 | 10–29 |
| **5** | 私有化 / 商业化 | 52–55，§5 全阶段 |

---

## 7. 已从 backlog 排除（勿重复排期）

以下在源文档中曾列为待办，**对照代码视为已落地**（细节见各专文档「已落地」节）：

- `print_stations`、出品联自动入队、配对码 API
- 员工账号替换 PIN（主路径）
- 转台/并台 RPC 与服务员/后台调用
- 自助餐 `buffet_friday_weekend_from`
- 打印代理托盘、心跳、Inno 安装包、20 分钟任务过期、版本升级提示
- 运营后台主体页面与 API（`apps/ops`）
- 结账 RPC `confirm_bill_split_payment`（待阶段 6 验收）
- 关台守卫 Phase 1–4 代码与 UI（待 Phase 5 回归）

---

*维护：完成某项工作后，请同步更新对应专文档 checklist，并修订本节与 §6 排期表。*
