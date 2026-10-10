# 收款台账按人（party_id）定稿方案

> **状态**：方案定稿（未实现）· 2026-10-10  
> **读者**：产品、开发  
> **相关**：[`04-business-rules.md`](./04-business-rules.md)「收款台账」；[`by-item-collect-payment.zh.md`](./by-item-collect-payment.zh.md)；均摊座位 id 已落地（`even-split-party` / `merge_even_split_result_with_ledger`）

本文是 **台账如何标记「这笔钱记在谁头上」** 的唯一目标口径。与现网实现冲突时：以「当前行为」小节为准；落地后以本文「目标态」为准。

---

## 1. 要解决什么

收款要回答的是：**这一笔记在哪个人头上**。与桌上有几个人无关（整桌一人也要标到那个人）。

### 当前行为（已证实）

| 层 | 认人方式 |
|---|---|
| 分单花名册（均摊 / 按菜 `persons`·`result`） | 优先 `party_id`；名字是标签 |
| 按菜认领票 | 票 key 优先 `p:{party_id}` |
| 员工点「收款」找座位 | 先用 id（没有再用名字）在 `result` 里定位，再得到下标 |
| **台账** `session_collected_payments` | **只存 `person_index`（+ 展示用 `person_name`），不存 `party_id`** |
| 确认收款 RPC | `confirm_bill_split_payment(..., p_person_index, …)` |
| 某人已收 / 是否付清 | TS：`sumCollectedByPersonIndex`；SQL：`session_person_collected_by_index`（付清戳 / 超收也靠它） |
| 按菜解锁删票 | 后面座位的台账 `person_index` 整体减 1 |

点收款时的路径是：**用 id 找到人 → 把那个人的下标写进台账**。  
分单认人与台账认人不在同一字段上；解锁还要靠挪下标，说明下标是会变的指针，不是稳定身份。

### 目标态（一句话）

**台账以 `party_id` 为「人」的唯一标记；新收款必须带 id。`person_index` 只作旧行兼容与过渡期辅助，不再当认人真相。**

---

## 2. 目标态形状

### 数据

`session_collected_payments` 增加可空列：

- `party_id uuid null` — 收款记在哪个人（与分单座位 / 按菜票同一套 id）

保留现有：

- `person_index int null` — **只作旧行兼容**：无 `party_id` 的历史收款仍靠它认人。新收款以写 `party_id` 为准；新行可不再写下标（也可顺带写，不强制）。**汇总认人不再依赖新行的下标**
- `person_name text` — 仅展示快照

### 读「某人已收多少」

唯一规则（sole）——**前端与 SQL 同一套**（含 `session_person_collected_by_index` / `reconcile_split_result_paid_from_ledger`，不得只改 TS）：

1. 台账行有 `party_id` → 按 id 累加，对上 `result` / 花名册里同 id 的座位  
2. 台账行没有 `party_id` → **仍用 `person_index`**（与今日行为一致）  
3. 一行同时有 id 与下标且对不上 → **只认 id**，忽略下标  
4. 台账有 id、当前花名册对不上任何人 → 金额仍计入**整桌已收合计**；不记到任何座位的「某人已收」（异常数据，不丢桌级账）  
5. 禁止再用纯名字当台账认人主键（名字只展示）

同一人多笔部分收款：按同一 `party_id` 累加（与今日多笔同下标一致）。

### 写「确认收款」

1. **服务端保证**目标座位有 `party_id`：花名册该行已有则用；没有则盖章生成并写回分单，再写台账（整桌 / 均摊 / 按菜同一要求）  
2. **入参（已定）**：调用方传目标座位的 `party_id`；RPC **用 id 在 `result` 里找人**，再校验应付与超收。禁止「只传下标、服务端再换成 id」当认人主路径——下标在并发解锁时会漂，会记错人。`client_request_id` 冲突比对以 `party_id`（及金额等既有字段）为准，不以漂下标为准。  
3. 插入台账时 **必写 `party_id`**；`person_index` 不强制（旧行兼容保留列与读法，见上）

### 按菜解锁删票

目标：删未付票后，**不必再**对后续台账行做 `person_index - 1`（新账认人靠 id）。  
读路径改为 id 优先后即可去掉移位；旧行无 id 仍按下标读——靠非营业期一次升级，不靠长期双写下标撑着。

**升级节奏**：本方案在**非营业期**落地（含去掉移位）。不假设营业中长期「同一桌混着无 id 旧台账行」。

### 整桌

整桌也是「标到那一个人」：`result[0]`（或整桌哨兵行）必须有稳定 `party_id`；台账同样写该 id。不是「只有一位所以可以不标」。  
**盖章时机（已定）**：第一次写入整桌分单就盖（与均摊/按菜「花名册一出现就有 id」一致）；不是第一次收款时再补。

---

## 3. 历史数据会不会乱

**不会自动乱**——前提是读路径永久保留「无 id → 下标」。

