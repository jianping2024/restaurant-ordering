# 本次改动业务场景测试报告 — 收款台账 party_id

> 日期：2026-10-10  
> 分支：`fix/checkout-ledger-party-id`  
> 方案：`docs/product/checkout-ledger-party-id.zh.md`

## 1. 本次修改

- 台账 `session_collected_payments` 增加 `party_id`；确认收款 RPC 以 `party_id` 认人并落库
- 读路径 sole：`session_seat_collected`（SQL）+ `sumCollectedForResultSeats`（TS）；无 id 旧行仍按下标
- 整桌第一次写分单即盖 `party_id`；按菜解锁不再挪台账下标
- 涉及：确认收款 API/UI、结算汇总、按菜本次应收、均摊锁座位、文档

## 2. 核心业务规则

1. 新收款必须带座位/票的 `party_id`；台账认人以 id 为准  
2. 旧台账无 id → 仍用 `person_index`  
3. 一行同时有 id 与下标且冲突 → 只认 id  
4. 解锁删未付票后，已收金额仍挂在原 `party_id` 上（不靠下标移位）

## 3. 详细测试场景

### 场景 1：均摊 — 收款后改名再收原座位

- **前置**：均摊两人，座位各有 `party_id`  
- **操作**：收 A → 改名 A → 再收原座位  
- **预期**：台账 `party_id` 不变，已收不串人  
- **标签**：【本次新增】【未验证】（产品 UAT 本提交未跑；单测覆盖认人 helper）

### 场景 2：按菜 — 收票 1 后解锁未付票 2

- **前置**：两票，票 1 已收款（台账有 `party_id`）  
- **操作**：解锁未付票 2  
- **预期**：票 1 已收仍对；库中无 `person_index - 1`  
- **标签**：【本次新增】【未验证】（迁移已去掉移位；待产品 UAT）

### 场景 3：整桌 — 分单与收款同 id

- **前置**：整桌建分单  
- **操作**：确认收款  
- **预期**：`result[0].party_id` 与台账 `party_id` 一致  
- **标签**：【本次新增】；单测【已验证】（`buildWholeTableCheckoutPayload` / normalize 保 id）；产品路径【未验证】

### 场景 4：旧台账无 party_id

- **前置**：台账行仅有 `person_index`  
- **操作**：读结算汇总  
- **预期**：已收/待收与改前一致  
- **标签**：【已实现】单测【已验证】（`sumCollectedForResultSeats` legacy 分支 / settlement）

### 场景 5：回归 — 确认收款 API 契约

- **操作**：`POST …/confirm-payment` 传 `party_id`（不再靠 `person_index` 认人）  
- **预期**：缺 id → `invalid_party_id`；成功返回 collection 含 `party_id`  
- **标签**：【本次新增】代码【已实现】；产品栈【未验证】

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 聚焦单测（session-payments / split-intent / settlement / by-item-collect / collect-attempt-ids） | **pass** |
| `gate.sh scan`（清冗余报告） | **pass**（见 `.mesa-agent-gates/fix__checkout-ledger-party-id/scan.md`） |
| `gate.sh check`（lint+typecheck） | 见提交前命令输出 |
| `mesa-local-uat` / 浏览器结账路径 | **未跑**（本提交按「测试通过即 commit、不合 main」；产品 UAT 合前补） |
| 本地迁移 `20261010240000` / `…241000` | **已应用到本机 Docker** |

## 5. 风险与待确认

- 产品路径（均摊改名、按菜解锁、整桌收款）须在合 main 前补 `mesa-local-uat` + 浏览器  
- 历史关台单不迁金额；依赖永久「无 id → 下标」读法  
