# 客户注册与优惠券 · 数据库设计（草案）

> **状态：草案 · 待确认**（2026-10-24）  
> **产品口径**：[`../product/customer-registration-coupons.zh.md`](../product/customer-registration-coupons.zh.md)（冲突以产品文档为准）  
> **落库后**：同步 [`../ai-schema.md`](../ai-schema.md)；迁移只新增，不改历史。

---

## 0. 一句话

**顾客不进 Supabase Auth**，用本模块自己的 `customers` 表 + 会话表登录；券是 `coupons` 表里的一行；**呼叫结账时**把选的券记在「这一笔收款」上（`checkout_coupon_selections`）；收款成功时在台账那一行记下用了哪张券、抵了多少，同时把券标成已用。

为什么不用 Supabase Auth：

1. 产品要求顾客与员工 **彻底隔离**——不同表、不同 cookie，员工会话天然拿不到顾客身份，反之亦然。
2. 顾客 **按店** 注册（同一手机号在 A、B 店是两个账号），Supabase Auth 的用户是全局唯一的，套不上。
3. on-prem 同一套逻辑，不依赖 Auth 配置差异。

---

## 1. 总览

```text
restaurants ──(新列) customer_program_enabled  ← Ops 总闸
     │
     ├── customer_program_settings   店内子配置（1 店 1 行）
     ├── coupon_campaigns            店内活动（注册/生日/邀请/主题）← coupon_campaign_themes 平台模板
     ├── customers                   顾客档案（含密码哈希）
     │      ├── customer_sessions    登录态
     │      ├── customer_auth_tokens 找回密码 / 邮箱验证令牌
     │      ├── customer_referrals   邀请关系
     │      └── coupons              券实例
     ├── checkout_coupon_selections  呼叫结账时每一笔选的券（未核销）
     └── session_collected_payments  (新列) 记录券抵扣 → 核销
```

所有新表：`RLS on，无 policy`——只走服务端 API（service_role），与 `bill_split_ticket_calls` 同一做法。浏览器端（anon / staff cookie）**直接查不到**任何顾客数据。

---

## 2. 表设计

### 2.1 `restaurants` 加一列（Ops 总闸）

| 列 | 类型 | 说明 |
|---|---|---|
| `customer_program_enabled` | boolean not null default false | 只有 Ops 能改；**不**放 `feature_flags` |

需要确认：Ops 写餐厅的现有路径，保证店主 PATCH 改不到这一列。

### 2.2 `customer_program_settings`（店内子配置）

1 店 1 行。活动不再平铺在这里（见 §2.2b），这里只放与活动无关的设置。

| 列 | 类型 | 说明 |
|---|---|---|
| `restaurant_id` | uuid PK FK → restaurants | |
| `coupon_discount_mode` | text default `exclusive` | `exclusive` 互斥 / `stack` 同用（先券后折扣） |
| `updated_at` / `updated_by_user_id` | | |

### 2.2a `coupon_campaign_themes`（平台主题模板 · Ops 维护）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `key` | text unique | 如 `christmas`、`valentines`、`easter` |
| `name` | jsonb | `{pt,en,zh}` |
| `default_start_md` / `default_end_md` | text `MM-DD` null | 固定日期节日；复活节、母亲节这类每年变的为 null，激活时由店员填 |
| `suggested_amount` / `suggested_valid_days` | numeric / int | 建议值 |
| `is_active` | boolean | Ops 下架模板不影响店里已激活的活动 |

平台级数据，无 `restaurant_id`；店里只读。

### 2.2b `coupon_campaigns`（店内活动 · 四种一张表）

