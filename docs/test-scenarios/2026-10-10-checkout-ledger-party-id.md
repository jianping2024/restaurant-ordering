# 本次改动业务场景测试报告 — 收款台账 party_id

> 日期：2026-10-10  
> 分支：`fix/checkout-ledger-party-id`  
> 方案：`docs/product/checkout-ledger-party-id.zh.md`  
> UAT base：`http://localhost:3002`（`MESA_NEXT_DIST_DIR=.next-uat`）· slug `lucky-tea-mulcs62n`

## 1. 本次修改

- 台账 `session_collected_payments` 增加 `party_id`；确认收款 RPC 以 `party_id` 认人并落库
- 读路径 sole：`session_seat_collected`（SQL）+ `sumCollectedForResultSeats`（TS）；无 id 旧行仍按下标
- 整桌第一次写分单即盖 `party_id`（TS + SQL upsert 保留/盖章；UAT 发现 SQL 曾丢掉 id，已补 `20261010242000`）
- 按菜解锁不再挪台账下标
- 涉及：确认收款 API/UI、结算汇总、按菜本次应收、均摊锁座位、文档

## 2. 核心业务规则

1. 新收款必须带座位/票的 `party_id`；台账认人以 id 为准  
2. 旧台账无 id → 仍用 `person_index`  
3. 一行同时有 id 与下标且冲突 → 只认 id  
4. 解锁删未付票后，已收金额仍挂在原 `party_id` 上（不靠下标移位）

## 3. 详细测试场景

### 场景 1：均摊 — 改名后再收原座位

- **前置**：A-06 均摊三人，座位各有 `party_id`；前两座已收  
- **操作**：`POST …/checkout/request` 将未付座「客人 3」改名为 `Bob`（`party_id` 不变）→ `POST …/confirm-payment` 传该 `party_id` 收 €23.90  
- **预期**：台账 `party_id=5c2790f3-…`，`person_name=Bob`，`person_index=2`  
- **标签**：【本次新增】【已验证】（API + SQL）

### 场景 2：按菜 — 收票 1 后解锁未付票 2

- **前置**：A-02 按菜；Alice 已收（台账 `party_id=812fc37f-…`，`person_index=0`，€9）  
- **操作**：补未付票 Bob（自助餐人头）→ `POST …/unlock-ticket` `ticket_keys=['p:{bob}']`  
- **预期**：Bob 从 persons/result 消失；Alice 台账行仍在，`party_id`/`person_index` 不变（无 `-1`）  
- **标签**：【本次新增】【已验证】（API + SQL）

### 场景 3：整桌 — 分单与收款同 id

- **前置**：A-05 整桌 billing €23.90  
- **操作**：`POST …/checkout/request` 带 `party_id=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee` → `confirm-payment` 同 id  
- **预期**：`result[0].party_id` 与台账 `party_id` 一致；`all_paid=true`  
- **标签**：【本次新增】【已验证】（修复 `20261010242000` 后 API + SQL）  
- **注**：修复前 SQL 整桌重写丢掉 `party_id`（已证实）

### 场景 4：旧台账无 party_id

- **前置 / 操作 / 预期**：读路径无 id → 按下标累加  
- **标签**：【已实现】单测【已验证】（`sumCollectedForResultSeats` legacy / settlement）；产品栈未另造历史脏行

### 场景 5：回归 — 确认收款 API 契约

- **操作**：`confirm-payment` 传非法/缺失 `party_id`；成功路径返回 collection 含 `party_id`  
- **预期**：`400 invalid_party_id`；成功含 id  
- **标签**：【本次新增】【已验证】（非法 uuid / 仅 `person_index` → 400；hh/Bob/整桌成功含 id）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 聚焦单测（session-payments / split-intent / settlement / by-item-collect / collect-attempt-ids） | **pass**（提交前） |
| `gate.sh scan`（清冗余） | **pass** |
| 产品 API UAT（`MESA_UAT_BASE=http://localhost:3002`） | **pass**（场景 1–3、5） |
| 场景 4 历史脏行产品复现 | 单测覆盖；未另插脏行 |
| 本地迁移 `20261010240000` / `…241000` / `…242000` | **已应用到本机 Docker** |

## 5. 风险与待确认

- 合 main / push 前须把 `20261010242000` 一并提交；云端/店机未推迁移前整桌仍会丢 id  
- 浏览器结账页点收款未在本轮逐项点测（契约与台账以 API+SQL 为准）
