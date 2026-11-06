# 客户计划 · 领域模型与库边界（底座）

> **状态：设计底座 · 2026-11-03**  
> **产品权威**：[`../product/customer-registration-coupons.zh.md`](../product/customer-registration-coupons.zh.md)  
> **表字段**：[`./customer-coupons-db-design.zh.md`](./customer-coupons-db-design.zh.md)（须按本文边界落表，禁止跨域堆列）  
> **开发顺序**：[`./customer-program-build-order.zh.md`](./customer-program-build-order.zh.md)  
> **Realtime / 身份**：技术方案 [`./customer-coupons-tech-plan.zh.md`](./customer-coupons-tech-plan.zh.md) §1.1

---

## 0. 目标

保证库表是**分域底座**，不是功能清单堆表：

1. **边界清晰**：每个上下文只拥有自己的概念；跨域只通过明确的关联 id，不互相塞业务列。  
2. **设计合理**：聚合根少而稳；不变量能在库或单一写路径上守住。  
3. **底座扎实**：先身份、再券资产、再挂到现有结账；结账主数据（分单、台账）仍属原结账域，本模块不另起一套结账。

---

## 1. 四个限界上下文（唯一拆法）

```text
┌─────────────────────┐     ┌─────────────────────┐
│ A. 能力开关          │     │ B. 顾客身份           │
│ 本店开不开会员计划    │     │ 谁是会员、怎么登录     │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          │              ┌─────────────▼─────────────┐
          │              │ C. 发券运营                 │
          │              │ 活动规则 → 发出券实例         │
          │              └─────────────┬─────────────┘
          │                            │ 发出
          │              ┌─────────────▼─────────────┐
          │              │ D. 券资产                   │
          │              │ 顾客手里的券（面额快照/状态）   │
          │              └─────────────┬─────────────┘
          │                            │ 选券 / 核销
          │              ┌─────────────▼─────────────┐
          └─────────────►│ E. 结账用券衔接（防腐）       │
                         │ 挂到现有 party_id / 台账      │
                         │ 不拥有分单与收款主流程         │
                         └─────────────────────────────┘

旁路（已有，不属本模块）：游客点餐 / Realtime = guest_client_id + createGuestClient
```

| 上下文 | 一句话 | **拥有** | **禁止** |
|---|---|---|---|
| **A. 能力开关** | 本店开不开 | `customer_program_enabled`；精简 `customer_program_settings` | 塞进 `feature_flags`；在开关表里堆活动细则 |
| **B. 顾客身份** | 本店谁是会员、如何登录 | `customers`、`customer_sessions`、`customer_auth_tokens`、`customer_auth_attempts` | 存券余额、存 `bill_split` / `party_id`、进 Supabase Auth |
| **C. 发券运营** | 按什么规则发 | `coupon_campaign_themes`、`coupon_campaigns`、`customer_referrals` | 改已发出券的面额；直接改台账 |
| **D. 券资产** | 发出后的一张张券 | `coupons`（主人=`customer_id`，面额快照，状态） | 知道「哪一桌」；在券行上堆结账折扣公式 |
| **E. 结账用券衔接** | 哪一笔收款用了哪张券 | `checkout_coupon_selections`；台账上的券列 | 复制一套分单/收款；用 Realtime 在线态认人 |

**已有结账域（本模块外）**：`bill_splits`、`bill_split_ticket_calls`、`session_collected_payments`（金额主语义）、楼面会话等。E 只**引用**其 `party_id` / 台账行，不重新定义「什么叫一笔」。

---

## 2. 聚合与不变量

### B. 顾客身份

| 聚合根 | 附属 | 关键不变量 |
|---|---|---|
| **Customer**（`customers`） | Session、AuthToken；Attempts 按 key 计数（可视为基础设施表） | 作用域=一家店；`(restaurant_id, phone)` 活跃唯一；密码只存哈希；停用/匿名化吊销全部 Session；**不是**员工用户 |