注册礼、生日礼、邀请礼、主题活动 **共用一张表**，不再一种活动一组列。

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `kind` | text | `signup` / `birthday` / `referral` / `theme` |
| `theme_id` | uuid null FK → coupon_campaign_themes | 从模板激活才有；自建主题为 null |
| `name` | jsonb null | 主题活动名称（从模板带入后可改） |
| `enabled` | boolean | 开关 |
| `starts_on` / `ends_on` | date null | 活动窗（Lisbon 日期）；null = 不限 |
| `amount` / `valid_days` | numeric(10,2) / int | 券面额 / 有效天数（邀请活动指 **被邀请人**） |
| `inviter_amount` / `inviter_valid_days` | numeric / int null | 仅 `referral`：邀请人的券 |
| `inviter_reward_limit` | int null | 仅 `referral`：每位邀请人最多奖励次数 |
| `auto_issue_on_start` | boolean default false | 仅 `theme`：开始日由 nightly 给全体自动发 |
| `created_at` / `updated_at` / `updated_by_user_id` | | |

唯一：`(restaurant_id, kind) where kind in ('signup','birthday','referral')` —— 这三种每店一条；`theme` 可多条。  
CHECK：`enabled` 时 `amount > 0 and valid_days > 0`；`referral` 时邀请人两列必填。  
编辑活动 **不影响已发的券**（券上有面额快照）。

### 2.3 `customers`（顾客档案）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `name` | text not null | |
| `phone` | text null | **统一存 E.164**（如 `+351912345678`，默认国家码 +351），登录标识；仅匿名化后为 null |
| `birthday` | date not null | |
| `nif` | text null | |
| `address` | text null | |
| `email` | text null | 存小写 |
| `email_verified_at` | timestamptz null | 找回时绑定的邮箱必须已验证 |
| `password_hash` | text not null | argon2id / bcrypt，**绝不**存明文 |
| `password_changed_at` | timestamptz | 改密后让旧会话失效 |
| `status` | text default `active` | `active` / `disabled`（停用）/ `anonymized`（RGPD 删除：清空个人字段，保留券与台账数字） |
| `invite_code` | text | 邀请链接里的短码；唯一 `(restaurant_id, invite_code)`，不用顾客 id 以免暴露 |
| `coupon_email_opt_in_at` | timestamptz null | 同意接收优惠邮件的时间；null = 不发；退订置 null |
| `preferred_locale` | text | `pt`/`en`/`zh`，邮件语言 |
| `privacy_accepted_at` / `privacy_version` | timestamptz / text | 注册时隐私条款同意记录 |
| `created_at` / `updated_at` | | |

唯一：`(restaurant_id, phone) where phone is not null`；`(restaurant_id, email) where email is not null`。  
`birthday` 匿名化后也可为 null（CHECK：`status<>'anonymized'` 时 phone、birthday 必填）。  
索引：`(restaurant_id, extract(month from birthday), extract(day from birthday))` 供夜间生日扫描（`to_char` 不是 IMMUTABLE，不能建索引）。  
登录防爆破 **不在本表计数、不硬锁账号**（硬锁可被他人故意输错把真顾客锁死）：按「IP + 手机号」逐级延迟，计数放限流存储。

### 2.4 `customer_sessions`（登录态）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` / `restaurant_id` | uuid FK | |
| `token_hash` | text unique | cookie 里放随机令牌，库里只存哈希 |
| `expires_at` | timestamptz | 建议 30 天滑动 |
| `revoked_at` | timestamptz null | 登出 / 改密 / 停用 |
| `created_at` / `last_seen_at` / `user_agent` | | |

cookie 名与员工 Supabase cookie **不同**，middleware 里两边互不识别。

### 2.5 `customer_auth_tokens`（找回密码 / 邮箱验证）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` / `restaurant_id` | uuid FK | |
| `purpose` | text | `password_reset` / `email_verify` |
| `email` | text | 发往哪个邮箱（验证时就是要绑定的那个） |
| `token_hash` | text unique | |
| `expires_at` | timestamptz | 15–60 分钟 |
| `used_at` | timestamptz null | 一次性 |
| `request_ip` | text | 限流用 |
| `created_at` | | |

限流：按 `(customer_id, created_at)`、`(request_ip, created_at)` 计数即可（或复用现有限流组件）。

### 2.5a `customer_referrals`（邀请关系）

