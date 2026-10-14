# 本次改动业务场景测试报告：客人菜单左边类别栏避开底栏

日期：2026-10-14  
分支：`fix/menu-category-rail-above-footer`  
UAT base：`http://localhost:3003`

## 1. 本次修改

- **内容：** page 模式左栏高度在扣顶栏之外，再扣底栏 `3.5rem` + `--mesa-customer-menu-bottom-safe`，滚到底时最后一项不被固定底栏挡住。
- **文件：** `customer-menu-chrome-layout.ts` / `.test.ts`
- **唯一写法：** `CUSTOMER_MENU_CATEGORY_RAIL_PAGE_SCROLL_HEIGHT_CLASS` → 仅 `customerMenuCategoryRailPageScrollClass`

## 2. 核心业务规则

1. 【本次新增】有店面带时，左栏可视滚动区底部在底栏之上（不伸进底栏）。
2. 【已实现】左栏仍不跟右边菜品列同高（`self-start`）。

## 3. 详细测试场景

### 场景 1：滚到左栏底 — 最后一项在底栏上方

- **前置：** 白云客人菜单，店面带已滚走；类别很多。
- **操作：** 左栏 `scrollTop` 拉满。
- **预期：** 最后一项底边 ≤ 底栏顶边；`obscuredPx=0`。
- **结果：** 【已验证】**pass**（`:3003`，rail 底 671 / dock 顶 677，gap≈6px）

### 场景 2：高度合同

- **预期：** DOM/CSS 使用含 `3.5rem` + `bottom-safe` 的唯一高度 token。
- **结果：** 【已验证】**pass**

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| unit | pass |
| 场景 1–2 | 【已验证】pass |
| lint+typecheck | pass |

## 5. 风险与待确认

- 顶栏预算仍用 `6.5rem`：【待核实】极高安全区机型。
