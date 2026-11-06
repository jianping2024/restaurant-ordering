# 第 1 步：客户计划 · 库表迁移（待确认）

> **状态：方案 · 待确认**（2026-11-03）  
> **在总顺序中的位置**：[`./customer-program-build-order.zh.md`](./customer-program-build-order.zh.md) 第 1 步  
> **表字段细节**：以 [`./customer-coupons-db-design.zh.md`](./customer-coupons-db-design.zh.md) 为准；本文定**本步做哪些 / 不做哪些**  
> **产品**：[`../product/customer-registration-coupons.zh.md`](../product/customer-registration-coupons.zh.md)

---

## 0. 一句话

只落库：Ops 总闸列 + 顾客/会话/限流/券/活动/选券等表（及台账上可空的券列）。  
**不上注册 API、不改收款 RPC、不改 UI、不动 `createGuestClient`。**  
总闸默认关 → 现有点餐结账行为与现在完全一致。

---

## 1. 本步要交付的

### 1.1 一个新迁移文件（只新增，不改历史迁移）

**餐厅**

| 变更 | 说明 |
|---|---|
| `restaurants.customer_program_enabled` | `boolean not null default false`；仅 Ops 可写（实现在第 2 步以后的 Ops 白名单；本步只加列） |

**新表（全部 `RLS on` + **无** policy；仅 service_role）**

| 表 | 本步用途 |
|---|---|
| `customers` | 第 2 步注册登录 |
| `customer_sessions` | 会员 cookie 对应会话 |
| `customer_auth_tokens` | 找回密码 / 邮箱验证（第 2 / 6 步） |
| `customer_auth_attempts` | 登录/注册限流计数（第 2 步用；技术方案已定不用内存限流） |
| `customer_program_settings` | 店内子配置占位（1 店 1 行）；**不建** `coupon_discount_mode`（技术方案已定券与员工折扣一律互斥，无需该列） |
| `coupon_campaign_themes` | 平台主题模板 + 种子数据 |
| `coupon_campaigns` | 店内活动（注册/生日/邀请/主题） |
| `customer_referrals` | 邀请关系 |
| `coupons` | 券实例（本步空表，第 4 步才发） |
| `checkout_coupon_selections` | 结账选券（本步空表，第 5 步才写） |

**现有表加列（可空 / 默认不改变旧行语义）**

| 表.列 | 说明 |
|---|---|
| `session_collected_payments.gross_amount` | numeric null |
| `session_collected_payments.coupon_id` | uuid null FK → coupons |
| `session_collected_payments.coupon_amount` | numeric not null default 0 |

本步**不**加/不启用会改变旧收款结果的 CHECK（若草案有「有券时等式」类约束，放到第 5 步与 RPC 同批，避免未接券逻辑时误伤）。  
本步**可**加：`(session_id, party_id) where coupon_id is not null` 的唯一索引（旧行 `coupon_id` 全 null，不受影响）。

### 1.2 本步明确不做

| 不做 | 放到哪一步 |
|---|---|
| 改写 `confirm_bill_split_payment` / `reconcile_split_result_paid_from_ledger` | 第 5 步 |
| 新增 `checkout_party_pre_after_coupon` / `checkout_coupon_select` / 批量发券 RPC | 第 4–5 步 |
| 任何顾客/员工/Ops HTTP API | 第 2 步起 |
| 注册登录 UI、选券 UI | 第 2 / 5 / 7 步 |
| 改 `createGuestClient`、middleware、现有 anon RLS | **永不**（身份 §1.1） |
| 均摊按份呼叫行为 | 第 3 步 |
| `supabase db reset` | 禁止除非你在本线程明确批准 |

### 1.3 与总技术方案「阶段 1」的差异（已收窄）

旧技术方案阶段 1 曾把收款 RPC 改写写在「迁移」里。  
**现定：第 1 步 = 纯 schema**；RPC 改写挪到第 5 步方案文档。避免「表还没人用就改结账金额语义」。

---

## 2. 字段与约束从哪里抄

实现迁移时按 [`customer-coupons-db-design.zh.md`](./customer-coupons-db-design.zh.md) 抄列类型、唯一索引、CHECK，并套用本文 §1 的收窄：

- 去掉 `customer_program_settings.coupon_discount_mode`（若草案仍有，以本文为准）。  
- `customer_auth_attempts`：若草案正文未单列成节，按技术方案限流需要建表：`(restaurant_id, key, created_at)` 一类，供第 2 步按 IP/手机号计数。  
- 密码哈希算法实现属第 2 步；表上只留 `password_hash` 列（`text not null` 对未完成注册的行不适用——仅插入完整顾客行时写入）。

草稿里仍写「v1 员工不按手机号代查 / 均摊只有一个呼叫人」的句子：**产品与均摊定稿已更新的，以产品文档为准**；本步只建表，不实现这些业务句。

---

## 3. 验收（本步做完算过）

1. 本机 Docker：`npx supabase db push --local --include-all --yes`（或 `migration up --local --include-all`）成功。  
2. `schema_migrations` tip 含本迁移。  
3. 新表存在且 `relrowsecurity = true`；对 anon/authenticated **无** 直接 policy 可读顾客表（抽查一条）。  
4. **总闸默认 false**；用现有三模式各收一笔小款（或既有 UAT 收款路径）：金额与改迁移前一致（台账新列为 null / `coupon_amount=0`）。  
5. 同步更新 [`../ai-schema.md`](../ai-schema.md) 中对应表摘要。  
6. 不提交任何顾客 API / 前端入口。

---

## 4. 风险

| 风险 | 对策 |
|---|---|
| 一台账加列或唯一索引影响旧收款 | 只加可空列 + 部分唯一索引；本步不改 RPC、不加破坏性 CHECK |
| 迁移过大难审 | 仍保持**一个**时间戳迁移文件（与技术方案一致），但内容仅 DDL + 主题种子，无 RPC 替换 |
| 工作树/主仓文档两套库设计不一致 | 实现前以**主仓** `customer-coupons-db-design.zh.md` + **本文收窄**为准；冲突先改文档再写 SQL |

---

## 5. 确认后开工方式

1. 你回复确认本步方案（例如「第 1 步按这个做」）。  
2. 从 `main` 开专用分支（如 `feat/customer-program-phase-1-migration`）；若主仓有旁路脏文件 → worktree，禁止 stash 旁路 WIP。  
3. 只交迁移 + `ai-schema.md`（及必要的文档回写）；本地 push 迁移；再出**第 2 步：注册登录**方案文档。

---

## 6. 决策记录

| 日 | 决策 |
|---|---|
| 2026-11-03 | 开发顺序：迁移 → 注册登录 → 均摊 → 发券 → 结账核销 → 发信 → UI |
| 2026-11-03 | 第 1 步 = 纯 schema；收款 RPC 不进本步 |
| 2026-11-03 | settings 不建券/折扣同用列（互斥已定） |
