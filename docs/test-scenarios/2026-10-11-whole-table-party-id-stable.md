# 本次改动业务场景测试报告 — 整桌认人 id 稳定（不重算换 id）

> 日期：2026-10-11  
> 分支：`fix/checkout-ledger-party-id`  
> 相关：`docs/product/checkout-ledger-party-id.zh.md`  
> UAT base：`http://localhost:3002`（`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- 整桌草稿持有稳定付款人 `party_id`（与均摊座位同一写法）：重算金额不换 id  
- 从结账计划 hydrate：`resolveWholeTablePartyIdFromSplit`  
- 涉及：`bill-split-draft` / `use-bill-split-draft` / `checkout-split-intent` + 单测  
- 同分支待合：整桌 upsert 保留 id 迁移 `20261010242000`（此前 UAT 已证实丢 id）

## 2. 核心业务规则

1. 整桌付款人只有一个认人 id；建计划时生成/沿用，收款必须带同一 id  
2. 草稿重算、改折扣展示、再 persist，不得换新人  
3. 恢复点单作废未收整桌计划后，再结是新计划（新 id）；新计划内仍须稳定  
4. 均摊/按菜认人仍各自挂在座位/票上（本次不改其写法）

## 3. 详细测试场景

### 场景 1：整桌 — persist 后立刻收款（id 一致）

- **前置**：开台有应付；员工进结账整桌  
- **操作**：`POST …/checkout/request`（whole_table）→ 读 `result[0].party_id` → `POST …/confirm-payment` 带同一 id  
- **预期**：200；台账行 `party_id` 与分单一致；`all_paid=true`  
- **标签**：【本次新增】【已验证】

### 场景 2：整桌 — 恢复点单后再结再收

- **前置**：整桌已呼叫未收款  
- **操作**：`POST …/resume-ordering` → 再 `checkout/request` → `confirm-payment` 用新计划的 id  
- **预期**：第二次收款 200；新旧计划 id 可不同，但收款 id = 当前计划 id  
- **标签**：【本次新增】【已验证】

### 场景 3：单测 — 同 id 重算金额不变

- **操作**：`computeSplitResults` 两次不同 total、同一 `wholeTablePartyId`  
- **预期**：`party_id` 不变  
- **标签**：【本次新增】【已验证】

### 场景 4：回归 — 非法/缺失 party_id 仍 400

- **操作**：`confirm-payment` 不传或非法 `party_id`  
- **预期**：`400 invalid_party_id`  
- **标签**：【已实现】【已验证】

### 场景 5：浏览器结账页点收款

- **操作**：员工 UI 整桌点收款确认  
- **预期**：成功提示/台账有行  
- **标签**：【本次新增】【未验证】（契约以 API+SQL 为准；本轮未逐项点 UI）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 聚焦单测 `bill-split-draft` / `checkout-split-intent` | **pass** |
| 清冗余 `gate.sh scan` | **pass** |
| 场景 1 API（A-05 整桌收款，id 一致） | **pass**（`confirm-payment` 200，`collection.party_id` = 计划 id） |
| 场景 2 API（A-04 恢复→再结→收款） | **pass**（正确 id 200；故意用恢复前旧 id → 400 `invalid_party_id`） |
| 场景 3 单测重算 | **pass** |
| 场景 4 非法/缺失 `party_id` | **pass**（400 `invalid_party_id`） |
| 场景 5 UI | 【未验证】 |

UAT base：`MESA_UAT_BASE=http://localhost:3002` · slug `lucky-tea-mulcs62n` · owner `luckytea@gmail.com`

### 清冗余（UAT 前）

- **Scanned：** `wholeTablePartyId` / `resolveWholeTablePartyIdFromSplit` / `initialWholeTablePartyId` / `wholeTableSplitResult` / collect 路径  
- **None found：** 无平行「收款时改用服务端 id」旁路；无死导出；`initialWholeTablePartyId` 仅作 hydrate+mint 一处封装  

## 5. 风险与待确认

- 本地草稿未单独持久化 `wholeTablePartyId`：有服务端整桌计划时以计划 hydrate；无计划时靠内存 state（刷新会 mint 新 id，与「尚未 persist」一致）  
- 浏览器整桌点收款未本轮点测  
