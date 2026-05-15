# 员工账号（替换 PIN）— 实施计划

## 目标与约束（已定）

| 项 | 决策 |
|----|------|
| 终端 | **一人一账号**（平板/手机各自登录） |
| 凭证 | **合成邮箱** + 密码（Supabase Auth）；店长界面**不强调**邮箱字符串 |
| 旧机制 | **一刀切移除** PIN（无双轨过渡期）：下线 `kitchen_password` / `waiter_password` UI、`mesa_staff_session`、`/staff/session` PIN 流程 |
| 实时能力 | 员工端 **`authenticated` JWT + Supabase Realtime**，不靠高频轮询 |
| 后台入口 | **`/dashboard/settings/staff`**，与现有设置 **Hub Tab** 并列；**CRUD 交互**与出品档口 / 自助餐等保持一致 |
| 租户绑定 | **一人一店**：店长创建时绑定 `restaurant_id`；**不支持**一人多店 / 登录后选店 |
| 角色 | **创建后不可改**；需换角色则 **删除账号后重建** |
| 密码 | 与店主一致：**至少 6 位**；**首次登录强制改密** |
| 合成邮箱 | **`{login_name}@mesa.in`**（**全局唯一**：与 `auth.users.email` 一致，全平台不可与其它餐厅重复） |

---

## 产品与流程（已定）

### 1. 员工登录入口（双入口，均不需选店）

| 入口 | 路径（建议） | 场景 |
|------|----------------|------|
| **店内扫码** | `/{slug}/staff/login` | QR 进店登录页；可只填 **登录名 + 密码**（URL 已含门店 `slug` 用于校验账号属于本店），服务端拼成 **`{login_name}@mesa.in`**；也可直接填完整邮箱 |
| **全局直达** | `/auth/staff/login` | 填 **`{login_name}@mesa.in`** + 密码；**不选店**，凭邮箱全局唯一解析店与角色 |

两入口共用 `signInWithPassword`；店内入口在提交前将 `login_name` 合成为 `{login_name}@mesa.in`，并校验该用户属于 URL 中的门店。

**守卫**：厨房/服务员业务页校验 `authenticated` + `auth.uid()` 在本店 `restaurant_staff_accounts` 中 + `role` 匹配 + `disabled_at` 为空。

### 2. PIN 下线（**当前代码已执行**：UI / PIN 会话 API 已移除）

- **不保留** PIN 双轨；发布时同步移除 PIN UI、API 与相关列（或 migration deprecate）。✅ 设置页已无 PIN 字段；`/staff/session` 类 PIN 流已 410。
- 厨房/服务员入口 QR 使用 **`/{slug}/staff/login`**，不再收集 4 位数字。

### 3. 停用 / 启用 / 删除

| 操作 | 行为 |
|------|------|
| **停用** | 设 `disabled_at`；**立即踢下线**（撤销 refresh token / `signOut` 全局会话，按 Supabase 能力选型）；禁止登录直至启用 |
| **启用** | 清空 `disabled_at`；解除 Auth ban（若曾 ban）；**同一 `user_id` / 合成邮箱** 可再次登录，**不重建** Auth 用户 |
| **彻底删除** | 独立危险操作（二次确认）；删除 `restaurant_staff_accounts` 行 + **`auth.admin.deleteUser`**；不可恢复 |

列表操作：**编辑显示名**、**重置密码**、**停用/启用**、**彻底删除**；**无「改角色」**。

### 4. 密码与首次登录

- 校验规则与店主注册一致：**最少 6 位**（复用现有 `passwordLength` 文案与 API 校验）。
- 店长创建或重置密码后，在 `user_metadata`（或专用表字段）标记 **`must_change_password: true`**。
- 员工首次（或重置后）登录成功 → 强制进入 **`/auth/staff/change-password`**（或等价页）→ 改密成功后清除标记，再进入厨房/服务员页。

### 5. 角色与门店

- **一人一店**：创建时写入 `restaurant_id`，全生命周期不变。
- **`role`**：仅创建时选择 `kitchen` \| `waiter`；**PATCH 不允许改 role**。

---

## 设置中心 UX（与现有 CRUD 统一）

参考：`PrintStationsManager`、`BuffetSettingsManager`、`TablesManager`。

### 页面结构

