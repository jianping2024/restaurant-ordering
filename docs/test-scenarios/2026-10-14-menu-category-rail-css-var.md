# 本次改动业务场景测试报告：客人菜单左边类别栏（CSS 变量高度）

日期：2026-10-14  
分支：`fix/menu-category-rail-page-height-css-var`  
UAT base：`http://localhost:3004`（`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容：** 有店面带时，左栏高度用 `globals.css` 唯一变量 `--mesa-menu-category-rail-page-h` + class `.mesa-menu-category-rail-page`；shell `items-start`、栏 `self-start`。
- **文件：** `globals.css`、`customer-menu-chrome-layout.ts` / `.test.ts`、`CustomerStorefrontMenuPreview.tsx`
- **角色 / 页面：** 客人扫码点餐（有店面）；店面预览；demo pane

## 2. 核心业务规则

1. 【本次新增】page 左栏高度唯一写法：CSS `--mesa-menu-category-rail-page-h` / `.mesa-menu-category-rail-page`。
2. 【本次新增】左边类别可独立滚到底；最后一项在底栏上方。
3. 【已实现】右边仍跟外层店面滚动；pane 模式不变。

## 3. 详细测试场景与结果

### 场景 1：构建 CSS 含高度规则

- **结果：** 【已验证】**pass** — `.next-uat/static/css/app/layout.css` 含 `--mesa-menu-category-rail-page-h` 与 `.mesa-menu-category-rail-page { height; max-height }`

### 场景 2：有店面带 — 左栏独立滚到底且不压底栏

- **结果：** 【已验证】**pass** — `:3004` 白云菜单：`sticky` / height 574 / `overflow-y:auto` / `self-start`；可滚；rail 底 671 ≤ dock 顶 677；`obscuredPx=0`；矮于右边 catalog

### 场景 3：demo pane 不回归

- **结果：** 【已验证】**pass** — `/demo/menu` 为 pane（无 `mesa-menu-category-rail-page`）；左右 overflow-y auto

### 场景 4：预览共用同一套 class

- **结果：** 【已验证】**pass** — `/preview/storefront-menu` nav 含 `mesa-menu-category-rail-page`，sticky + overflow-y auto

## 4. 实际测试结果汇总

| 项 | 结果 |
|---|---|
| unit | pass |
| CSS 产物命中 | 【已验证】pass |
| 场景 2–4 | 【已验证】pass |
| 寿司页 | 【未验证】同组件 |

## 5. 风险与待确认

- 顶栏 6.5rem：【待核实】极高安全区。
