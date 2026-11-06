# 编辑菜品打开时不默认生成动图

日期：2026-11-06  
分支：`fix/dish-edit-no-auto-video`  
UAT base：`http://localhost:3002`（feature worktree + `.next-uat`）

## 本次修改

- 内容：打开编辑菜品时，有图无动图不再自动浏览器编码；无已存特效时芯片默认「不生成」。编码仅换图 / 点特效时触发。
- 文件：`apps/web/src/components/dashboard/MenuItemPhotoField.tsx`、`docs/agent-sole-index.zh.md`
- 角色：店主 / 有 `dashboard.menu.video.manage` 的员工
- 页面：`/dashboard/menu` 菜品编辑弹层

## 核心业务规则

1. 【本次新增】打开编辑：有合法 `video_effect` → 回显该特效与已有视频，不重编。
2. 【本次新增】打开编辑：无合法特效 → 芯片「不生成」，不发起编码。
3. 【已实现】用户点特效（非「不生成」）或换图且特效非「不生成」→ `regenerate`。
4. 【已实现】直接保存且未生成新视频 → 不写入新动图；有图无视频保持无视频。
5. 【已实现】批量「生成动图」面板默认效果仍为 `push`（本改动未动）。

## 详细测试场景

### 场景 1：有图无动图 — 打开不自动生成

- **前置状态：** 白云 owner；「冰Vitalis 750ml」临时清空 `video_url`；Pro 菜品动图开；有动图管理权限
- **操作过程：** 登录 → Menu → Pratos → 搜 Vitalis → Editar
- **预期结果：** 芯片「Nenhum」选中；文案「Sem vídeo…」；无「A gerar…」/「Vídeo pronto」
- **数据验证：** 打开期间不发起编码
- **异常恢复：** 取消关闭弹层，列表仍可编辑
- **结果：** 【已验证】pass

### 场景 2：有图无动图 — 点特效才编码

- **前置状态：** 同场景 1，编辑弹层已开
- **操作过程：** 点「Aproximar」（推进）
- **预期结果：** 「Vídeo pronto · …KB」；预览出现 video
- **数据验证：** 取消后库仍无 `video_url`
- **结果：** 【已验证】pass（编完取消，库未写入）

### 场景 3：已有动图 — 打开回显不重编

- **前置状态：** 「Blue Lagoonx」有 `video_url` + `video_effect=bubbles`
- **操作过程：** 搜并 Editar
- **预期结果：** 「Bolhas」选中；状态「Tem vídeo animado」；无生成中
- **结果：** 【已验证】pass

### 场景 4：有图无动图 — 直接保存不写入动图

- **前置状态：** Vitalis Frio 仍无视频；打开编辑（Nenhum）
- **操作过程：** 不改特效 → Guardar
- **预期结果：** 保存成功；`video_url` 仍为空
- **结果：** 【已验证】pass（测后已恢复该菜动图 `push`）

### 场景 5：批量面板默认（回归）

- **前置：** 全部菜品筛选时出现「▶ Gerar vídeos (1)」
- **预期：** 按钮仍出现；本改动未改批量默认 `push`
- **结果：** 【已验证】pass（UI 见 Gerar vídeos (1)；未点开改效果）

## 实际测试结果

| 项 | 结果 |
|---|---|
| mesa-local-uat stack-health / login / health/live / features | pass |
| UI 场景 1–5 | pass |
| 清冗余 scan | pass（删挂载自动编；`DEFAULT_DISH_VIDEO_EFFECT` 仅异常行 + 批量用） |
| Vitalis 动图测后恢复 | pass（`video_effect=push`） |

## 风险与待确认

- 有 `video_url` 但 `video_effect` 非法的异常行：打开时芯片用默认「推进」，避免误清动图；正常数据三列同写，此路径少见。