1. **顶部**：与 Hub 一致（由 `DashboardSettingsShell` 提供 Tab）。
2. **本页**：`StaffAccountsManager`（新建组件，`embedded` 可选 props 与同目录页一致）。
3. **布局惯例**：
   - `rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5`
   - 列表区表格或卡片行；主按钮 `Button`；次要操作文字按钮 / `border-brand-border`
   - 成功 / 失败：`text-green` / `text-red` + `border` 提示条（与 `SettingsForm`、`CheckoutRequestsManager` 一致）
4. **列表列（建议）**：显示名、登录名、完整邮箱（`{login_name}@mesa.in`）、角色、状态、创建时间、操作（编辑显示名 / 重置密码 / 停用·启用 / **彻底删除**）
5. **创建 / 编辑**：
   - **Modal**（`PromptModal` 或小型专用 Modal）或 **内联表单**，与 `PrintStationsManager` 编辑档口一致：**弹层 + 校验 + 提交中 loading**
   - **创建**字段：**显示名**、**登录名**（**全平台唯一**，与其它餐厅不可冲突）、**角色**（创建后不可改）、**初始密码**（≥6 位）；保存后展示完整邮箱供复制
   - **编辑**：仅 **显示名**、**重置密码**（重置后再次触发首次改密）；**无改角色**
   - 登录邮箱在列表/详情 **可复制**（便于排障与告知员工）

### i18n

`messages.ts`：`staffSettings.*`（zh / en / pt），与 `settingsHub.tabStaff` 同步维护。

---

## 数据模型

### `public.restaurant_staff_accounts`（建议）

| 列 | 说明 |
|----|------|
| `id` | uuid PK |
| `restaurant_id` | FK → restaurants |
| `user_id` | FK → auth.users（uuid），唯一 |
| `role` | `kitchen` \| `waiter`，check |
| `display_name` | text |
| `login_name` | text；与邮箱 local-part 一致；**已不再** `UNIQUE (restaurant_id, login_name)`，唯一性由下方 `email` 保证 |
| `email` | text，创建时写入 **`{login_name}@mesa.in`**（与 `auth.users.email` 一致） |
| `created_at` / `updated_at` | timestamptz |
| `disabled_at` | timestamptz null（停用：踢线 + 禁止登录；≠彻底删除） |

可选：`created_by`（owner uuid）。

**约束**：`email` **全局唯一**（与 `auth.users.email` 一一对应）。迁移 **`20260521100000_staff_email_flat_domain`** 已去掉 `UNIQUE (restaurant_id, login_name)`，避免与全局邮箱语义冲突。

### 合成邮箱规则（已定：全局唯一）

- 格式：**`{login_name}@mesa.in`**
- `login_name`：店长在后台填写，需 **全平台唯一**（与其它餐厅员工不可冲突）。
- 字符与校验：见实现 `validateLoginName`（例如 3–32 位、`[a-z0-9_-]`、保留字等）。
- Supabase：部署前确认 **`@mesa.in` 域** 可注册；`email_confirm: true` 由 Admin API 创建。
- 碰撞：仅当 **`email` 全局重复**（同一 `login_name` 已被任一餐厅占用）时返回错误。

---

## Auth 流程

1. **店长创建**：`email = {login_name}@mesa.in`；`auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { must_change_password: true, staff_role, restaurant_id } })`；插入 `restaurant_staff_accounts`（含 `email` 快照）。
2. **店长更新**：仅 `display_name`；**不可改 `role` / `restaurant_id` / `login_name`**（改登录名若未来需要可单独立项，首期不做）。
3. **停用**：`disabled_at = now()` + 撤销会话 + Auth ban（或等价策略）→ **立即踢下线**。
4. **启用**：`disabled_at = null` + 解除 ban；**同一邮箱/同一 `user_id`** 恢复登录。
5. **彻底删除**：`auth.admin.deleteUser` + 删表行（需确认 UI 二次确认文案）。
6. **重置密码**：`auth.admin.updateUserById({ password })` + `must_change_password: true`。
7. **员工登录**：`signInWithPassword`；成功后若 `must_change_password` → 改密页，否则按 `role` 跳转 `/{slug}/kitchen` | `/{slug}/waiter`。
8. **登录入口**：`/{slug}/staff/login`（扫码）与 `/auth/staff/login`（全局，**不选店**）。

---

## RLS / Realtime

