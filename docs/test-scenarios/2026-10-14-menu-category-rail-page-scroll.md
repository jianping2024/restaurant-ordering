# 本次改动业务场景测试报告：客人菜单左边类别栏（店面带 page 滚动）

日期：2026-10-14  
分支：`fix/menu-category-rail-page-scroll-height`  
UAT base：`http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容：** 有店面介绍时，左边类别栏高度只按屏幕算（`self-start` + 视口 `max-h`），不再被右边菜品列拉高；设置预览与真机共用同一套 class。
- **文件：** `customer-menu-chrome-layout.ts` / `.test.ts`、`CustomerStorefrontMenuPreview.tsx`
- **角色 / 页面：** 客人扫码点餐（有店面资料）；`/preview/storefront-menu`；demo/员工嵌入（pane）

## 2. 核心业务规则

1. 【本次新增】有店面带 → `scrollMode=page`：左边类别滚动范围 = 类别条数 vs 屏幕高度，**与右边菜品列表多高无关**。
2. 【已实现】无店面带 / demo → `scrollMode=pane`：左右各滚各的（不变）。
3. 【已实现】店面介绍仍可先被外层滚走；左边栏 sticky 贴顶。
4. 【本次新增】page 左栏高度唯一写法：`customerMenuCategoryRailPageScrollClass`；shell 唯一：`customerMenuCategoryNavShellPageScrollClass`。预览不得手写第二套。

## 3. 详细测试场景

### 场景 1：有店面带 — 左边类别可独立滚到底

- **前置状态：** 白云 `restaurant-mohnrib5` 客人菜单（有店面资料）；左栏类别可超出视口。
- **操作过程：** 打开 `…/menu?table_id=A-01`；量左栏 vs 右栏高度；在左栏内滚动（类别不足时注入按钮模拟）。
- **预期结果：** 左栏高度约视口、短于右栏总高；左栏 `scrollTop` 可增大。
- **数据验证：** `align-self:flex-start`、`items-start`、含 `self-start`/`max-h-[calc(100dvh-6.5rem)]`。
- **异常恢复：** 刷新后 class 仍在。

### 场景 2：有店面带 — 右边仍跟整页滚

- **前置状态：** 同场景 1。
- **操作过程：** 滚动 `[data-mesa-storefront-menu-scroll]`。
- **预期结果：** 外层 `scrollTop` 可增大（店面+菜品一起滚）。
- **数据验证：** 无写库。
- **异常恢复：** 滚回顶。

### 场景 3：无店面带 / pane — 左右独立滚不回归

- **前置状态：** `/demo/menu`（无店面带）。
- **操作过程：** 检查左右 overflow。
- **预期结果：** `mode=pane`；左右均为 `overflow-y: auto`。
- **数据验证：** 无写库。
- **异常恢复：** 不适用。

### 场景 4：店面预览与真机同一高度合同

- **前置状态：** `/preview/storefront-menu`。
- **操作过程：** 检查 class 与独立滚动。
- **预期结果：** 与真机同一套 page rail/shell tokens；左栏可独立滚。
- **数据验证：** DOM 含 `self-start` / `items-start` / `max-h`。
- **异常恢复：** 不适用。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| `mesa-local-uat stack-health`（MESA_UAT_BASE=:3002） | **pass**（web+supabase ready；ops soft missing） |
| `customer-menu-chrome-layout.test.ts` | **pass**（6/6） |
| `gate.sh check` lint+typecheck | **pass** |
| 场景 1 白云客人页左栏独立滚 | 【已验证】**pass** — railH=630 vs shell/catalog=1982；注入类别后 scrollTop 0→1461 |
| 场景 2 外层仍可滚 | 【已验证】**pass** — outer scrollTop→400 |
| 场景 3 demo pane | 【已验证】**pass** — pane + 双 overflow-y auto |
| 场景 4 预览共用 token | 【已验证】**pass** — self-start/items-start/max-h；独立滚 |
| 寿司页同样 page 合同 | 【未验证】— 与经典共用 `CustomerMenuCategoryNav`，未另开寿司 URL |

## 5. 风险与待确认

- `100dvh-6.5rem` 顶栏预算在极高安全区机型：【待核实】非本次引入。
- 寿司页：【未验证】代码路径相同，残余风险低。
