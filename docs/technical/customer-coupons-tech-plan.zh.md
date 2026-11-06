# 客户注册与优惠券 · 技术方案

> **状态：方案 · 待拍板**（2026-11-03）· 未开工  
> **产品口径（权威）**：[`../product/customer-registration-coupons.zh.md`](../product/customer-registration-coupons.zh.md)  
> **开发顺序（已定）**：[`./customer-program-build-order.zh.md`](./customer-program-build-order.zh.md)  
> **第 1 步迁移（待确认）**：[`./customer-program-phase-1-migration.zh.md`](./customer-program-phase-1-migration.zh.md)  
> **库设计草案**：[`./customer-coupons-db-design.zh.md`](./customer-coupons-db-design.zh.md)（本文 §2 列出对草案的修正）  
> `docs/ai-schema.md` 等迁移落地的同一改动再同步，本方案阶段不改。

---

## 0. 一句话

在现有结账链路上只动 **两个 sole 落点**：收款 RPC `confirm_bill_split_payment`、付清判定 `reconcile_split_result_paid_from_ledger`。**券与员工折扣一律互斥（已定，取消「同用」）**：本桌任一笔有券 → `discount_rate` 必须为 0；`checkout_allocate_discounted_obligations` 本身不改，有券时折扣率传 0。券 = 进分摊前从「这一笔」的折前应付里减掉。其余（顾客认证、活动、邮件、UI）都是新增，不碰现有表面。

---

## 1. 现状核实（已读代码）

| 落点 | 现状 | 结论 |
|---|---|---|
| 收款 RPC | `confirm_bill_split_payment(p_party_id, p_collected_amount, …)` 最新在 `20261010240000_checkout_ledger_party_id.sql`；按 `result[]` 每行 `amount` 组 `pre_amounts` → `checkout_allocate_discounted_obligations(pre, discount_rate, total, …)` 得每行应付 → 插 `session_collected_payments`（含 `party_id`）| **sole 收款入口**，券在这里接 |
| 折扣 | `discount_rate` 是 **整单** 字段（`bill_splits.discount_rate`），按比例分摊到每行（分摊到分）。TS 侧 sole：`allocateDiscountedSplitObligations` / `buildSplitSettlementRows` / `resolveCheckoutDiscountMoneyView`（`lib/checkout-split-math.ts`、`checkout-split-settlement.ts`）| 折扣是整单的，券是单笔的 → **互斥按整桌判**：有券则折扣率 0，有折扣则不能选券。有券时该行 `pre` 换成 `max(0, pre − 券)`，分摊函数不改 |
| 付清判定 | `reconcile_split_result_paid_from_ledger` 同样用 `pre_amounts` 分摊后与 `session_seat_collected` 比 | 草案 §5.1 担心"用券后永远未付"——**只要 reconcile 的 `pre` 也减券就自动正确**，不必改用 `gross_amount` 比较 |
| 台账 `party_id` | 已有列（可空，legacy 行回填过）+ 索引 `(session_id, party_id)`；同一 `party_id` 可有 **多行**（`p_collected_amount` 允许分次收）| 草案"每笔一张券"唯一索引可行；券只记在 **该笔第一行** 收款上 |
| 呼叫结账写入 | 整桌/均摊：`submitCheckoutRequestForTable` → RPC `upsert_bill_split_request`（`lib/checkout-request-server.ts`）；按菜：`submitIndividualCall` → RPC `individual_checkout_apply`（`lib/individual-checkout-server.ts`），呼叫人见 `bill_split_ticket_calls.client_id` | 选券在这两个 **服务端函数** 里写 `checkout_coupon_selections`，不改 RPC 签名（见 §2-3）|
| 均摊认领 | **不存在**：均摊座位 `party_id` 由 `ensureEvenPersonDrafts` 生成，呼叫人与哪一份 **没有绑定** | 已定改为每人认领一份各自呼叫（§2-2）|
| 夜间任务 | `/api/cron/nightly-close-sessions`：清日志 → 过期打印任务 → `executeNightlyAutoClose` | 生日/主题发券作为第 4 步追加，失败不影响前 3 步 |
| Ops 写餐厅 | `apps/ops/.../api/ops/restaurants/[id]/route.ts` 白名单 `updates.*`；店主写在 `apps/web/.../api/restaurant/settings/route.ts` | 总闸只加在 Ops 白名单；店主路由是白名单，天然改不到 |
| middleware | `middleware-session-policy.ts` 已对 `^/api/restaurants/[^/]+/(customer\|staff)` 跳过员工会话 | 顾客 API 放在 `/api/restaurants/[id]/customer/account/*` 下即可，**middleware 不用改** |
| 权限 | `lib/permissions/registry.ts` + `can`/`requirePermission` | 新增 4 个能力键（§5）|
| 限流 | 已有 `in-memory-rate-limit.ts`（单实例内存）| Vercel 多实例下不可靠；登录/找回需 DB 计数（§2-6）|
| bill_sync / 发票 | `bill-sync-build-payload.ts` 的 `lines` / `gross_total` **不含任何折扣字段**（`discount_rate` 只进了 `request-order-receipt-print` 的结账单打印）| **未核实**：现有折扣在 farvoo-fatura 侧如何落税基。券抵扣行要改 Agent 契约，跨仓（§2-5）|
| 顾客端读 | `createGuestClient`（anon）只读公开读模型 | 顾客数据全走服务端 API，**不经** guest client，也不放宽 RLS |

