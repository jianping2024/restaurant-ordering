# 本次改动业务场景测试报告：批量动图进度可见 + 列表效果名

日期：2026-10-31  
分支：`fix/dish-video-batch-progress-ui`  
UAT 基座：`http://localhost:3003`（`MESA_NEXT_DIST_DIR=.next-uat-progress`）  
设计图：`docs/design/mockups/2026-10-31-dish-video-batch-progress.html`

## 1. 本次修改

- **内容：**
  1. 批量生成动图时，工具栏显示转圈 +「生成动图 {done}/{total}…」（等宽数字位）+ 细进度条；不再用 `Button.loading` 藏字。
  2. 菜品列表有动图时显示效果名（`DISH_VIDEO_EFFECT_MESSAGE_KEYS`）；缩略图 ▶ 的 a11y/title 用同一效果名；去掉笼统「有动图」。
- **文件：** `MenuManager.tsx`、`menu-dish-video.ts`（+ test）、`MenuItemListThumb.tsx`、`messages.ts`、`docs/agent-sole-index.zh.md`、设计图、`tsconfig.json`（排除 `.next-uat-progress`）。
- **角色 / 页面：** 有动图管理权限的店主；菜单管理 · 菜品（白云 `restaurant-mohnrib5`）。

## 2. 核心业务规则

1. 【本次新增】【已实现】跑批进度唯一 UI：Spinner + `dishVideoBatchRunning`（经 `splitDishVideoBatchRunningTemplate` 定宽）+ 细条；不用 `loading` 藏字。
2. 【本次新增】【已实现】`done` = 已处理道数（成功+失败），每道结束后更新。
3. 【本次新增】【已实现】列表动图文案唯一：`menuItemDishVideoListEffectLabelKey` → 效果名；无 `video_url` 或非法 `video_effect` → 不显示。
4. 【已实现】批量候选/编码/写入路径不变（串行 `encodeDishVideos` + `setMenuItemImageClient`）。

## 3. 详细测试场景

### 场景 1：跑批时工具栏可见数字与进度条

- **前置状态：** 白云店主；菜品 Tab；BEBIDAS 筛选；002/003 有图无动图（API `strip_video`）；浏览器支持编码
- **操作过程：** 打开批量面板 → 默认勾选 2 道 → 效果 Aproximar → 点「Gerar (2)」
- **预期结果：** 工具栏出现转圈 +「A gerar n/m…」数字可见；下方细条变长；不是只有空转圈框
- **数据验证：** 成功后文案「Vídeos gerados para 2 pratos (efeito: Aproximar)」；002 行出现 Aproximar 芯片
- **异常恢复：** 跑完批量入口消失（无可选）
- **标签：** 【已验证】

### 场景 2：数字进位布局不抖

- **前置状态：** 单测
- **操作过程：** `splitDishVideoBatchRunningTemplate`；digitSlots = `String(total).length`
- **预期结果：** done/total 槽位宽度固定
- **标签：** 【已验证】单测

### 场景 3：列表显示效果名

- **前置状态：** Le coq / BEBIDAS 列表中已有动图行
- **操作过程：** 看行：缩略图 ▶ a11y 为效果名；菜名旁金色芯片为 Bolhas / Aproximar / Vapor
- **预期结果：** 无「有动图」四字；无动图行无芯片、无 ▶
- **标签：** 【已验证】

### 场景 4：非法/缺失 effect 不瞎标

- **前置状态：** 单测
- **操作过程：** `menuItemDishVideoListEffectLabelKey` 边界
- **预期结果：** 无 video / 非法 effect → null
- **标签：** 【已验证】单测

### 场景 5：回归 — 批量面板与编辑芯片

- **前置状态：** 有候选时可开面板；打开一道有图的编辑
- **操作过程：** 面板仍可选效果；编辑页「Editar prato」内效果芯片 Aproximar（pressed）/ Vapor / Bolhas 仍在
- **预期结果：** 文案仍走 `DISH_VIDEO_EFFECT_MESSAGE_KEYS`
- **标签：** 【已验证】

## 4. 实际测试结果

| 场景 | 结果 | 说明 |
|---|---|---|
| 1 进度可见 | 【已验证】pass | DOM 采样：`A gerar 0/2…` width 0% → `1/2…` 50%；完成后成功文案 |
| 2 等宽数字 | 【已验证】pass | `menu-dish-video.test.ts` |
| 3 列表效果名 | 【已验证】pass | Le coq：Bolhas/Aproximar/Vapor；跑批后 002 Aproximar |
| 4 边界 | 【已验证】pass | 单测 |
| 5 回归面板/编辑 | 【已验证】pass | 面板 Gerar (2)；编辑芯片三效果 |
| 单元测试 | 【已验证】pass | 14/14 |
| mesa-local-uat | 【已验证】pass | stack-health + login + health（见 gate `uat.md` 证据） |
| 清冗余 | 【已验证】 | 已删 `dishVideoBadge`；无第二套进度/`loading` 藏字 |

## 5. 风险与待确认

- 分页 / 多端互斥：本需求明确不做。
- 跑批极快时肉眼可能只看到完成文案；本报告以 50ms 采样证实进度控件曾出现并递增。