| 列 | 类型 | 说明 |
|---|---|---|
| `invitee_customer_id` | uuid PK FK → customers | 一人只能被邀请一次 |
| `inviter_customer_id` | uuid FK → customers | CHECK 不等于 invitee |
| `restaurant_id` | uuid FK | |
| `campaign_id` | uuid null FK → coupon_campaigns | 注册时生效的邀请活动；活动关时为 null（只记关系不发券） |
| `invitee_coupon_id` | uuid null FK → coupons | 被邀请人注册即得 |
| `inviter_coupon_id` | uuid null FK → coupons | 被邀请人 **首次成功结账** 后发（已定） |
| `created_at` / `inviter_rewarded_at` | | |

邀请人的券在收款 RPC 同一事务里发：本次收款券主人是被邀请人、且 `inviter_coupon_id` 为空 → 发券并回填。  
⚠ 未登录的被邀请人结账时系统认不出是他，所以邀请人券要等被邀请人 **登录状态下** 的首次结账。

### 2.6 `coupons`（券实例）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` / `customer_id` | uuid FK | |
| `source` | text | `signup` / `birthday` / `referral_invitee` / `referral_inviter` / `theme` / `manual` |
| `campaign_id` | uuid null FK → coupon_campaigns | 活动发的才有；手动发为 null |
| `notified_at` | timestamptz null | 通知邮件已发；防重发 |
| `amount` | numeric(10,2) > 0 | **面额快照**，之后改活动配置不影响 |
| `valid_until` | date | 最后可用日（含当天），按 **Lisbon 日期** 比较 |
| `status` | text default `issued` | `issued` / `redeemed` / `voided`（**不存 expired**） |
| `birthday_year` | int null | 仅生日券；防同年重复 |
| `issued_by_user_id` | uuid null | 手动发券的员工；自动发为 null |
| `redeemed_at` / `redeemed_payment_id` | | 核销时间 + 对应台账行 |
| `voided_at` / `voided_by_user_id` / `void_reason` | | |
| `created_at` | | |

唯一（用数据库兜底"每人一次"）：

- `unique(customer_id) where source='signup'` —— 注册礼一人一张
- `unique(customer_id, birthday_year) where source='birthday'` —— 生日礼一年一张
- `unique(customer_id, campaign_id) where source='theme'` —— 同一主题活动一人一张（重复点发放 / 夜间重跑都不重复）
- `unique(redeemed_payment_id) where not null` —— 一张券只核销到一行台账

CHECK：`status='redeemed'` ⇔ `redeemed_payment_id` 非空；`status='voided'` ⇔ `voided_at` 非空。  
"过期" 只有一个真相：`status='issued' and valid_until < Lisbon 今天`。不另存过期状态，避免夜间没跑时状态与日期打架；列表分区「已过期」由查询算出。

### 2.7 `checkout_coupon_selections`（呼叫结账时选的券）

规则：**每一笔收款最多一张券**，以这一笔的呼叫结账人账户为准。"一笔"就是分单里的一个 `party_id`（整桌 1 个；均摊每份 1 个；按菜每票 1 个），与台账 `session_collected_payments.party_id` 同一个 id，三种模式一张表通吃，不按模式分散存。

| 列 | 类型 | 说明 |
|---|---|---|
| `bill_split_id` | uuid FK → bill_splits | 本桌结账计划 |
| `party_id` | uuid | 哪一笔 |
| `restaurant_id` / `session_id` | uuid FK | |
| `customer_id` | uuid FK → customers | 这一笔的呼叫结账人账户（券只能从这里出） |
| `coupon_id` | uuid FK → coupons | 选的券 |
| `selected_by` | text | `customer`（呼叫时）/ `staff`（结账页调整） |
| `updated_at` | timestamptz | |

主键：`(bill_split_id, party_id)` —— **一笔一张**。  
唯一：`(coupon_id)` —— 一张券同一时间只挂一处（两部手机 / 换桌都不会一券两用）。  
没选券的笔不建行。

谁能改：

| 时机 | 谁 | 能做什么 |
|---|---|---|
| 呼叫结账 | 已登录顾客 | 给 **自己呼叫的这一笔** 从自己账户选 0 或 1 张 |
| 呼叫之后 | 员工（结账页） | 换券 / 去掉券，**只能从该笔 `customer_id` 账户里选**；记 `operation_logs` |
| 未登录呼叫 | — | 这一笔不能用券（v1 员工不按手机号代查） |