### 1.1 客人两套身份 + Realtime（全局硬约束 · 已定）

扫码点餐这部手机上有两套互不顶替的身份：

| 套 | 认什么 | 用来干什么 |
|---|---|---|
| **手机编号** `guest_client_id` | 本机存的编号 | 点菜拦截、按菜「哪台手机呼叫」、未登录时的一机一票 |
| **会员会话** cookie `mesa_customer_session` → `customer_id` | 本店会员登录 | 「我的优惠券」、呼叫/结账选券、账户资料 |

**Realtime（菜单 / 账单刷新）只走第一套的通道：**

- 唯一客户端：`createGuestClient()` → 永远 **anon**（`persistSession: false`，不读员工 cookie，也**不读**会员 cookie）。
- 客人**登录或登出会员，禁止**改掉、换成、或并行再开一个「已登录的 Supabase Realtime 客户端」去订同一桌。
- 会员相关读写只走 `/api/restaurants/[id]/customer/...`（服务端认会员 cookie）；**不经** guest client，**不放宽**现有 anon RLS 去读顾客表。

这样：登不登录只影响「能不能用会员和券」；桌上开台 / 加菜 / 呼叫 / 分单的实时刷新路径不变，避免登录后频道角色从 anon 变成 authenticated 导致订阅读不到或中断。

前端区分已登录 / 未登录：调顾客 `me`（或等价）有会员 → 已登录；没有 → 未登录。**不要**用 Realtime 在线状态判断是否登录。

---

## 2. 对草案的修正 / 补充

