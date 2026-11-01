# 本次改动业务场景测试报告 · 无 Pro 时隐藏「生成菜品动图」角色勾选

日期：2026-11-01  
分支：`feat/hide-dish-video-role-perm-without-pro`  
UAT 基址：`http://localhost:3012`（功能 worktree，非 `:3000`）

## 1. 本次修改

- **内容**：角色权限编辑页在餐厅未开通 Pro「菜品动图」时，不显示「生成菜品动图」勾选；开通后显示。保存时若该项因无 Pro 被藏，且角色库里已勾、菜单管理父项仍在，则保留该勾选，不洗掉。文档纠正：全开的是**超级管理员**（`owner_id`），不是「店主」员工角色。
- **文件**：`registry.ts`（`premiumKey`）、`permission-premium-visibility.ts`、角色页 / `RolesPermissionsManager`、`PATCH /api/dashboard/roles/[id]`、角色权限指南、`agent-sole-index`
- **角色 / 页面**：餐厅设置 → 角色权限；影响菜单页生成动图的前置勾选可见性

## 2. 核心业务规则

1. 【本次新增】无有效 Pro `menu_dish_video` → 角色树隐藏 `dashboard.menu.video.manage`。
2. 【已实现】有 Pro → 显示；默认角色模板仍不含该项。
3. 【本次新增】无 Pro 保存权限列表时：库里已有且父项 `dashboard.menu.view` 仍勾 → 保留 `video.manage`；父项已去掉 → 不保留。
4. 【已实现】超级管理员能力恒为全开；「店主」员工角色只看勾选。
5. 【已实现】真正生成动图仍要 Pro × `video.manage`（本改不动该门禁）。

## 3. 详细测试场景

### 场景 1：有 Pro 的店 — 角色页能看到「生成菜品动图」

- **前置状态**：Washoku（`lucky-tea-mulcs62n`）plan=pro 且有 `menu_dish_video` 授权；超级管理员 `luckytea@gmail.com`
- **操作过程**：登录 → 打开 `/dashboard/settings/roles`（RSC 载荷核对 `hiddenPermissionKeys`）
- **预期结果**：`hiddenPermissionKeys` 为 `[]`（勾选树会显示「生成菜品动图」）
- **数据验证**：RSC 含 `hiddenPermissionKeys":[]`
- **异常恢复**：不适用

### 场景 2：无 Pro 的店 — 角色页看不到「生成菜品动图」

- **前置状态**：同一店临时去掉 `menu_dish_video` / `menu_dish_list_video` 授权（测完恢复）
- **操作过程**：再拉 `/dashboard/settings/roles` RSC
- **预期结果**：`hiddenPermissionKeys":["dashboard.menu.video.manage"]`
- **数据验证**：RSC 片段已核对
- **异常恢复**：测完插回两条 Pro 授权

### 场景 3：无 Pro 时 PATCH 省略 video.manage — 库中原勾选保留

- **前置状态**：无 Pro；「管理员」角色已含 `dashboard.menu.view` + `dashboard.menu.video.manage`
- **操作过程**：`PATCH /api/dashboard/roles/:id` 提交权限列表故意省略 `video.manage`（仍含 `menu.view`）
- **预期结果**：响应 permissions 仍含 `dashboard.menu.video.manage`
- **数据验证**：API 响应含该 key
- **异常恢复**：最终恢复角色 permissions 快照

### 场景 4：无 Pro 时撤销菜单管理 — video.manage 一并去掉

- **前置状态**：无 Pro；角色有 `menu.view` + `video.manage`
- **操作过程**：PATCH 去掉所有 `dashboard.menu.*`
- **预期结果**：库中 `has_video=f`、`has_menu=f`
- **数据验证**：SQL 核对
- **异常恢复**：恢复角色 + Pro 授权

### 场景 5：回归 — 有 Pro 店菜单页生成动图门禁未改坏

- **前置状态**：Pro 授权已恢复；超级管理员登录
- **操作过程**：打开 `/dashboard/menu` RSC
- **预期结果**：`canManageDishVideo:true`、`dishVideoPro:true`
- **数据验证**：RSC 属性
- **异常恢复**：不适用

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|------|------|------|
| 1 有 Pro 隐藏列表为空 | 【已验证】 | pass — RSC `hiddenPermissionKeys":[]` |
| 2 无 Pro 隐藏 video.manage | 【已验证】 | pass — RSC `["dashboard.menu.video.manage"]` |
| 3 省略仍保留 | 【已验证】 | pass — PATCH 响应仍含 `dashboard.menu.video.manage` |
| 4 撤父项则去掉 | 【已验证】 | pass — SQL `has_video=f has_menu=f` |
| 5 菜单页仍可管理动图 | 【已验证】 | pass — `canManageDishVideo true` / `dishVideoPro true` |
| Chrome 点选勾选树 | 【未验证】 | skip — 主仓旁路分支有未提交产品改动，浏览器 MCP 门禁盯主仓指纹，无法对本 worktree 开测（未 stash 旁路 WIP） |

机器证据：`gate.sh uat-evidence`（stack-health、login、PATCH、GET menu）+ 本机 RSC/SQL。

单元：`permission-premium-visibility.test.ts` 5/5 pass。

## 5. 风险与待确认

- 增值分析等页级 Pro 权限仍一直显示（本次刻意只动动图子项）。
- 开通 Pro 后员工默认仍无生成权，须手动勾选（预期）。
- 浏览器手点勾选树本轮未跑；RSC 已证明服务端传入的隐藏列表正确，客户端用同一 `filterPermissionTreeByHiddenKeys`。
