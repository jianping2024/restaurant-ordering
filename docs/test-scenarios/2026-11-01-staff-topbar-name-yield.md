# 本次改动业务场景测试报告 — 职员顶栏店名让宽

**日期：** 2026-11-01  
**分支：** `feat/topbar-name-yield-demo`  
**范围：** 职员顶栏（`StaffPersonalTopBar` / `ProductTopBarBrand` / `ProductTopBarRestaurantName`）店名在窄屏或放大文字时让宽；右侧 ☰ / 账号保持可点。  
**UAT base：** `http://localhost:3006`（feature · `MESA_NEXT_DIST_DIR=.next-uat-name-yield`）

---

## 1. 本次修改

- **内容：** 品牌区改为 `min-w-0 flex-1` 让宽；店名唯一拟合 `fitStaffTopBarRestaurantName`（多词从右整词丢掉 → 剩一词前缀+`…`）；唯一节点 `ProductTopBarRestaurantName`；窄屏右侧 cluster `shrink-0`，桌面 `lg:flex-1` 保留 chip 横滑。
- **文件：** `staff-topbar-restaurant-name.ts`(+test)、`ProductTopBarRestaurantName.tsx`、`ProductTopBarChrome.tsx`、`waiter-staff-sticky-chrome.ts`(+test)、`StaffPersonalTopBar.tsx`、`04-mobile-rules.md`、`agent-sole-index.zh.md`、preview `/preview/topbar-name-yield`
- **角色 / 页面：** 店主或职员登录后台任意页（如菜单管理、桌台看板）；顾客端 / 厨房不在范围。

## 2. 核心业务规则

1. 顶栏一行、不换行；FARVOO 与右侧 ☰/账号不被店名挤叠。
2. 店名空间不够时：多词从右边丢掉整词；只剩一词仍宽 → 显示前缀 + `…`；无空格中文当一词。
3. 完整店名仍可通过 `title` 看到（属性为原名）。
4. 不改变登录、选店、权限；仅顶栏布局与店名可见文本。

## 3. 详细测试场景

### 场景 1：宽屏完整店名

- **前置状态：** feature web `:3006`；luckytea 店主已登录 Washoku。
- **操作过程：** 桌面宽视口打开 `/dashboard/waiter`；看顶栏店名。
- **预期结果：** 显示完整 `Washoku Sushi`；右侧账号可见。
- **数据验证：** 不写库。
- **标签：** 【本次新增】· 【已验证】宽屏登录后 a11y 见完整店名

### 场景 2：窄屏 320，店名让宽且不叠字

- **前置状态：** 同场景 1；Chrome 模拟 `320×720` mobile。
- **操作过程：** 打开 waiter；量测店名与 ☰/账号矩形；截图顶栏。
- **预期结果：** 显示 `Wash…`（title 仍为 `Washoku Sushi`）；与 ☰、账号无水平重叠；单行。
- **数据验证：** `overlapNameAccount=false`，`overlapNameNav=false`，`fittedText=Wash…`。
- **标签：** 【本次新增】· 【已验证】

### 场景 3：多词店名从右减词（算法）

- **前置状态：** 单元测。
- **操作过程：** `Washoku Sushi Bar` 递减名宽。
- **预期结果：** 先丢 `Bar`，再丢 `Sushi`，再截一词。
- **标签：** 【本次新增】· 【已验证】unit pass

### 场景 4：长中文无空格直接省略

- **前置状态：** 单元测。
- **操作过程：** `白云自助火锅店总店` 窄预算拟合。
- **预期结果：** 前缀 + `…`；mode=ellipsis。
- **标签：** 【本次新增】· 【已验证】unit pass

### 场景 5：回归 — 顶栏仍可进账号菜单

- **前置状态：** 320 视口；已登录。
- **操作过程：** 点「Administrador」账号按钮。
- **预期结果：** `aria-expanded=true`；菜单出现（改密/退出等）。
- **标签：** 【已实现】回归 · 【已验证】

### 场景 6：不适用项

- 多用户并发 / 收款锁定 / Realtime：纯展示布局，不适用。
- 顾客端顶栏：不使用 `StaffPersonalTopBar`，不适用。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 场景 1 宽屏完整店名 | 【已验证】pass |
| 场景 2 窄屏不叠字 | 【已验证】pass（320 · `Wash…` · 无重叠） |
| 场景 3 多词减词（单元） | 【已验证】pass |
| 场景 4 中文省略（单元） | 【已验证】pass |
| 场景 5 回归账号菜单 | 【已验证】pass |
| mesa-local-uat stack-health / login / health / menu | 【已验证】pass（`:3006`） |
| chrome 契约单元 | 【已验证】pass |

## 5. 风险与待确认

- 根字号被整页改到极大时，店名槽可能被压到 0（只剩 `…` 或空）：极端人工改 `html` font-size，非 iOS 常规「文字放大」路径；产品可接受优先保 ☰/账号。
- preview 页仅演示，非正式入口。