各模式"这一笔的呼叫人"是谁：

| 模式 | 呼叫人 |
|---|---|
| 整桌 | 呼叫结账的那个人 → 整桌那一笔 |
| 按菜 | 每票的呼叫人（与 `bill_split_ticket_calls` 同一人）→ 他那一票 |
| 均摊 | 只有一个呼叫人 → v1 只能给 **他自己那一份** 选券（由他或员工指定是哪一份）；其他份没有已登录呼叫人，不能用券 |

**收款时是唯一裁判**：确认收款 RPC 重新校验（券 `issued`、未过期、属于该行 `customer_id`、本次收款就是该行 `party_id`、总闸开）；不合格就当没券、不核销。取消呼叫 / 票被 unlock 删除 / 关闭总闸时删行只是保持整洁，漏删也不会算错钱。

### 2.8 `session_collected_payments` 加列（核销落点）

现有 `amount` 保持 = **实收**，老报表不受影响。新增：

| 列 | 类型 | 说明 |
|---|---|---|
| `gross_amount` | numeric null | 折前应付 |
| `coupon_id` | uuid null FK → coupons | 抵扣的券主人见 `coupons.customer_id` |
| `coupon_amount` | numeric default 0 | 券抵扣额 = min(面额, 折前应付) |
| `discount_amount` | numeric default 0 | 员工折扣金额（在券后余额上算） |

唯一：`(session_id, party_id) where coupon_id is not null` —— **每一笔只核销一张券**（数据库兜底）。  
等式（CHECK）：`gross_amount - coupon_amount - discount_amount = amount`（gross 非空时）。  
**收款 + 券改 `redeemed`** 必须在 **同一个事务/RPC** 里完成；`client_request_id` 重试幂等照旧。

---

## 3. 关键流程 → 写哪些表

| 动作 | 写入 |
|---|---|
| 注册 | `customers` +1；送礼开且在期 → `coupons`(signup) +1；`customer_sessions` +1 |
| 登录 / 登出 | `customer_sessions` 新增 / 置 `revoked_at` |
| 忘记密码 | `customer_auth_tokens` +1（无邮箱时先 `email_verify`，验证后写 `customers.email/email_verified_at`） |
| 主题活动发放 | 全体或选定会员：批量插 `coupons`(theme)，冲突跳过 |
| 邀请注册 | `customers` +1 → `customer_referrals` +1 → 活动开则被邀请人 `coupons` +1 |
| 夜间任务 | 主题活动 `auto_issue_on_start` 且今天是开始日 → 全体发；生日：`coupons`(birthday) 插入，冲突即跳过（靠唯一索引幂等）。过期无需写库 |
| 呼叫结账（选券） | 现有呼叫写入时同一事务 upsert `checkout_coupon_selections`（这一笔） |
| 员工调整券 | 改 / 删 `checkout_coupon_selections` 该行 + `operation_logs` |
| 员工确认收款 | 一个事务：`session_collected_payments` +1（含券列）→ `coupons` 改 `redeemed` → 删该笔选券行 →（这一笔的呼叫人是待奖励的被邀请人时）给邀请人发券 |
| 作废 | `coupons` 改 `voided`（仅 `issued`）+ 删挂着它的选券行 + `operation_logs` |
| 店员改资料/代重置 | `customers` 更新 + `operation_logs` |
| 顾客申请删除 | `customers` 清空姓名/手机/邮箱/生日/NIF/地址，`status=anonymized`，吊销全部会话；券与台账保留 |

---

## 3.5 一桌多个注册顾客（已定：每笔一张）