| 数据 | 处理 |
|---|---|
| 已关台旧收款 | 无 `party_id` → 继续按下标读；金额与关台时一致 |
| 仍开台、分单行已有 id | **可选** backfill：仅当 `result[person_index].party_id` 非空时填入该 id；否则跳过，留下标 |
| 分单行也没有 id 的很老桌 | 台账保持下标兼容，直到该桌再次写分单盖上 id |

禁止：无 id 时用名字强行猜填 `party_id`（重名会写错人）。  
「对得上」只认「该下标上已有 `party_id`」，不用名字比对。

---

## 4. 落地阶段（建议顺序）

不做「只在前端多传一个字段、库与汇总仍只认下标」的半套。

1. **Schema**：`session_collected_payments.party_id` 可空 + 索引（按需 `(session_id, party_id)`）  
2. **写路径**：`confirm_bill_split_payment`（及等价写入）必写 `party_id`；缺座位 id 时服务端盖章写回分单；新行不强制写 `person_index`  
3. **读路径**：TS + SQL 同时改为「有 id 用 id，否则下标」（sole helper；收窄 `sumCollectedByPersonIndex` / `session_person_collected_by_index`）——下标读法只为兼容旧行  
4. **可选 backfill**：仅可安全对齐的会话（规则见 §3）  
5. **解锁**：读路径改完后去掉台账下标移位（非营业期升级，见 §2）  
6. **收紧（可后置）**：新收款拒绝缺 id；文档与 `04-business-rules` 收款台账节改为 id 主键  

每阶段保持：旧行无 id 行为与改前一致。

---

## 5. 涉及面（实现时核对，非穷尽考古）

| 区域 | 符号 / 位置（实现时以仓库为准） |
|---|---|
| DB | `confirm_bill_split_payment`；`session_person_collected_by_index`；`reconcile_split_result_paid_from_ledger`；按菜 unlock 台账下标移位；`docs/ai-schema.md` |
| 写入 API | `checkout-confirm-payment` / `confirm-payment` route |
| 汇总 | `checkout-session-payments`（`sumCollectedByPersonIndex` 等）；`checkout-split-settlement` |
| 均摊锁座位 | `allocationLockedEvenPartyIds`（现用台账下标找座位，需随读路径改） |
| UI 收款定位 | `CheckoutRequestDetailHost`、按菜 `resolveByItemCollectTarget` / collect register |
| 分单小票 | `requestStaffSplitReceiptPrint`（现要求 `person_index`；另有 `collectedPaymentId`） |
| 产品规则 | 本文；`04-business-rules.md`「收款台账」 |

---

## 6. 风险与验证

| 风险 | 控制 |
|---|---|
| 旧行被误 backfill | 无座位 id 不填；禁止按名猜 |
| 双轨期两套算法 | 唯一读 helper（TS+SQL）：id 优先，否则下标；禁止第三套按名累加当真相 |
| 只改前端不改 SQL | 阶段 3 必须两边一起改；UAT 看付清戳与超收 |
| 解锁与汇总不一致 | 阶段 3 后再改解锁；改前 UAT「收一人 → 解锁另一未付票 → 已收仍挂原 id」 |
| 整桌漏盖 id | 收款落库前服务端保证整桌行有 id（与均摊同一套 mint） |

**验证清单（落地时）：**

- 均摊：收 A → 改名 A → 再收原座位：台账 id 不变，已收不串人  
- 按菜：收票 1 → 解锁未付票 2 → 票 1 已收仍对、无须依赖下标移位正确性（阶段 5 后）  
- 整桌：一笔收款台账带该人 id  
- 纯旧数据会话（台账无 id）：已收 / 待收与改前一致  
- 历史关台单：营业额 / 订单史金额不因迁移变化  

---

## 7. 非目标

- 不改付款方式枚举、IVA、FS/FT（见 `collect-payment-receipt-iva.zh.md`）  
- 不把按菜票模型改成「同名合并」  
- 不在本方案要求立刻删除 `person_index` 列（可长期保留作审计/兼容）  
- 不强制 `supabase db reset`  
- 不改转台 / 并台行为（维持现状）  
- 开票幂等仍以 `session_collected_payments.id` 等既有规则为准；本方案不强制把开票验收绑在台账新列上  

---

## 8. 与均摊 party_id 的关系

均摊座位稳定 `party_id`（改名不加人）**已落地**，解决的是分单花名册合并。  
本方案补的是：**台账与花名册用同一套人标记**，三种结账方式在「收款记人」上收口。

实现前须 Will 确认本方案（含 §9）；确认后单独开分支按阶段落地，勿与无关结账改动捆在一起。

---

## 9. 已拍板（原待定）

1. **整桌何时盖 `party_id`**：第一次写入整桌分单就盖。  
2. **确认收款怎么传人**：前端（及 API）传 `party_id`；服务端用 id 定位座位。幂等冲突比对以 id 为准。  
3. **`person_index`**：列与「无 id → 按下标读」保留，只为兼容旧行；新收款不强制写下标。  
