# 本次改动业务场景测试报告：顾客菜单底部弹层限高

**日期：** 2026-10-24  
**分支：** `fix/customer-menu-bottom-sheet-viewport`  
**基座：** `MESA_UAT_BASE=http://localhost:3003`（feature worktree；非 `:3000`）  
**店：** Washoku Sushi `lucky-tea-mulcs62n` · 桌 A-02

## 1. 本次修改

- **内容：** 购物车 / 已点 / 本轮核单共用底部弹层：整卡最高一屏（`100dvh`），标题与关闭钉顶，合计/按钮钉底，仅中间列表滚动。去掉「只限中间 60vh、整卡不限高」。
- **文件：** `customer-menu-bottom-sheet-layout.ts`（【本次新增】sole token）、`CustomerMenuBottomSheet.tsx`、对应测试、`package.json` test:unit、`agent-sole-index.zh.md`、本报告。
- **角色 / 页面：** 顾客扫码菜单。

## 2. 核心业务规则

1. 弹层打开时标题、清空（若有）、关闭 ✕ 必须在可视区内。【本次新增】【已验证】
2. 菜再多只在中间列表滚；背后菜单仍被 scroll lock。【已实现】+【本次新增】【已验证】
3. ✕ 或灰底可关。【已实现】【已验证】
4. 三抽屉共用一套高度算法。【本次新增】【已验证】（代码 sole + 购物车 UI）

## 3. 详细测试场景

### 场景 1：多道菜打开购物车 — 顶栏仍在、列表可滚、可关

- **前置状态：** A-02 已开台；顾客端加 ≥5 道免费菜进购物车。
- **操作过程：** 点「Ver carrinho」→ 量顶栏与整卡高度 → 滚中间列表 → 点 ✕ → 再开后点灰底。
- **预期结果：** 标题「Carrinho」与 ✕ 在屏内；整卡 ≤ 视口；可滚；✕/灰底可关。
- **数据验证：** 仅本地草稿。
- **标签：** 【已验证】pass（DevTools：`fitsViewport` / `titleVisible` / `closeVisible` / `canScroll` / `closedByX` / `closedByBackdrop`）

### 场景 2：短列表 — 不把顶栏顶没

- **前置状态：** 购物车有货时整卡限高合同仍成立（`maxHeight=667px`）。
- **操作过程：** 同场景 1 打开态观察。
- **预期结果：** 顶栏可见，非整卡无限长。
- **标签：** 【已验证】pass（与场景 1 同次测量）

### 场景 3：点灰底关闭

- **标签：** 【已验证】pass（`closedByBackdrop=true`）

### 场景 4：已点弹层

- **操作过程：** 本轮 UAT 未稳定点到「已点」footer 按钮。
- **标签：** 【未验证】UI；外壳与购物车同一 `CustomerMenuBottomSheet` + sole layout（代码覆盖）

### 场景 5：布局契约单测

- **标签：** 【已验证】pass（`customer-menu-bottom-sheet-layout.test.ts` exit=0）

### 场景 6：系统返回关弹层

- **标签：** 【未验证】（本轮不做；【设计建议】未实现 history）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| `mesa-local-uat` login + guest session | pass |
| 布局单测 | pass |
| UI 购物车限高 / 顶栏 / 关闭 | pass |
| 已点 UI | 【未验证】 |
| ops stack-health | 未作为硬门（本机 ops 未起；web+supabase 可用） |

**清冗余：** scan 已记；sole `max-h-[100dvh]`；无残留 `max-h-[60vh]`。

## 5. 风险与待确认

- 极端 iOS 地址栏显隐可用 `svh` 再收紧（当前 `dvh`）。
- 系统返回关弹层未做。