1. **付清判定**：不需要 `gross_amount` 参与判断。改法 = reconcile 与收款 RPC 共用一个新 SQL 小函数 `checkout_party_pre_after_coupon(split, party_id)`（取该笔有效券抵扣额），两处都用它组 `pre_amounts`。一处定义，两处调用。
2. **均摊改为「每人认领一份、各自呼叫」（已定，类似按菜）**：现状均摊只有一个呼叫人、份与人无绑定。改为：客人在均摊里选「我这一份」→ 呼叫结账（可同时选自己的券）；每份的呼叫人 = 该份券主人。落点复用按菜的 sole：`bill_split_ticket_calls`（`ticket_key` = 该份 `party_id`，`client_id` = 呼叫手机）+ `submitIndividualCall` / `individual_checkout_apply`，**不新建认领表**。连带要改：sole 索引「whole_table/even never stamp `bill_split_ticket_calls`」与 `isByItemPerTicketCheckoutPlan` 门（扩到 even）、`docs/guest-individual-checkout.zh.md`、顾客均摊页 `useGuestEvenSplit` 与员工均摊收款进度。这是 **现有均摊流程的行为变更**，不随总闸开关分两套（避免双路径），建议作为阶段 4 之前的独立前置分支先做并单独 UAT。
3. **呼叫写入不改 RPC**：选券写入放在 `submitCheckoutRequestForTable` / `submitIndividualCall` 的 RPC 成功之后，再调一个新 RPC `checkout_coupon_select(...)`（校验券属于该顾客、未用、未过期、总闸开）。失败只影响券，不影响呼叫。理由：收款 RPC 是唯一裁判（草案 §2.7 已定），选券不需要与呼叫同事务。
4. **券抵扣额不是整单折扣的一部分**：`bill_splits.result[].amount` 仍存 **折前**；券额只活在 `checkout_coupon_selections`（未收）和台账券列（已收）。不往 `result[]` 塞券字段，避免第二份真相。
5. **发票（跨仓）**：bill_sync payload 加可选 `discounts: [{kind:'coupon'|'rate', label, amount}]`（按 split），`gross_total` 改为 **折后**；需 farvoo-fatura 同步发版。**已定：用券照常自动开票，靠升级开票程序支持券抵扣行**；Agent 新版本是本模块上线前置条件（总闸只在已升级的店打开）。
6. **取消「同用」**：`customer_program_settings.coupon_discount_mode` 删掉（该表 v1 可只留 `updated_*` 或整表不建，活动配置都在 `coupon_campaigns`）；台账 `discount_amount` 列也不需要（有券时必为 0），等式简化为 `gross_amount - coupon_amount = amount`。
7. **限流**：登录/找回/注册不用内存限流，新表 `customer_auth_attempts(restaurant_id, key, created_at)` 计数逐级延迟（`key` = ip 或 phone）；或直接用 `customer_auth_tokens` 计数（找回）。
8. **台账等式 CHECK**：分次收时只有第一行带券列——CHECK 写成 `coupon_id is null or gross_amount - coupon_amount = amount`。
9. **撤销收款（已定：券恢复可用）**：撤销/冲销收款的写路径里同一事务把券改回 `issued`、清 `redeemed_*`（过期由日期推导，不另判）。**未核实** 现有撤销入口在哪，实现阶段先找到 sole 写路径再挂。

---

## 3. 分阶段

### 阶段 1 · 迁移（1 个迁移文件）

> **收窄（2026-11-03）**：权威范围见 [`./customer-program-phase-1-migration.zh.md`](./customer-program-phase-1-migration.zh.md)。  
> 本阶段 = **纯 DDL + 主题种子**；**不改** `confirm_bill_split_payment` / `reconcile_*`（改写归开发顺序第 5 步）。

- 表：`customer_program_settings`（无同用列）、`coupon_campaign_themes`(+种子)、`coupon_campaigns`、`customers`、`customer_sessions`、`customer_auth_tokens`、`customer_auth_attempts`、`customer_referrals`、`coupons`、`checkout_coupon_selections`。全部 `RLS on 无 policy`。
- 列：`restaurants.customer_program_enabled`；`session_collected_payments` 加可空 `gross_amount/coupon_id` + `coupon_amount default 0`（破坏性 CHECK 留第 5 步）。
- UAT：本地 `db push --local --include-all` 后，总闸关时旧收款结果不变。

### 阶段 2 · 顾客认证