1. **`orders`、`table_sessions`、自助餐相关写路径**：由 **`authenticated`** + `restaurant_staff_accounts` join **`auth.uid()`** 校验 **`restaurant_id`**；按 **`role`** 拆分可选（厨房更新菜品状态、服务员转台等）。
2. **收紧 anon**：逐步移除仅靠「活跃会话」即可读写订单的路径；顾客下单保留 **`orders/append`** 等服务端路径。
3. **Realtime**：员工浏览器使用 **`createBrowserClient` + session**；policy 与 select 对齐。

---

## API（店主 CRUD）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/dashboard/staff` | 列表（owner session → restaurant_id） |
| POST | `/api/dashboard/staff` | 创建（`display_name`, `login_name`, `role`, `password`） |
| PATCH | `/api/dashboard/staff/[id]` | 更新 `display_name`；或 `action: disable` \| `enable`（**不含改 role**） |
| POST | `/api/dashboard/staff/[id]/reset-password` | 店长重置密码（触发强制改密） |
| DELETE | `/api/dashboard/staff/[id]` | 彻底删除（Auth 用户 + 表行） |

鉴权：`createClient` server + `owner_id` 校验； mutations 一律 **service role** 调 Auth Admin。

---

## 路由与导航

| 路径 | 用途 |
|------|------|
| `/dashboard/settings/staff` | Hub Tab「员工管理」→ `StaffAccountsManager` |
| `/{slug}/staff/login` | 店内扫码登录（校验账号属于该 `slug` 对应店） |
| `/auth/staff/login` | 全局登录（**不选店**；凭邮箱解析店与角色后跳转） |
| `/auth/staff/change-password` | 首次登录或重置后强制改密 |
| `/{slug}/kitchen` \| `/{slug}/waiter` | 业务页（需 session + role + 未停用） |

厨房 / 服务员页：middleware 或 layout 校验 **`authenticated`** + **`role`** + **`slug` 与 `restaurant_staff_accounts.restaurant_id` 绑定**，禁止交叉访问。

---

## 迁移与下线清单

1. [x] Migration：`restaurant_staff_accounts` + RLS（owner + staff orders/sessions）。
2. [x] 员工登录页 `/{slug}/staff/login`、`/auth/staff/login` + 强制改密页。
3. [x] `StaffAccountsManager` + `/api/dashboard/staff` CRUD。
4. [x] 厨房/服务员改 Supabase Auth；`staff/session` PIN 返回 410。
5. [x] 设置页移除 PIN 字段；桌位 QR 指向 `staff/login`。
6. [ ] 可选后续：DB 废弃 `kitchen_password` / `waiter_password` 列；进一步收紧 anon RLS。

---

## 实施顺序（建议）

1. **Schema**（含 `login_name`、`disabled_at`）+ owner CRUD API + **`StaffAccountsManager`**（含停用/启用/彻底删除）。
2. **双登录入口** + 强制改密 + session + 路由守卫。
3. **厨房 / 服务员页**改 Supabase Auth client + RLS。
4. **同版本移除 PIN**（无过渡期）+ 收紧 anon。
5. **Realtime 验收**（双账号双平板；停用即时踢线）。

---

## 细则（已定，2026-05-20）

| # | 项 | 决策 |
|---|-----|------|
| 1 | **全局登录** | 单栏 **`{login_name}@mesa.in`** + 密码；不选店 |
| 2 | **店内登录** | `/{slug}/staff/login`：可 **登录名 + 密码**（服务端合成 `{login_name}@mesa.in`）或完整邮箱；URL 用于校验账号属于该店 |
| 3 | **`login_name`** | 3–32 位；`[a-z0-9_-]`，首尾为字母或数字；**禁止 `.`**；保留字 `admin` `kitchen` `waiter` `owner` `root` `support` |
| 4 | **同店双角色** | **允许**（两个 `login_name`，各绑 `kitchen` / `waiter`） |
| 5 | **`login_name` 修改** | **首期不可改**（删账号重建） |
| 6 | **账号上限** | **不限制** |
| 7 | **登录锁定** | 与 PIN 相同：**5 次失败 → 锁定约 15 分钟**（按邮箱 + IP） |
| 8 | **强制改密** | 新密码 **不得与临时密码相同**（客户端校验 + metadata） |
| 9 | **运维** | 上线前在 staging 用 `@mesa.in` 试 `auth.admin.createUser` |

---

## 参考代码路径

- Hub：`src/components/dashboard/DashboardSettingsShell.tsx`
- CRUD 范例：`src/components/dashboard/PrintStationsManager.tsx`、`BuffetSettingsManager.tsx`
- 设置页范式：`src/app/dashboard/settings/print-stations/page.tsx`