- 判断「已登录」= 有效 Session（cookie → `token_hash`），与 `guest_client_id`、桌台 Realtime **无关**。

### C. 发券运营

| 聚合根 | 附属 | 关键不变量 |
|---|---|---|
| **Campaign**（`coupon_campaigns`） | 可选 Theme 模板；Referral 关系行 | signup/birthday/referral 每店每种至多一条；theme 可多条；改活动配置**不改**已发出的 `coupons.amount` |

### D. 券资产

| 聚合根 | 关键不变量 |
|---|---|
| **Coupon**（`coupons`） | 必属一个 Customer；`issued → redeemed \| voided`；过期由 `valid_until`+Lisbon 今天推导，**不另存 expired 状态**；注册礼/生日/主题发放用唯一索引防重复 |

### E. 结账用券衔接

| 概念 | 关键不变量 |
|---|---|
| **Selection**（`checkout_coupon_selections`） | 一笔=`(bill_split_id, party_id)` 最多一行；一张券同时最多挂一笔；`customer_id` 必须是该券主人 |
| **核销落点**（台账券列） | 收款成功同一事务：台账记下券 + 券改 `redeemed` + 删 Selection；裁判在收款写路径，不在前端 |

券与员工整单折扣：**互斥**（技术方案已定）——有券则该桌 `discount_rate` 视为 0；不在 settings 再留「同用」开关列。

---

## 3. 表 → 上下文映射（禁止跨域堆列）

| 表 / 列 | 上下文 | 说明 |
|---|---|---|
| `restaurants.customer_program_enabled` | A | Ops 总闸 |
| `customer_program_settings` | A | 仅非活动类店内设置；**无** `coupon_discount_mode` |
| `customers` | B | 身份聚合根 |
| `customer_sessions` | B | |
| `customer_auth_tokens` | B | |
| `customer_auth_attempts` | B | 限流，不锁死账号 |
| `coupon_campaign_themes` | C | 平台模板 |
| `coupon_campaigns` | C | |
| `customer_referrals` | C | 邀请关系 + 发券回填指针 |
| `coupons` | D | |
| `checkout_coupon_selections` | E | 衔接结账 |
| `session_collected_payments.gross_amount / coupon_id / coupon_amount` | E 扩展现有台账 | 不新增平行台账表 |

**明确不建的堆叠：**

- 不为「均摊/按菜/整桌」各建一套选券表。  
- 不在 `customers` 上冗余「当前桌 / 当前 party」。  
- 不在 `coupons` 上存 `table_id` / `session_id`（核销关联走台账与 Selection）。  
- 不用 presence / 在线表认会员。

---

## 4. 与开发顺序的关系

| 步 | 主要加固的上下文 |
|---|---|
| 1 迁移 | A+B+C+D 表壳 + E 的空表/可空列（无 RPC） |
| 2 注册登录 | **B**（+ 验 Realtime 仍走游客通道） |
| 3 均摊按份 | **结账域**（为 E 提供稳定 per-seat `party_id`） |
| 4 发券 | **C → D** |
| 5 结账核销 | **E** + 改收款写路径 |
| 6–7 | 发信 / UI |

---

## 5. 评审自检（改表前必过）

1. 新列属于 A–E 哪一个？若答不出 → 不准加。  
2. 是否把结账主数据又抄了一份？→ 禁止。  
3. 是否让 Realtime/游客通道承担会员身份？→ 禁止。  
4. 不变量能否用唯一索引/CHECK 或单一 RPC 守住？→ 必须能指出落点。  
5. 总闸关闭时，是否仍可不读这些表而旧结账不变？→ 必须是。

---

## 6. 决策记录

| 日 | 决策 |
|---|---|
| 2026-11-03 | 客户计划库设计以本文四个业务上下文 + 结账衔接为唯一边界；禁止功能堆表 |
| 2026-11-03 | 券资产与结账用券分开；结账域不另起 |
| 2026-11-03 | 第 1 步迁移按本文落表壳，不提前改收款语义 |