- 新库：`lib/customer-auth/`（`hashPassword` 用 **`bcryptjs`**（已批，纯 JS，on-prem 无需编译）；`createCustomerSession`；`readCustomerSession(req)` 只认 cookie `mesa_customer_session`，按 `restaurant_id` 校验）。
- API（`/api/restaurants/[id]/customer/account/`）：`register`、`login`、`logout`、`me`、`forgot`、`reset`、`verify-email`、`unsubscribe`。全部先查总闸 → `customer_coupons_disabled`。
- 手机号统一 E.164 sole `normalizeCustomerPhone`（默认 +351）。
- 风险：cookie 名/路径与 Supabase 员工 cookie 不冲突；员工 API 永不读顾客 cookie；**登录不得替换 `createGuestClient`（§1.1）**。
- UAT：注册→登录→登出；错号/错密同一提示；员工 cookie 访问顾客 `me` 返回 401，反之亦然；**登录前/后/登出后**同桌 Realtime 仍能刷新（开台或加菜触发）。

### 阶段 3 · 券与活动

- `lib/customer-coupons/`：sole `isCouponUsable(coupon, lisbonToday)`（过期=推导）；sole `issueCampaignCoupons(campaign, customerIds)`（唯一索引冲突跳过）。
- 注册礼/邀请礼在 `register` 同请求发；邀请人券在收款 RPC 内发（阶段 4）。
- nightly 第 4 步 `runNightlyCustomerCoupons(admin)`：生日（回看 3 天补漏，2/29 → 非闰年 2/28）+ 主题 `auto_issue_on_start`。只处理总闸开的店。
- 员工 API（`/api/restaurant/customers/*`、`/api/restaurant/coupons/*`、`/api/restaurant/coupon-campaigns/*`）：`requirePermission` 新能力；写 `operation_logs`。
- Ops：`[id]/route.ts` 白名单加 `customer_program_enabled`；主题模板 CRUD 放 Ops。
- UAT：nightly 跑两次生日券不重复；主题活动重复发放不重复；总闸关时所有员工/顾客 API 拒绝。

### 阶段 4 · 结账核销（最高风险）

- 选券：`checkout_coupon_select` 在呼叫后写；员工结账页调整走 `PATCH /api/restaurant/checkout/coupon`（`checkout.confirm_payment`）。
- `confirm_bill_split_payment` 内同一事务：重新校验选券 → 用 `checkout_party_pre_after_coupon` 组 `pre_amounts` → 分摊 → 插台账（首行带券列）→ 券 `redeemed` → 删选券行 → 邀请人奖励（被邀请人首次带券或登录收款）。有券且 `discount_rate > 0` → RPC **拒绝** `coupon_discount_exclusive`（已定）；`checkout_coupon_select` 与员工改折扣的写路径同样互相拒绝，UI 切换前先提示。
- TS 侧 sole：`allocateDiscountedSplitObligations` 入参加 `couponByParty`，`buildSplitSettlementRows` / `resolveCheckoutDiscountMoneyView` / `resolveByItemCollectTarget` 全部经它——**不在组件里另算券后金额**。
- 顾客侧 `buildCustomerTableSettlementSummary` / `guestClaimLineAmounts` 同样经该 sole。
- 风险：分次收、按菜 unlock 删票（选券行孤儿→收款时视为无券）、换桌/并台、`client_request_id` 幂等重放不能二次核销（唯一索引兜底）。
- UAT：三模式 × {无券, 券<应付, 券>应付, 有券再加折扣被拒, 有折扣再选券被拒} 金额对表；撤销收款后券回到可用；两手机同券并发收款仅一张核销；收款失败券仍可用；总闸关后已选券不核销。

### 阶段 5 · 邮件

- `lib/email/resend.ts` sole `sendTransactionalEmail`（fetch Resend REST，无需新依赖）；`RESEND_API_KEY` 仅服务端。
- 发券通知：发券后批量发（分批 ≤ 100/次），成功写 `coupons.notified_at`；失败不回滚券。nightly 里发信放 `waitUntil` 或同步分批，注意 Vercel 响应后冻结。
- 退订：签名链接 → 清 `coupon_email_opt_in_at`。
- UAT：本地用 Resend 测试密钥或 mock 开关；无邮箱/未同意不发；退订后不再发。

