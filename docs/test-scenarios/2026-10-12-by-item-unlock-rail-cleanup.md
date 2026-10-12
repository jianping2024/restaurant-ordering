# 本次改动业务场景测试报告 — 按菜恢复点单后人名条清理

日期：2026-10-12  
分支：`fix/by-item-unlock-rail-cleanup`  
UAT 基座：`MESA_UAT_BASE=http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）  
店：`lucky-tea-mulcs62n` · 账号：`luckytea@gmail.com`

## 1. 本次修改

- **内容**：员工结账页按菜「恢复点单」（按票解锁）后，被删掉的那张票的人名必须从人名条和分单结果上立刻消失；权威名单里已经没了的票，不能再当空壳芯片挂着，也不能借「改名残留」或队列 refresh 把未付票拼回。
- **文件**：
  - `apps/web/src/lib/staff-by-item-people.ts` — sole `syncStaffByItemRailPeople` 增加 `previousAuthoritative`，离开权威名单的票一律去掉
  - `apps/web/src/components/dashboard/checkout/StaffByItemSplitWorkbench.tsx` — 记住上一轮权威名单并交给 sole sync
  - `apps/web/src/lib/by-item-committed-draft.ts` / `use-by-item-split-state.ts` — 权威变更后剪掉已不在 seed 的草稿票
  - `apps/web/src/lib/checkout-request-state.ts` / `bill-split-result-merge.ts` — 队列 refresh 按菜走 `mergeByItemSplitResultWithLedger`；`mergeSplitResultPaid` 不再用本地更长 result 把已删未付票拼回（避免分单结果 €0 幽灵）
  - 单测 + `AGENTS.md` 口径
- **角色 / 页面**：员工 · `/dashboard/checkout` 按菜份额区
- **不改**：服务端删票 SQL、客人呼叫接口、整桌/均摊页脚恢复点单

## 2. 核心业务规则

1. 【已实现】按菜「恢复点单」= 删未付已呼叫票（persons / result / 呼叫行）。
2. 【本次新增】删票后，员工人名条必须与当前权威名单对齐：权威里没了的票芯片必须拿掉。
3. 【本次新增】删票后，分单结果（Resultado）也不得再显示已删未付票的 €0 空壳；队列刷新以服务端 result 为准，本地只保留已付标记，不得把已删票拼回。
4. 【已实现】收完一人后临时 mint 的「客人 N」空位仍可留（未上过服务端的接力位）。
5. 【已实现】已收款票不能解锁，人名保留。
6. 【已实现】客人再次呼叫结账 = 新票进服务端，再灌进员工页；本次清理不得挡这条路。

## 3. 详细测试场景

### 场景 1：两张未付票只恢复一张

- **前置状态**：员工结账页按菜；A-05 上 Aa、Kk5 均已呼叫未付。
- **操作过程**：选中 Kk5 → 点「Retomar pedidos」。
- **预期结果**：人名条与分单结果立刻只剩 Aa；Kk5 芯片消失（不是 €0 空壳）；池子出现 Restante 1A。
- **数据验证**：`GET …/checkout/requests` 该桌 result/persons 仅 Aa。
- **异常恢复**：不刷新页面也应立刻干净。
- **标签**：【已验证】pass

### 场景 2：解锁后空壳不得再写回

- **前置状态**：场景 1 之后，页未关。
- **操作过程**：观察条上无 Kk5；Resultado 无 Kk5 €0；另一次解锁 Kk6 后同样检查。
- **预期结果**：已删人名不出现在条上或 Resultado。
- **数据验证**：API result 无已删 `party_id`。
- **标签**：【已验证】pass

### 场景 3：串行收款空位「客人 N」仍在

- **前置状态**：A-02 按菜已收 Alice（✓）；条上另有「Pessoa 2」空位。
- **操作过程**：打开 A-02 详情观察。
- **预期结果**：「Pessoa 2」空位仍在；Alice 锁定保留。
- **数据验证**：UI 可见 Alice ✓ + Pessoa 2。
- **标签**：【已验证】pass（既有部分收款桌；unlock 后空位保留另有单测）

### 场景 4：解锁最后一张未付且零收款

- **前置状态**：A-05 仅剩未付已呼叫票（先解锁 Kk6 只剩 Aa），台账无收款。
- **操作过程**：对 Aa 点「Retomar pedidos」。
- **预期结果**：该人名从条上消失；桌离开结账队列（pending 3→2；详情「Selecione uma mesa」）。
- **数据验证**：队列无 A-05。
- **标签**：【已验证】pass

### 场景 5：再次呼叫结账（回归）

- **前置状态**：解锁 Kk5 后池子有 Restante。
- **操作过程**：客人 API 再呼叫 Kk6（新 `party_id`）。
- **预期结果**：新票进入结账队列；员工人名条与 Resultado 显示 Kk6；不被旧壳挡住。
- **数据验证**：API result 含 Aa+Kk6；UI 出现 Kk6。
- **标签**：【已验证】pass

### 场景 6：已收款票不可恢复（回归）

- **前置状态**：A-02 Alice 已收款锁定。
- **操作过程**：打开 A-02；选中 Alice 看控件；API `POST …/unlock-ticket` 对 Alice `party_id`。
- **预期结果**：UI 无对已付票的恢复入口（无 Retomar 在 Alice 上）；API 返回 `ticket_not_found`；人名仍在。
- **数据验证**：Alice 仍 ✓ / Pago €9.00。
- **标签**：【已验证】pass

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| `mesa-local-uat stack-health` | pass（ready；ops soft missing 不影响） |
| `mesa-local-uat login` owner luckytea | pass |
| `GET …/checkout/requests` 解锁后 result | pass（仅剩未删票） |
| UI 解锁后人名条 | pass |
| UI 解锁后 Resultado（无 €0 幽灵） | pass |
| 单测 `staff-by-item-people` / `by-item-committed-draft` / `checkout-request-state` / `bill-split-result-merge` | pass（42） |
| 场景 1–6 | 见上；均为【已验证】pass |

## 5. 风险与待确认

- 无未解决产品问题。
- A-01 / A-02 为店内既有队列数据，未在本任务关掉。
