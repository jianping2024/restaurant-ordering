# 本次改动业务场景测试报告：表单空字段提示色（brand-placeholder）

日期：2026-10-30  
分支：`fix/form-placeholder-token`  
UAT 基址：`http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容**：空字段示例字与已输入正文分开配色；全站共用令牌 `--color-brand-placeholder` 与 class `FORM_CONTROL_PLACEHOLDER_CLASS`（`placeholder:text-brand-placeholder`）。react-select 用同一 CSS 变量。收掉原先 `placeholder-brand-muted` / `placeholder:text-brand-text-muted`（含透明度变体）等平行写法。
- **文件**：`globals.css`、`tailwind.config.ts`、`form-control-text.ts`、`Input`、登录/`PasswordInput`、顾客表单样式、设置相关裸控件、设计文档等。
- **角色 / 页面**：老板打开餐厅设置、登录页。
- **流程**：纯视觉；不改保存、校验、会话或结账逻辑。

## 2. 核心业务规则（不变量）

1. 【本次新增】空字段提示色只有 `brand-placeholder`；已填文字仍为 `brand-text`。
2. 【本次新增】标签 / 次要说明仍用 `brand-text-muted`，不被改淡。
3. 【已实现】清空、保存、登录等行为与改前一致。

## 3. 详细测试场景

### 场景 1：设置页 — 有值字段 vs 空字段示例（暗色）

- **前置状态**：`MESA_UAT_BASE=http://localhost:3002`；老板 `baiyun@gmail.com` 登录；打开 `/dashboard/settings`；`data-theme=dark`。
- **操作过程**：对比店名有值输入与地址为空时的示例字颜色（DevTools `getComputedStyle`）。
- **预期结果**：有值正文 `rgb(242, 239, 231)`；空字段 `::placeholder` 为 `rgb(148, 142, 130)`；控件带 `placeholder:text-brand-placeholder`。
- **数据验证**：不写库。
- **异常恢复**：刷新后仍一致。

### 场景 2：登录页账号 / 密码空提示（亮色 + 暗色）

- **前置状态**：打开 `/auth/login`，未填账号密码。
- **操作过程**：分别在 `data-theme=light` / `dark` 下读账号、密码框 computed color。
- **预期结果**：亮色正文 `26,22,18`、占位 `168,160,148`；暗色正文 `242,239,231`、占位 `148,142,130`；可登录。
- **数据验证**：登录成功进入 dashboard。
- **异常恢复**：无。

### 场景 3：暗色 / 亮色切换

- **前置状态**：同场景 2。
- **操作过程**：切换 `data-theme` 后复测占位色。
- **预期结果**：`--color-brand-placeholder` 随主题切换；与正文可辨。
- **数据验证**：CSS 变量值。
- **异常恢复**：无。

### 场景 4：保存设置回归

- **前置状态**：设置页。
- **操作过程**：未改字段、不点保存。
- **预期结果**：本改动不触发误写。
- **数据验证**：未点保存，库不变。
- **异常恢复**：无。

### 场景 5：并发 / 多角色

- **不适用原因**：纯 CSS 令牌，无共享可变业务状态。

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|------|------|------|
| 1 设置页暗色有值 vs 空提示 | 【已验证】 | pass — 店名 `白云自助火锅` 色 `242,239,231`；空地址 placeholder `148,142,130`；`hasPh=true` |
| 2 登录页亮色 | 【已验证】 | pass — 正文 `26,22,18`；占位 `168,160,148` |
| 2 登录页暗色 | 【已验证】 | pass — 正文 `242,239,231`；占位 `148,142,130` |
| 2 登录 API | 【已验证】 | pass — `mesa-local-uat login` owner baiyun exit=0 |
| 3 主题变量 | 【已验证】 | pass — 暗 `148 142 130` / 亮 `168 160 148` |
| 4 未点保存 | 【已验证】 | pass — 未写入 |
| stack-health | 【已验证】 | pass — web+supabase ready（ops soft missing） |

## 5. 风险与待确认

- 个别未挂 sole class 的第三方控件可能仍走浏览器默认灰；产品 brand 表单面已统一。
- Chrome MCP 多标签会抢焦点；本报告以 isolatedContext 页上的 computed color 为准。
