# 本次改动业务场景测试报告：店主登录默认进楼面看板

日期：2026-10-10  
分支：`fix/owner-login-waiter-landing`

## 1. 本次修改

- **内容**：店主密码登录（及已登录再打开登录页）的默认落地页，从「餐厅设置」改为与员工/顶栏 logo 同一规则：有楼面权限 → `/dashboard/waiter`。店主能力为 `*`，故进楼面看板。设置仍从顶栏进入。
- **文件**：
  - `apps/web/src/lib/auth/post-login-redirect.ts` — 店主 path 走 `staffLandingPathFromCapabilities` + `resolveCapabilitiesForOwner`
  - `apps/web/src/lib/supabase/middleware.ts` — 登录页重定向统一用 `redirect.path`（去掉店主写死设置）
  - `apps/web/src/lib/permissions/permissions.test.ts` — 店主 `*` 落地断言
  - `docs/role-permissions-plan.zh.md` — 店主默认落地口径对齐
- **角色 / 页面 / 流程**：店主（邮箱登录）→ 登录成功 → 楼面看板；员工登录路径未改。

## 2. 核心业务规则

1. **登录落地唯一写法**：`staffLandingPathFromCapabilities(slug, capabilities)`。店主用 `resolveCapabilitiesForOwner() → '*'`，员工用角色权限。
2. **禁止**再为店主单独写死 `/dashboard/settings` 作为登录落地。
3. 顶栏 logo 本就走同一函数；登录与 logo 必须一致。
4. 开店 onboarding（无店）仍进 `/dashboard`，不在本次范围。
5. 设置页权限与入口不变；只改「第一屏」。

## 3. 详细测试场景

### 场景 1：店主密码登录进楼面

- **前置状态**：店主账号（UAT：`luckytea@gmail.com` / `123456` 或 `baiyun@gmail.com` / `123456`）；未登录或先登出。
- **操作过程**：打开 `/auth/login` → 输入邮箱密码 → 登录。
- **预期结果**：API `POST /api/auth/login` 返回 `kind: 'owner'` 且 `path: '/dashboard/waiter'`；浏览器落地 URL 为 `/dashboard/waiter`，可见楼面看板。
- **数据验证**：无库写；仅会话 cookie + 跳转。
- **异常恢复**：登录失败仍停在登录页（既有行为）。
- **标签**：【本次新增】【已实现】【已验证】

### 场景 2：已登录店主再打开登录页

- **前置状态**：店主已登录（场景 1 之后）。
- **操作过程**：浏览器访问 `/auth/login`。
- **预期结果**：middleware 重定向到 `/dashboard/waiter`（不是设置）。
- **数据验证**：无库写。
- **标签**：【本次新增】【已实现】【已验证】

### 场景 3：店主仍可进设置

- **前置状态**：店主在楼面看板。
- **操作过程**：顶栏进入「餐厅设置」或直接打开 `/dashboard/settings`。
- **预期结果**：设置页可打开；资料/员工等入口可用。
- **标签**：【回归】【已实现】【已验证】

### 场景 4：有楼面权限的员工登录仍进楼面

- **前置状态**：前台员工 `qiantai1` / `MesaUat1`（白云）。
- **操作过程**：`/auth/login` 用登录名登录。
- **预期结果**：`path` 仍为 `/dashboard/waiter`（或该角色既有落地）；行为与改前一致。
- **标签**：【回归】【已实现】【已验证】

### 场景 5：单测 — 店主星能力落地

- **操作**：`node --import tsx --test src/lib/permissions/permissions.test.ts`
- **预期**：`owner star landing is waiter board` 通过；`landing prefers waiter board then checkout` 通过。
- **标签**：【本次新增】【已实现】【已验证】

### 不适用项（写明原因）

| 维度 | 原因 |
|------|------|
| 多用户并发写库 | 无共享可变业务数据；仅跳转 |
| 结账/收款状态机 | 未改 |
| 历史数据兼容 | 无持久化字段变更 |

## 4. 实际测试结果

基址：`http://localhost:3002`（feature worktree）

| 项 | 结果 | 备注 |
|----|------|------|
| 清冗余 | **pass** | 去掉 middleware 店主写死设置；唯一写法 `staffLandingPathFromCapabilities` |
| 单测 permissions | **pass** | 19/19 |
| mesa-local-uat stack-health | **pass** | ready；ops softMissing |
| mesa-local-uat owner login path | **pass** | `path: /dashboard/waiter` |
| UI 店主登录落地 | **pass** | Chrome → `/dashboard/waiter`（Sala） |
| UI 已登录访登录页 | **pass** | 重定向仍楼面 |
| UI 设置可达 | **pass** | `/dashboard/settings` 资料表单 |
| 员工登录回归 | **pass** | qiantai1 → `/dashboard/waiter` |
| gate.sh check | **pass** | lint+typecheck web |

## 5. 风险与待确认

- PWA `start_url` 仍为 `/dashboard`（概览），不是本次改动范围；冷启动装机图标仍先进概览。【未验证】改 PWA
- 历史计划文档中仍有「仅设置侧栏」等旧叙述；本次只改了「默认落地」相关行。
