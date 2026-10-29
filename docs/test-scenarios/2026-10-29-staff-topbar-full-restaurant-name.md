# 本次改动业务场景测试报告 — 职员顶栏完整店名

**日期：** 2026-10-29  
**分支：** `feat/topbar-full-restaurant-name`  
**范围：** 职员顶栏（`StaffPersonalTopBar` / `ProductTopBarBrand`）店名展示：完整显示，不再截断；窄屏时动作区可被挤出可视区。

---

## 1. 本次修改

- **内容：** 顶栏店名去掉 `truncate` / `min-w-0`；品牌区改为 `shrink-0`（不再 `flex-1` + 强制留出 7rem logo 地板）；动作区 `flex-1 min-w-0`，窄屏时店名优先完整显示。
- **文件：** `waiter-staff-sticky-chrome.ts`（+test）、`ProductTopBarChrome.tsx`、`StaffPersonalTopBar.tsx`、`docs/design/04-mobile-rules.md`
- **角色 / 页面：** 店主或前台登录后进入职员区（如 `/restaurant-mohnrib5/staff/tables`）；顾客端、厨房屏不在本次范围。
- **唯一写法：** `staffTopBarChrome.restaurantNameClassName` 一处定义；`ProductTopBarBrand` 一处消费。

## 2. 核心业务规则

1. 顶栏左侧店名须完整显示当前餐厅名称（如「白云自助火锅」），不得用省略号截断。
2. 店名与 logo 同属品牌区，宽度随字数增长，不被 logo 最小宽度挤成 0。
3. 窄屏时优先保证店名完整；右侧动作按钮可被挤出可视区（可横向滚动/裁切），不以截断店名换空间。
4. 不改变登录、选店、权限；仅布局与文案可见性。

## 3. 详细测试场景

### 场景 1：宽屏完整店名可见

- **前置状态：** 本地 web 在 feature 口（`:3002`）；白云 `restaurant-mohnrib5`；店主或前台已登录。
- **操作过程：** 打开职员桌台页；量测顶栏店名节点文本与 `getBoundingClientRect().width`。
- **预期结果：** 文本为完整店名；宽度 > 0；无 `…` 截断。
- **数据验证：** 不写库；仅 UI。
- **异常恢复：** 刷新后仍完整。
- **标签：** 【本次新增】布局规则 · 【已验证】/【未验证】见第 4 节

### 场景 2：窄屏（约 390px）店名仍完整、动作区可被挤出

- **前置状态：** 同场景 1；视口宽约 390。
- **操作过程：** 量测店名宽度与是否完整；观察右侧动作是否仍全部在视口内。
- **预期结果：** 店名完整且 width>0；动作区可能部分出屏——不判定为失败。
- **数据验证：** 无。
- **异常恢复：** 拉宽视口后动作回到可视区。
- **标签：** 【本次新增】

### 场景 3：回归 — 顶栏仍可进入设置/个人区相关入口

- **前置状态：** 同场景 1；宽屏。
- **操作过程：** 确认顶栏品牌与动作区仍渲染；登录会话有效（API login + 打开职员页）。
- **预期结果：** 页面可进；无白屏；店名与动作同排。
- **数据验证：** `mesa-local-uat` stack-health + login。
- **异常恢复：** 重新登录。
- **标签：** 【已实现】原有顶栏 · 回归

### 场景 4：不适用项说明

- **多用户并发 / 状态转换 / 收款锁定：** 纯展示布局，不适用。
- **顾客端 / 厨房：** 不使用 `StaffPersonalTopBar`，不适用。
- **历史数据：** 店名来自餐厅 settings，无迁移。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 场景 1 宽屏完整店名 | 【已验证】pass — `http://localhost:3002/dashboard/waiter`，文本「白云自助火锅」，w≈110，`truncated=false`，class 含 `shrink-0 whitespace-nowrap`、无 `truncate` |
| 场景 2 窄屏店名仍完整 | 【已验证】pass — 店名仍为「白云自助火锅」，`truncated=false`，w≈98>0 |
| 场景 3 回归顶栏可进职员页 | 【已验证】pass — owner/staff login + 打开 waiter 页正常 |
| mesa-local-uat stack-health / login | 【已验证】pass（`MESA_UAT_BASE=:3002`；ops softMissing） |
| 单元测试 `waiter-staff-sticky-chrome.test.ts` | 【已验证】pass（3） |

## 5. 风险与待确认

- 极长店名 + 极窄屏时动作按钮完全不可点：产品已接受「店名优先」；若线上需兼顾，另开任务加横向滚动容器（本次不引入第二套截断）。
