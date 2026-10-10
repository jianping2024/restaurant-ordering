# 本次改动业务场景测试报告：顾客账单合计下已收/待收

日期：2026-10-10  
分支：`fix/guest-bill-collected-pending`  
UAT 基址：`http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）  
店：`lucky-tea-mulcs62n`

## 1. 本次修改

- **内容**：顾客（及员工代看）账单明细卡片「合计」下方，在台账已有收款时展示「已收 / 待收」；有折扣时额外展示「应收」与折扣说明。
- **文件**：`BillDetailsSection.tsx`、`BillPage.tsx`、`checkout-settlement.ts`（`resolveGuestBillCollectionFooter`）及单元测试；本场景文档。
- **角色 / 页面**：顾客手机账单页；员工代看账单（只读明细）。
- **流程**：开台 → 下单 →（可选）部分收款 → 打开账单页查看金额区。

## 2. 核心业务规则

1. 【本次新增】台账已收金额 > 0 时，合计下才出现已收、待收；未收款时仍只显示合计一行。
2. 【已实现】待收口径唯一：`liveSessionUncollectedAmount`（有进行中 `requested` 分单时与员工结账页待收一致；否则 = 可计费合计 − 已收）。
3. 【已实现】已收 = 台账 `session_collected_payments` 合计（`totalCollectedAmount`）。
4. 【本次新增】有折扣且分单为 `requested` 时，合计下再显示「应收」（折后）及折扣文案。
5. 【已实现】底栏「呼叫结账 — €x」仍是本票/本方式呼叫金额，与整桌「待收」不是同一字段。
6. 【已实现】文案复用员工结账：`checkout.settlementCollected` / `settlementPending` / `finalAmount`。

## 3. 详细测试场景

### 场景 1：无收款时只显示合计 【已验证】

- **前置状态**：A-03 开台自助餐，台账无收款。
- **操作过程**：顾客打开 `/lucky-tea-mulcs62n/bill?table_id=…`。
- **预期结果**：有「合计 €23.90」；合计下无「已收」「待收」。
- **数据验证**：快照无「已收」「待收」文案。
- **异常恢复**：不适用。

### 场景 2：部分收款后合计下出现已收/待收 【已验证】

- **前置状态**：A-02 开台；加茶 ×2；客人 Alice 按菜认领茶并呼叫；员工收 Alice €9。
- **操作过程**：另一台手机（新隔离上下文）打开同桌账单，切中文。
- **预期结果**：合计 €32.90；已收 €9.00；待收 €23.90。
- **数据验证**：待收 = 合计 − 已收（本桌无折扣）；与台账一致。
- **异常恢复**：不适用。

### 场景 3：按菜未认领时底栏 €0 ≠ 整桌待收 【已验证】

- **前置状态**：同场景 2；本机未认领。
- **操作过程**：对照合计下「待收」与底栏「呼叫结账」。
- **预期结果**：待收 €23.90；底栏「呼叫结账 — €0.00」。
- **数据验证**：快照同时存在两处金额。
- **异常恢复**：不适用。

### 场景 4：有折扣时露出应收 【未验证】

- **原因**：本轮 UAT 未构造带 `discount_rate > 0` 的进行中分单；单元测试已覆盖 `resolveGuestBillCollectionFooter` 折扣分支。

### 场景 5：员工代看账单同步露出 【未验证】

- **原因**：本轮未走楼面 `from=` 代看 URL；代码上 StaffBillDetailsView 与 Guest 共用 `resolveGuestBillCollectionFooter` + `BillDetailsSection.collectionFooter`。

### 场景 6：回归 — 结账方式锁文案仍在 【已验证】

- **前置状态**：同场景 2。
- **操作过程**：看结账方式区。
- **预期结果**：方式锁定；文案「已有收款；已付客人的菜品归属不可改，其余可调整。」；金额在合计区。
- **数据验证**：快照同时有锁文案与已收/待收。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 `gate.sh scan` | **pass**（指纹见 `.mesa-agent-gates/fix__guest-bill-collected-pending/scan.md`） |
| 单元测试 `checkout-settlement.test.ts` | **pass**（12 tests） |
| `mesa-local-uat stack-health` | **pass**（web loginApi + supabase；ops softMissing） |
| owner 登录 | **pass** |
| 浏览器：无收款只合计（场景 1） | **pass** |
| 浏览器：有收款见已收/待收（场景 2/3/6） | **pass** |
| 折扣应收（场景 4） | **skip**（未造折扣数据；单测覆盖） |
| 员工代看（场景 5） | **skip**（未跑 UI；同组件接线） |

## 5. 风险与待确认

- 整桌有收款后客人进「已呼叫」成功页，看不到编辑态合计区——属既有相位；本改动的合计下已收/待收主要服务仍可编辑的账单（如按菜部分收款）。
- 折扣 UI 依赖现场折扣数据；单测已锁口径。
