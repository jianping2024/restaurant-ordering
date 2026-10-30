# 本次改动业务场景测试报告 · 后厨备注展示

日期：2026-10-30  
分支：`fix/kitchen-note-placement`  
UAT 基址：`http://localhost:3008`（feature worktree，非 `:3000`）

## 1. 本次修改

- **内容**：有备注时，列表行主标题与备注分行；备餐卡备注用独立条（标签 + 正文）。无备注仍单行。分组仍按菜 + 备注。
- **文件**：`KitchenLineNote.tsx`（sole）、`KitchenStationPane.tsx`、`KitchenPrepTray.tsx`、`kitchen-screen-labels.ts`（`noteLabel`）、`globals.css`、`station-kitchen-screens.zh.md`、`agent-sole-index.zh.md`、静态稿 `docs/design/mockups/2026-10-30-kitchen-prep-note-placement.static.html`
- **角色 / 页面**：后厨大屏列表 + 备餐区；演示页 `/demo/kitchen`
- **流程**：下单带备注 → 大屏可见 → 勾选进备餐区仍可见 → 备餐（行为不变）

## 2. 核心业务规则

1. 【已实现】备注身份 sole `lineNoteKey` / `prepTrayCardKey`：同菜同备注叠卡；不同备注（含空 vs 有）拆卡。
2. 【本次新增】备注 UI sole `KitchenLineNote`：`row` = 标题下第二行；`tray` = 独立条 + `noteLabel`。禁止与菜名共抢同一行 `truncate`。
3. 【已实现】无备注不占第二行 / 不渲染条。
4. 【已实现】备餐提交语义不变；本改动只改展示。

## 3. 详细测试场景

### 场景 1：演示页有备注行 — 列表第二行可见

- **前置状态**：打开 `http://localhost:3008/demo/kitchen`；演示单含 `Less salt` / `No onion`。
- **操作过程**：后厨看按桌列表，找带备注的菜行。
- **预期结果**：菜名单独一行截断；其下琥珀字为完整备注（不被长菜名吃掉）。
- **数据验证**：演示数据不变；仅 DOM 结构变。
- **异常恢复**：不适用。
- **标签**：【本次新增】【已验证】

### 场景 2：勾选进备餐区 — 独立备注条

- **前置状态**：场景 1 页面；勾选一条有备注的待备行。
- **操作过程**：勾选 Bacalhau；看右侧备餐卡。
- **预期结果**：菜名单独；其下有浅金底条，含「备注」+ `Less salt`。
- **数据验证**：卡仍按菜+备注身份。
- **异常恢复**：取消勾选后卡离区。
- **标签**：【本次新增】【已验证】

### 场景 3：无备注行 — 不占第二行

- **前置状态**：演示页待备列表当前仅有带备注菜（Bacalhau）。
- **操作过程**：代码检视 `KitchenLineNote`：空串 → `null`；演示 UI 无空白备注行可点。
- **预期结果**：无备注不渲染第二行 / 备餐条。
- **标签**：【本次新增】代码路径【已验证】；演示待备无无备注行 → UI【未验证】

### 场景 4：按菜视图 L2 — 桌号下第二行备注

- **前置状态**：演示页热菜切「按菜」；展开 Bacalhau。
- **操作过程**：看 L2。
- **预期结果**：第一行「5 桌」；第二行 `Less salt`。
- **标签**：【本次新增】【已验证】

### 场景 5：同菜不同备注拆卡（回归分组）

- **前置状态**：单测 `kitchen-board-lines.test.ts`。
- **操作过程**：`npx tsx --test …` → 18 pass（含 note split）。
- **预期结果**：拆卡规则未改。
- **标签**：【已实现】【已验证】

### 场景 6：栈健康 + 登录（门禁）

- **前置状态**：本机 Docker Supabase + `:3008` web。
- **操作过程**：`mesa-local-uat stack-health`、`login --role owner`（luckytea）。
- **预期结果**：exit=0。
- **标签**：【已验证】

### 场景 7：回归 — 备餐区与待取轨备注

- **前置状态**：勾选后有备餐区；打开「已备餐/已出餐」。
- **操作过程**：确认备餐按钮在区尾；待取轨 Polvo 行第二行 `No onion`。
- **预期结果**：展示改动不挡备餐入口；待取轨同样分行。
- **标签**：回归【已验证】（备餐按钮可见可点；未在 demo 真提交出单）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health / login / demo 200 | pass |
| 列表第二行 Less salt | pass【已验证】 |
| 备餐卡「备注」+ Less salt | pass【已验证】 |
| 按菜 L2 | pass【已验证】 |
| 待取轨 No onion | pass【已验证】 |
| 无备注 UI 行 | 【未验证】（演示缺无备注待备行） |
| kitchen-board-lines 单测 | pass 18 |
| UAT 基址 | `http://localhost:3008` |

## 5. 风险与待确认

- 列表超长备注仍单行截断；备餐卡可折行。
- 演示缺无备注待备行，空备注 UI 未在浏览器点到。
