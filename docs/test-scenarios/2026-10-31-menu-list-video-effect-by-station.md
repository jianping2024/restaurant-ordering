# 本次改动业务场景测试报告：菜品列表动图效果名贴出品档口

## 1. 本次修改

- **内容：** 后台菜品列表的动图效果名，从菜名行挪到元信息行：紧挨「出品档口: 档口名」右侧；没有出品档口时跟在「类型」后面。样式改为淡边框 + 灰色字，不抢菜名/价格。缩略图 ▶ 的 a11y/title 仍用同一效果名。
- **文件：** `apps/web/src/components/dashboard/MenuManager.tsx`、`docs/agent-sole-index.zh.md`、本场景文档。
- **角色 / 页面：** 店主 · 后台「菜单 → 菜品」列表。
- **UAT 基址：** `http://localhost:3003`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 2. 核心业务规则

1. 【已实现】列表效果文案唯一：`menuItemDishVideoListEffectLabelKey`（有 `video_url` + 合法 `video_effect` 才有文案）。
2. 【本次新增】可见效果芯片**只有一处**：元信息行，出品档口右侧（无档口则类型后）；菜名行不再挂效果芯片。
3. 【本次新增】芯片不用金色抢眼样式。
4. 【已实现】缩略图 ▶ 与芯片共用同一效果名；无动图不显示。
5. 【已实现】须店有 Pro 菜品动图能力（`dishVideoPro`）才显示列表效果名。

## 3. 详细测试场景

### 场景 1：有出品档口的菜，效果名贴在档口后

- **前置状态：** 白云 Pro 动图已开；Le coq 分类下鸡尾酒有动图与档口 `shousi`。
- **操作过程：** `baiyun@gmail.com` 登录 → Menu → Pratos → 筛 Le coq。
- **预期结果：** 元信息顺序为 `Categoria → Talao de estacao: shousi → Bolhas/Aproximar/Vapor`；菜名行无效果芯片；档口与芯片间距约 `ml-1`（实测约 4px）。
- **数据验证：** 仅布局；不动库。
- **异常恢复：** 不适用。

### 场景 2：无出品档口时效果名跟在类型后

- **前置状态：** 有动图且无有效出品档口的菜。
- **操作过程：** 列表看该行元信息。
- **预期结果：** 效果名在类型段之后、时段（若有）之前。

### 场景 3：无动图不显示效果名

- **前置状态：** 搜「Caixa」（包装盒类，无 `video_url`）。
- **操作过程：** 看列表行。
- **预期结果：** 元信息无 Bolhas 等芯片；无 ▶。

### 场景 4：缩略图 ▶ 仍带效果名

- **前置状态：** Le coq 有动图菜。
- **操作过程：** 读缩略图 a11y（`image "Bolhas"` 等）。
- **预期结果：** ▶ 的 aria/description 为效果名，与元信息芯片一致。

### 场景 5：回归 — 价格/开关/编辑仍在右侧操作区

- **前置状态：** 任意有动图行。
- **操作过程：** 看右侧 €、IVA、上下架、Editar/Eliminar。
- **预期结果：** 操作区正常；效果名为灰色淡边，非金色。

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 贴档口 | 【已验证】 | pass — a11y 顺序 + `gapPx≈4`；Le coq 多行 Bolhas/Aproximar/Vapor |
| 2 无档口 | 【未验证】 | 本地库暂无「有动图且无档口」样本；代码路径：无 `stationName` 时芯片仍插在类型后、时段前 |
| 3 无动图 | 【已验证】 | pass — Caixa 行无效果芯片、无 ▶ |
| 4 缩略图 ▶ | 【已验证】 | pass — `image "Bolhas"` / `Aproximar` / `Vapor` |
| 5 回归操作区 | 【已验证】 | pass — € / IVA / 开关 / Editar 仍在右侧 |

API：`stack-health`、owner 登录、`/api/health/live`、`/api/restaurant/features`（`menu_dish_video_enabled=true`）均 exit=0。

## 5. 风险与待确认

- 场景 2 缺样本 → 合入后若出现无档口有动图菜，人工再看一眼即可。
- 元信息极长 truncate 可能裁到芯片 → 本次宽屏 Le coq 未触发。
