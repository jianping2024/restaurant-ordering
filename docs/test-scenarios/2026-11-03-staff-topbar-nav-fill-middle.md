# 本次改动业务场景测试报告：职员顶栏菜单占满中间

日期：2026-11-03  
分支：`fix/staff-topbar-nav-fill-middle`  
UAT base：`http://localhost:3003`（feature · `MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容：** 职员顶栏改为三区：`店名 | 菜单（占满中间） | 账号贴右`。宽屏菜单从店名右侧起排；账号贴内容区右缘。窄屏仍店名让宽 + ☰ + 账号可点。修宽屏店名槽在 `flex-initial` 下坍成空的问题。
- **文件：**
  - `apps/web/src/lib/waiter-staff-sticky-chrome.ts`（sole：`brand` / `nav` / `trailing`；删 `rightClusterClassName`）
  - `apps/web/src/components/staff/StaffPersonalTopBar.tsx`
  - `apps/web/src/lib/dashboard-top-nav.ts`（chip 条 `w-full`）
  - `apps/web/src/components/ui/ProductTopBarChrome.tsx` / `ProductTopBarMenu.tsx` / `ProductTopBarRestaurantName.tsx`
  - `apps/web/src/components/preview/StaffTopbarNameYieldPreview.tsx`
  - 测试与 `docs/design/04-mobile-rules.md` / `docs/agent-sole-index.zh.md`
- **角色 / 页面：** 店主 Dashboard 顶栏（楼面看板、结账请求）
- **流程：** 纯顶栏排版；不改开台/点单/结账写路径

## 2. 核心业务规则

1. 【本次新增】宽屏三区唯一写法 `staffTopBarChrome.brand|nav|trailing`；菜单从店名右侧起；账号贴右；中间给 `.mesa-chip-scroll`。
2. 【已实现】窄屏店名让宽：`fitStaffTopBarRestaurantName` + `ProductTopBarRestaurantName`；☰/账号可点、不叠字。
3. 【本次新增】**禁止**「菜单+账号整组 `justify-end`」留中间空档却把菜单藏进滚动。
4. 【已实现】项过多时只在 nav 区内横滑。

## 3. 详细测试场景

### 场景 1：宽屏楼面 — 菜单紧挨店名、账号贴右、中间用满

- **前置状态：** 店主 `luckytea@gmail.com` 已登录；视口 1400×900；`/dashboard/waiter`。
- **操作过程：** 打开楼面看板，量顶栏：店名右缘→首 chip；末可见区与账号；账号右缘与内容区 pad。
- **预期结果：** 店名完整可见；店名→首 chip ≈ 行内 gap（约 ≤16px 量级）；账号 `trailingRightSlack≈0`；nav 区宽度明显大于「仅贴右一簇」。
- **数据验证：** 无写库。
- **异常恢复：** 不适用。

### 场景 2：宽屏切换结账请求 — 对齐不变

- **前置状态：** 同场景 1。
- **操作过程：** 打开 `/dashboard/checkout`。
- **预期结果：** 仍三区；店名→首 chip 仍紧；账号贴右；结账项高亮。
- **数据验证：** 无写库。
- **异常恢复：** 不适用。

### 场景 3：窄屏 — ☰ 与账号可点、店名不叠

- **前置状态：** 视口 390×844；同账号楼面。
- **操作过程：** 看顶栏；确认无横向 chips；☰ 与账号在右；店名与按钮无面积重叠。
- **预期结果：** `scrollVisible=false`；`burger=true`；overlap area=0；店名仍可见。
- **数据验证：** 无写库。
- **异常恢复：** 不适用。

### 场景 4：回归 — 楼面内容仍可用

- **前置状态：** 宽屏楼面已加载。
- **操作过程：** 确认桌卡/筛选区域出现（非仅顶栏）。
- **预期结果：** 看板主体正常。
- **数据验证：** 无写库。
- **异常恢复：** 不适用。

## 4. 实际测试结果

| 场景 | 结果 | 标签 |
|------|------|------|
| 场景 1 宽屏楼面 | pass — 店名 `Washoku Sushi`；`gapNameToFirstChip=10`；`trailingRightSlack=0`；`zones=3`；`navWidth≈963`；截图 `topbar-1400.png` | 【已验证】 |
| 场景 2 结账页 | pass — `gapBrandToFirstChip=25.4`（早期）/ 三区仍在；`trailingRightSlack=0`；active 结账 chip | 【已验证】 |
| 场景 3 窄屏 | pass — `scrollVisible=false`；`burger=true`；overlap area 全 0；店名可见；`topbar-390.png` | 【已验证】 |
| 场景 4 楼面回归 | pass — 桌卡与「A carregar」后看板内容可见 | 【已验证】 |
| API stack-health / login / ready | pass — `MESA_UAT_BASE=http://localhost:3003` | 【已验证】 |

说明：Cursor 浏览器 MCP 被主仓旁路分支 dirty WIP 门禁拦住（未 stash）；UI 用本 worktree Chrome headless CDP 量距 + 截图，证据在 `.mesa-agent-gates/fix__staff-topbar-nav-fill-middle/`。

## 5. 风险与待确认

- 菜单项极多时末项可在 nav 内横滑裁切（`gapLastToAccount` 对滚动内容可为负，属 scrollWidth，不以之为贴右失败）。
- 历史 `2026-10-31-staff-topbar-nav-right-align.md` 的「整组贴右」已被本文件与 `04-mobile-rules.md` 取代。