1. **每一笔收款最多一张券**：整桌 = 一桌一张；按菜 = 每票一张；均摊 = 每份一张（v1 实际只有呼叫人那一份能用，见 §2.7）。
2. 每一笔的券 **以这一笔的呼叫结账人账户为准**；不能替同桌别人选，也不能把自己的券用到别人那一笔。
3. 员工结账页可调整，但只能在该笔呼叫人的账户里换。
4. **结账页 · 分单详情**：每一行（座位 / 票）标出是否用券，用券行显示「优惠券 −€X」（员工端加券主人名字，顾客端不显示是谁的券）。数据读 `checkout_coupon_selections`（未收款）/ 台账券列（已收款），按 `party_id` 对上该行。

---

## 4. 安全与租户隔离

1. 新表全部 `RLS on，无 policy`，只有服务端能读写；所有查询必须带 `restaurant_id`。
2. 每个 API 先查 `restaurants.customer_program_enabled`，关 → `customer_coupons_disabled`，不写库。
3. 顾客 API 只认顾客 cookie → `customer_sessions`；员工 API 只认 Supabase 员工会话 + `can(...)`。新增能力建议：`customers.view`、`customers.manage`、`coupons.issue`、`coupons.void`。
4. 令牌、密码只存哈希；返回给前端的邮箱默认打码。

---

## 5. 评审：需求文档遗漏 / 需要拍板的点

**会直接影响库或账的（建议先定）**

1. **台账"已付清"判定会坏**：现有 `reconcile_split_result_paid_from_ledger` 按"台账实收 ≥ 折后应付"判断票已付。用了券后实收变少，这票会永远"未付"。需要定：判定改用 `gross_amount` 或 `amount + coupon_amount`。（§2.8 已预留列）
2. **收款撤销/退款后券怎么办**：已核销后若收款被撤销，券回到可用还是作废？文档没写。
3. **选券后金额变了**：呼叫后恢复点餐又加菜/改分单，抵扣额按收款那一刻重算——建议写明。
4. **顾客认证方案**：文档只说"隔离"，没定是否用 Supabase Auth。本设计定为 **自建**（理由见 §0），需确认。
5. **有效期写法**：建议定"N 天"一种（§2.2）。

**合规（欧盟 / 葡萄牙必须补）**

6. **RGPD 同意**：注册页需隐私政策勾选（已在 §2.3 加列）。
7. **删除权**：用"匿名化"满足（§2.3 `anonymized`、§3）；需写进产品文档。
8. **营销同意**：若以后要发生日祝福/营销邮件，需单独勾选；v1 不发营销可注明。

**细节缺口**

9. **手机号格式**：需统一 E.164 + 国家码默认 `+351`，否则同一人可注册两次。
10. **2 月 29 日生日**：非闰年哪天发（建议 2 月 28 日）。
11. **夜间任务漏跑**：某晚没跑，第二天要不要补发昨天的寿星（建议回看 N 天，唯一索引保证不重复）。
12. **"生日年"口径**：文档留了"自然年或营业年"，建议直接定 Lisbon 自然年。
13. **Resend 免费额度是全平台共享**（100 封/天所有店加起来），店多了会不够；需要监控或预算。
14. **登录防爆破**：登录本身也要限流（逐级延迟，不硬锁，见 §2.3）。
15. **顾客自助改资料/改密码/改手机号**：文档只说"本店资料"，没写能改哪些；改手机号是否需验证。
16. **总闸关时已选的券**：收款时一律视为无效（§2.7）。
17. **报表口径**：营业额、日统计（analytics）里券抵扣算不算收入、是否单列"券抵扣总额"。
18. **手动发券上限**：员工单张最大面额/每日数量要不要限，防内部滥发。
19. ~~整桌/均摊的「这一笔」标识~~：已定用 `party_id`（§2.7）。
20. ~~一桌多注册顾客~~：已定每笔一张（§3.5）。
22. ~~邀请人奖励时机~~：已定首次登录结账后发。
23. **邀请链接防滥用**：同一设备/IP 短时间大量注册要限流。
24. **发券邮件**：已定走邮件（产品 §6.5）。需 Resend 付费档；群发要分批、失败可重试；不建发送记录表也行，但建议 `coupons.notified_at` 防重复发。
21. **均摊多人用券**：v1 只有呼叫人那一份能用券；若要每人都能用，需要顾客先认领自己那一份（后续）。