### 阶段 6 · UI

- 顾客：点餐页注册/登录入口（`AppearanceChromeGroup` 旁，不另起一套 chrome）、我的优惠券、邀请页、呼叫结账选券（整桌/按菜/均摊各自呼叫面板内一个选择器组件，三处共用）。
- 员工：客户管理、券管理、活动页；结账页分单行「优惠券 −€X」+ 券主人名，调整弹窗只列该笔呼叫人的券；互斥模式下切换先确认。
- 设置：`customer_program_settings` 在 `SettingsForm` 内一个 section。
- UAT：zh/en/pt；手机宽度；总闸关时入口全部消失。

---

## 4. 改动清单（sole 落点）

| 类型 | 落点 |
|---|---|
| RPC 改 | `confirm_bill_split_payment`、`reconcile_split_result_paid_from_ledger` |
| RPC 新 | `checkout_party_pre_after_coupon`、`checkout_coupon_select`、`customer_issue_coupons_bulk` |
| TS sole 改 | `lib/checkout-split-math.ts`（分摊入参加券）、`checkout-split-settlement.ts`、`checkout-by-item-collect.ts`、`checkout-session-payments.ts`、`checkout-confirm-payment.ts` |
| 服务端改 | `checkout-request-server.ts`、`individual-checkout-server.ts`（呼叫后选券）、`app/api/cron/nightly-close-sessions/route.ts`（第 4 步）、Ops `restaurants/[id]/route.ts` |
| 新增 | `lib/customer-auth/*`、`lib/customer-coupons/*`、`lib/email/resend.ts`、顾客/员工 API、UI |
| 跨仓 | farvoo-fatura bill_sync 折扣/券行契约 |
| 不改 | `middleware-session-policy.ts`、`createGuestClient`、现有 RLS（见 §1.1：登录不得替换 guest Realtime 客户端） |

## 5. 新能力键

`dashboard.customers.view`（导航）· `customers.manage`（改资料/代重置/停用/匿名化）· `coupons.issue`（手动发、活动发放）· `coupons.void` · `coupon_campaigns.manage`。结账页调整券沿用 `checkout.confirm_payment`。

## 6. 安全要点

- 顾客数据只走 service_role API，每条查询带 `restaurant_id`；令牌/密码只存哈希。
- 每个 API 首行查总闸；收款 RPC 内也查（关闸时按无券）。
- 返回邮箱打码；找回文案不暴露手机号是否存在。
- **身份隔离（§1.1）**：会员 cookie ≠ Supabase Auth；客人 Realtime 保持 anon；禁止登录后用会员会话去订桌台 Realtime。

## 7. 工作量粗估

迁移 + 收款改造最重（阶段 1+4 约占 45%），认证 15%，券活动 15%，邮件 5%，UI 20%。阶段 4 必须在阶段 1–2 完成后单独一个分支做。

## 8. 决策记录

| # | 决策 |
|---|---|
| 1 | 密码哈希 `bcryptjs` |
| 2 | 撤销收款 → 券恢复可用 |
| 3 | 券与员工折扣 **一律互斥**（取消产品 §7.5「同用」开关）；整桌任一笔有券则不能打折 |
| 4 | 有券又有折扣 → 收款 RPC 拒绝 |
| 6 | 用券照常自动开票；升级 farvoo-fatura 开票程序支持券抵扣行（上线前置）|
| 7 | 均摊改为客人认领一份各自呼叫（同按菜），每份呼叫人可用自己的券 |
| 5 | 日统计单列「券抵扣总额」（改 analytics 日聚合，营业额仍用实收） |
| 8 | 客人两套身份：手机编号管点菜/Realtime，会员 cookie 管用券；登录不换 `createGuestClient`（§1.1） |

## 9. 仍待拍板

1. 均摊「每份各自呼叫」是否对 **所有店** 生效（推荐，一套流程），还是仅开了优惠券总闸的店？
