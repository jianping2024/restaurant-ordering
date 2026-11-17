# 多店访问与老板汇总 — 技术方案（修订稿 · 待 Will 确认）

> **状态**：修订稿 · 未编码 · 2026-11-17  
> **发起**：Will（老板有多家店，要看多店数据）  
> **作者**：Cursor Auto · **第一轮评审**：Claude（§11）· **第二轮复核**：Cursor（§11b，已并入正文）· **第三轮评审**：Claude（§11c，已并入正文）  
> **关联**：`docs/product/02-feature-map.md`、`docs/ai-schema.md`、`apps/web/src/lib/staff-gate-db.ts`、`docs/role-permissions-architecture.zh.md`

---

## 0. 一句话结论

**一个登录账号 → 账户级登录名 + 多店店籍（每店角色/权限）→ 经营页 URL 里的店 slug 即当前店 → Dashboard 另开跨店只读汇总。**  
不上集团层；cookie 只记「上次所在店」作登录落地，不承载当前店。

---

## 1. 背景与目标

### 1.1 业务动机

- 老板多家店：同一账号看多店数据。
- 店员通常一店；偶发一人两店：切店，不再注册第二账号。

### 1.2 目标

1. 同一 `auth.users` 可关联多家 `restaurants`（店籍）。
2. **当前店 = 经营 URL 中的店标识**（见 §2）；楼面 / 厨房 / 结账 / 单店设置 / 单店报表只认该店。
3. Dashboard **跨店只读汇总**（筛选 + 合计）+ 下钻进单店页（并导航到该店 URL）。
4. 两层隔离写清：
   - **RLS**：管「这个用户是不是这家店的人」（按 `restaurant_id` + 用户店籍 / `owner_id`）。
   - **应用层**：管「这个请求声称在操作哪家店」——必须与 URL/请求中的店一致且 ∈ 有权店；**RLS 不负责「当前店」**。

### 1.3 非目标

| 不做 | 理由 |
|------|------|
| 集团 / 品牌 org、总部角色、跨店统一菜单/结算 | 本期不是连锁中台 |
| 厨房 / 结账 / 楼面多店混合实时 | 与单店 Realtime、打印、会话冲突 |
| 每店一个登录账号当默认 | 体验与审计差 |
| 仅 UI 挂店列表、库仍 `user_id` 唯一 | 假开通 |
| 改顾客点餐 / 桌码 / print-agent 设备配对模型 | 天然单店；本方案仅约束 `print_agent` 店籍一行 |

### 1.4 已否决

1. 只做选店、不做汇总。  
2. 先做 org 再做店籍。  
3. owner 继续 `maybeSingle`、仅员工多店。  
4. **用共享 cookie 表示当前店**（多标签串店）——第一轮评审驳回，本修订采纳。  
5. 「login_name 只写第一行、其余继承」——驳回；必须账户级唯一表。

---

## 2. 端态形状（唯一）

| 概念 | 唯一表示 |
|------|----------|
| **身份** | `auth.users` 一条 |
| **账户登录名** | 账户级表（如 `staff_identities(user_id PK, login_name UNIQUE)`）；**不**在店籍行存 `login_name` |
| **店籍** | `restaurant_staff_accounts` 多行：`UNIQUE (restaurant_id, user_id)`；每行本店 `role`/`role_id`/`display_name`/`disabled_at` |
| **店主身份** | `restaurants.owner_id`（方案 A）；**不等于**员工预设角色 `owner`；有权列表 = 名下店 ∪ 已启用且非 `print_agent` 的店籍。禁止店主在自己名下店再插 staff 行 |
| **当前店（经营）** | **URL 中的店 slug**（员工/厨房已有 `/[slug]/staff|kitchen…`；单店 Dashboard 也纳入店作用域路径）。每个经营请求带该店；`loadPrincipal(user, restaurantId)` 逐请求校验店籍。切店 = 导航；页面卸载 → Realtime 自然重绑 |
| **跨店汇总** | 独立只读入口（路径**不**绑单一经营当前店，例如 `/dashboard/multi-store` 或现 home 在「店数≥2」时的汇总模式）；范围 = 有权且在该店具备 `dashboard.overview.view` 的店；写操作禁止 |
| **登录落地默认** | cookie `mesa_last_restaurant_id`：仅「上次所在店」，用于登录后默认进哪家；**不**参与写路径鉴权 |

**一句话：** 人可以有很多店；每个浏览器标签页各自在一个店 URL 里干活；看数用跨店只读页；cookie 只帮你记上次进哪家。

---

## 3. 当前事实（已证实）

1. `restaurant_staff_accounts.user_id` 全局唯一；`login_name` 表级唯一（`docs/ai-schema.md` / 迁移 `20260712120000_staff_login_name_unique_drop_email.sql`）。  
2. `loadStaffGateAccountForUser` / `loadOwnerRestaurantForUser` 均 `maybeSingle()`（`staff-gate-db.ts`）。  
3. `loadPrincipalWithCapabilities`：店主赢过 staff 行；店主/员工都绑**一家** `restaurantId`（`permissions/principal.ts`）。  
4. 产品地图「多门店连锁总部账号」= 当前不做。  
5. **RLS 侧已按「这家店 + 当前用户」查店籍**（`staff_has_restaurant_permission` / `is_active_restaurant_staff` / `assert_restaurant_session_operator` 等）——一人多行店籍在数据库层天然兼容，**不必为多店改这些 RLS 函数语义**。  
6. **账户级危险路径（一人多店后会串店）已在代码核对：**  
   - `reset-password` → `auth.admin.updateUserById` 改全局密码；  
   - `DELETE staff/[id]` → `retireStaffAuthUser` 可拆掉整个 Auth 用户；  
   - `PATCH staff` → `staffMetadataPayload` 写入单店形状 `user_metadata` + `kickStaffUserSessions` 踢光全部会话；改 `login_name` 即改登录邮箱（`buildStaffEmail`）；  
   - **店内禁用 = 全局封号**：`api/dashboard/staff/[id]` 禁用调 `setStaffUserBanned(user_id, true)`（启用时 unban、删除时 ban）；ops `restaurants/[id]/staff/[staffId]` 禁用同样 ban + 踢会话；  
   - **ops 删店删光 Auth 用户**：`apps/ops/src/lib/purge-restaurant.ts` 收集 `owner_id` + 全部店籍 `user_id` 后逐个 `auth.admin.deleteUser`。  
7. **API 当前店由用户推导**：`requirePermission(key)` / `loadPrincipal()` 无店参数；`/api/dashboard/*`、`/api/restaurant/*` 不带 slug（前端约 34 处 `fetch`）。仅 `/api/restaurants/[slug]/…` 带店。  
8. **metadata 仍参与落地**：`supabase/middleware.ts`（`meta.restaurant_slug`）、`staff-change-password-gate.ts`。  
9. **店籍表 `login_name` 其他读取方**：`order-history/resolve-staff-operator.ts` 等。  
10. **建店入口**：`RestaurantOnboarding` 客户端 insert（自助一店）；on-prem 由 `license-materialize` 写 `owner_id`。  
11. **Realtime**：`use-restaurant-realtime-refresh` 订阅带 `filter`，多店不串推。  
12. **未逐文件核实**：浏览器端 Supabase 直查是否都显式 `.eq('restaurant_id', …)`；依赖 RLS 隐式收窄到「唯一店」的查询在多店后会返回并集。

---

## 4. 数据与门禁模型

### 4.1 账户级 vs 店籍级

| 层级 | 内容 | 操作归属 |
|------|------|----------|
| **账户** | `auth.users` + `staff_identities.login_name` + 密码 | 本人改密；平台；**严格门禁下的**店内重置（见下） |
| **店籍** | `(restaurant_id, user_id)` 行：角色、display_name、本店禁用 | 本店 `settings.staff.manage` |

**账户级门闩（唯一一条规则，重置密码与改 `login_name` 共用）：** 仅当目标用户的**全部**店籍（含已禁用、含 `print_agent` 行）都落在操作者拥有 `settings.staff.manage` 的店内，**且**目标不是任何店的 `owner_id` 时，才允许；否则只能本人改或走平台。判定与执行在同一事务内，并与「关联已有账号」互斥加锁（防判定后被插入新店籍）。

**删除员工（端态）：** 只删本店店籍行；仅当已无剩余店籍且不是任何店店主时，才 `retireStaffAuthUser`。

**禁用员工（端态）：** 店内禁用只写本店 `disabled_at`，**不** ban、**不**踢会话（principal 逐请求读 DB 即生效）。Auth ban/unban 仅用于账户级事件，且以「剩余有效店籍」判定：最后一个有效店籍被禁用且非店主 → ban；任一店籍启用 → unban。Web 与 ops 共用此规则。

**删店（ops purge，端态）：** 只删除「删店后无剩余店籍且不是任何其他店店主」的 Auth 用户；其余用户只删本店店籍。

**user_metadata（端态）：** 不再存 `restaurant_id` / `restaurant_slug` / `staff_role` / `staff_account_id` 作为门禁真相；principal 与登录落地只信 DB（含 middleware、改密门禁）。踢会话仅用于账户级事件（账号 ban、重置密码、退役等），**不**因单店改角色/禁用而踢光所有店会话。

**`print_agent`：** 该 `user_id` 全局仅一条店籍，且不可再关联为人类员工；人类员工不可改为 `print_agent`（设备账号不参加人选店）。

**约束落点：** 上述跨行/跨表约束（本条 + §4.2 店主约束）由 DB trigger 强制，不靠应用层自觉。

### 4.2 店籍表变更

- 去掉 `user_id` 全局唯一 → `UNIQUE (restaurant_id, user_id)`。  
- 店籍行 **删除 `login_name`**（迁到 `staff_identities`）；`display_name` 留店籍行。  
- 员工预设角色名 `owner` ≠ `restaurants.owner_id` 店主；文档与 UI 文案分开。  
- 约束：若 `restaurants.owner_id = user_id`，禁止该店存在该用户 staff 行。DB trigger 双向：店籍 insert/update 时查店主；`restaurants.owner_id` 变更（含 `license-materialize`）时查店籍。
- 迁移前先跑存量违约查询（店主在自家店已有 staff 行、`print_agent` 账号多行等），清理后再加约束。
- 读取店籍 `login_name` 的调用点（`resolve-staff-operator.ts`、审计/操作历史显示等）在删列前改为 join `staff_identities`。

### 4.3 当前店与校验

- 经营页：URL slug → `restaurantId` → `assertUserAuthorizedForRestaurant(userId, restaurantId)`（**单点存在性检查**，Edge 不每次拉全量列表）。  
- 登录：`listAuthorizedRestaurantsForUser` → 0 / 1 / N 家流程；N 家时优先 `mesa_last_restaurant_id` 若仍有权，否则选店页。  
- 切店：导航到目标店 URL，并更新 `mesa_last_restaurant_id`。  
- **API 当前店传输（唯一）：** 店作用域 API 一律由请求显式携带当前店（路径段或 header 二选一，实现时定一种，见 §9），服务端唯一入口 `requirePermission(key, restaurantId)` / `loadPrincipalForRestaurant` 做店籍校验；不再提供「从用户推导店」的无参版本。
- **禁止**仅信 body/`restaurant_id` 而不核对店籍。
- **浏览器直查审计：** 凡依赖 RLS 隐式收窄到唯一店、未显式 `.eq('restaurant_id', …)` 的客户端查询，P0 逐个补上当前店条件。

### 4.4 Sole helpers

```text
listAuthorizedRestaurantsForUser(userId)
  → owned ∪ active non-print_agent staff rows

assertUserAuthorizedForRestaurant(userId, restaurantId)  -- 单店门闩

loadPrincipalForRestaurant(userId, restaurantId)
  → owner(*) | staff capabilities at that store
```

禁止第二套「员工配置店 id[]」字段；合并 `loadStaffGateAccountForUser` 与 `loadStaffGateByUserId` 为同一实现后再扩展。

### 4.5 Principal

```text
Principal = {
  userId,
  restaurantId,  // 本请求的店（来自 URL），不是 cookie
  kind: 'owner' | 'staff',
  capabilities,
}
```

切店 UI 另调 `listAuthorizedRestaurantsForUser`（可缓存），不塞进每个 principal 强制全量。

---

## 5. 产品流程

### 5.1 登录

```text
登录成功 → listAuthorizedRestaurants
  → 0：无店籍错误页
  → 1：写 last cookie → 进该店 URL（原 post-login）
  → N：选店（可预填 last）→ 写 last → 进该店 URL
```

### 5.2 切店

顶栏下拉（仅授权店）→ 导航到目标店作用域 URL → 更新 last cookie → Realtime 随页面重绑。

### 5.3 员工管理

- 本店新增店籍；已有账号 → **同一创建入口**支持「关联已有 login/email」（不另开平行 API；ops 新建员工遇已存在 login 也走此入口）。  
- 关联须**本人确认**（邀请 → 被邀请人登录后接受才生成店籍）；唯一例外：操作者是目标现有全部店籍所在店的店主（同一老板名下店之间）可直接关联。接口不回显 login 是否存在，防枚举。  
- 本店 `disabled_at` 不影响他店（见 §4.1 禁用端态）。

### 5.3b 第二家店的来源

见 §9 待决：ops 建店后绑 `owner_id`，或老板自助建店（改 `RestaurantOnboarding` 为「已有店也可新建」）。

### 5.4 跨店汇总（P2）

| 能力 | V1 |
|------|-----|
| 有权且具备该店 `dashboard.overview.view` 的店列表 + 多选（默认全选） | ✅ |
| 今日已收/未收按店分行 + 合计（复用 `dashboard-overview` 单店 sole，按店调用） | ✅ |
| 点店名 → 设 last + 进入该店 Dashboard URL | ✅ |
| 增值分析多店 | P3 |
| 跨店写 | ❌ |

入口显示条件：授权店数 ≥ 2（**仅 UX**，不是授权白名单）。授权仍逐店 `dashboard.overview.view`（店主 `*`）。**不**新增 `dashboard.multi_store.view`。

---

## 6. 分期

| 期 | 交付 | 验收 |
|----|------|------|
| **P0** | 存量违约查询 → 迁移（唯一约束 + `staff_identities` + 去掉店籍 `login_name` + print_agent/店主 trigger）+ 账户级 vs 店籍级操作拆分（改密/改登录名/删除/禁用 ban/ops 删店/metadata/踢会话，Web 与 ops 同规则）+ URL 当前店 + API 显式带店 + `list`/`assert`/`loadPrincipalForRestaurant` + 登录选店 + 顶栏切店 + 门禁调用点改完 + 浏览器直查审计 | 一人两店不串数据；A 店重置/改登录名不能接管 B 店人；删/禁 A 店籍不断 B 登录；ops 删 A 店不删 B 店的人 |
| **P1** | 创建入口支持关联已有账号（邀请 + 本人确认） | 同一 login 两店不同角色；未确认不生成店籍 |
| **P2** | 跨店今日汇总只读页 | 数字与单店页一致 |
| **P3** | 增值分析等店筛选 | 可选 |

P0 迁移一旦放宽 `user_id` 唯一，账户级操作拆分**必须同批**，否则存在跨店接管窗口。

---

## 7. 主要改动面

| 区域 | 动作 |
|------|------|
| 迁移 + `ai-schema.md` | §4.1–4.2 |
| `staff-gate-db.ts` / `staff-identity-gate.ts` / `staff-access.ts` | 合并重复 gate 查询；列表 + 按店加载 |
| `permissions/principal.ts`、`require.ts`、middleware、`dashboard-access*` | `loadPrincipalForRestaurant`；`requirePermission(key, restaurantId)`；Dashboard 单店路径纳入 slug 作用域 |
| `/api/dashboard/*`、`/api/restaurant/*` 全部店作用域路由 + 前端 `fetch` 调用点 | 显式带当前店（§4.3） |
| `supabase/middleware.ts`、`staff-change-password-gate.ts` | 去掉 `meta.restaurant_slug` 落地，改读 DB + last cookie |
| `auth/post-login-redirect.ts`、`api/auth/login`、选店页 | 落地 |
| `api/dashboard/staff/**`、`staff-dashboard-api.ts`（`staffMetadataPayload`） | 账户/店籍拆分（含禁用不 ban、改登录名走账户级门闩）；关联已有账号 |
| ops `api/ops/restaurants/[id]/staff/**`、`apps/ops/src/lib/purge-restaurant.ts` | 禁用/新建同规则；删店只退役无剩余店籍且非店主的用户 |
| `order-history/resolve-staff-operator.ts`、审计 actor 显示 | `login_name` 改读 `staff_identities` |
| 浏览器端 Supabase 直查 | 补显式当前店条件 |
| 旁路店主判定并入 principal：`checkout-confirm-payment-auth.ts`、`print-agent/receipt-printers/route.ts` 等 | 去掉第二套 `slug+owner_id` 门禁 |
| 壳 UI 切店；P2 汇总页 | |
| Realtime | 随 URL 页面生命周期，无轮询 |
| `02-feature-map.md`、sole 索引、场景文档 | 落地时同步 |

**稳定点：** 顾客 anon；print-agent 设备一对店；RLS 按店函数语义；capability 注册表不因汇总新增全局 key。

---

## 8. 风险与验证

### 8.1 风险

| 风险 | 缓解 |
|------|------|
| 多标签 cookie 串店 | 已改为 URL 权威 |
| 改密/改登录名/删号/禁用封号/踢会话/ops 删店跨店 | P0 账户级规则 + UAT |
| 关联已有账号被滥用（枚举、拉人后接管） | 邀请 + 本人确认；不回显存在性；与账户级门闩互斥 |
| 加约束时存量违约导致迁移失败 | 迁移前违约查询 + 清理 |
| 浏览器直查返回多店并集 | P0 直查审计 |
| Dashboard 迁入店作用域路径工作量大 | P0 必须做完单店写路径；旧 `/dashboard/*` 书签与 PWA `start_url` 重定向到 last 店 URL |
| P2 汇总逐店调用性能 | 实现时评估；店数大再考虑批量口径（仍复用单店 sole） |
| gate 双查询残留 | P0 先合并再改 |
| on-prem shadow admin | 只返回已认领一家 |
| 汇总口径 | 只复用单店 sole |

### 8.2 验收场景

1. 一人一店：无选店，行为同现网。  
2. 老板两店：两标签分别开 A/B URL，写操作互不串。  
3. 员工仅 A：打 B API → 403；改 cookie 无效。  
4. 同人 A 收银 / B 服务员：侧栏随 URL 店变。  
5. A 禁用：不可进 A；B 仍可。  
6. A 有 staff.manage 者不能重置「还是 B 店店主」的人的密码。  
7. 删 A 店籍：B 仍可登录；最后一店籍且非店主才退役 Auth。  
8. P2 汇总数字 = 各单店页之和/分行一致。  
9. 顾客扫码、打印配对回归。  
10. A 有 staff.manage 者不能改「还在 B 店」的人的登录名。  
11. ops 删除 A 店：同时在 B 店的员工与 B 店店主仍可登录。  
12. A 店关联已有账号：被邀请人未确认前无 A 店籍；接口不泄露 login 是否存在。  
13. 店主插入自家店 staff 行、`print_agent` 账号再关联他店：DB 拒绝。

---

## 9. 待决项（本轮已锁建议 · 待 Will 拍板）

1. **店主店籍：** 方案 A（锁定）。  
2. **login_name：** 账户级表、全局一人一个（锁定）。  
3. **P2 最小集：** 今日已收/未收按店 + 合计 + 下钻；增值分析 P3（锁定）。  
4. **cookie：** 仅 `mesa_last_restaurant_id` 落地默认，同登录会话寿命（锁定）。  
5. **权限：** 不新增 `dashboard.multi_store.view`；逐店 `dashboard.overview.view`（锁定）。  
6. **on-prem：** Mode B 本阶段单店（锁定）。

**仍须 Will 一句话确认的实现偏好（非推翻端态）：**

- 单店 Dashboard 最终路径形态：例如 `/dashboard/r/[slug]/…` 或 `/(restaurant)/[slug]/dashboard/…`（实现时定一种，sole 一条）。  
- 跨店汇总路径名。  
- API 当前店传输：路径段（如 `/api/r/[slug]/…`）或 header（如 `x-mesa-restaurant`），二选一。

**仍须 Will 拍板的产品项：**

- 第二家店从哪来：ops 建店后绑 `owner_id`，或老板自助建店（影响 P0 是否改 onboarding）。

---

## 10. 文档同步（落地时）

- `02-feature-map.md`：多门店改为本方案范围（无集团层）。  
- `ai-schema.md`：`staff_identities` + 店籍约束。  
- `docs/test-scenarios/YYYY-MM-DD-multi-store-access.md`。  
- `agent-sole-index.zh.md`：sole helpers 一行。

---

## 11. 第一轮评审结论栏（Claude · 2026-11-17）

| 项 | 结论 | 备注 |
|----|------|------|
| 端态（§2） | 修改后通过 | 当前店改 URL；cookie 降级 |
| 店籍模型（§4.1） | 修改后通过 | 方案 A；login_name 账户级表 |
| 当前店（§4.2） | 修改后通过 | 见上 |
| 分期（§6） | 修改后通过 | 账户/店籍拆分进 P0 |
| 非目标（§1.3） | 通过 | |
| 待决（§9） | 见原建议 | 已并入正文 §9 |

**Claude 总评（原文要旨）：** 修改后再评，暂不进入实现。必改 5 条：URL 当前店；账户/店籍操作拆分进 P0；login_name 上移；补全调用点；§3 补 RLS 兼容与两层隔离。

---

## 11b. 第二轮复核（Cursor · 2026-11-17）

| Claude 要求 | Cursor 结论 | 说明 |
|-------------|-------------|------|
| 当前店 = URL，cookie 降级 | **采纳** | 已用代码核对：多标签共享 cookie 会串写；员工路由已有 slug，Dashboard 需纳入店作用域 |
| 方案 A + 禁止店主自拍 staff 行 | **采纳** | 对齐 role-permissions「店主 ≠ staff 行」 |
| `staff_identities` 上移 login_name | **采纳** | 「首行继承」驳回正确；`buildStaffEmail(login_name)` 本就账户级 |
| 改密/删号/metadata/踢会话拆分进 P0 | **采纳** | 已核对 `reset-password`、`DELETE staff`、`staffMetadataPayload`、`kickStaffUserSessions` |
| 不新增 multi_store.view | **采纳** | 避免全局平行白名单 |
| on-prem 单店 | **采纳** | |
| §7 调用点清单 | **采纳并写入 §7** | gate 双查询先合并；旁路 `owner_id` 判定并入 principal |
| RLS 已兼容多行 | **采纳写入 §3.5** | |

**Cursor 追加一条（已写入 §2）：** 跨店汇总页是**只读、非单一当前店**入口，路径不要假装成某一店的经营 URL；与「经营当前店 = slug」不冲突，而是第四概念「汇总范围」的 UI 落点。

**第二轮总评：修订稿可通过，待 Will 确认 §9 锁定项 + Dashboard 路径命名偏好后即可进入实现（仍须 Will 说「按方案改」）。** 无需再大改端态；实现前不必第三轮架构评审，除非 Will 否定 URL 当前店或账户级 login 表。

---

## 11c. 第三轮评审（Claude · 2026-11-17 · 对照代码）

**结论：** 端态（URL 当前店、方案 A、账户级 login 表）成立；但 P0 范围漏了以下跨店账户级操作与未定义项，§11b「不必第三轮」不成立。

**并入状态（2026-11-17）：** 已并入正文 —— 11c.1 → §3.6–3.9、§4.1、§4.2、§4.3、§7；11c.2 → §4.1（门闩/trigger）、§4.2（存量查询）、§5.3/5.3b（邀请确认、建店来源）、§8.1、§9；11c.4 → §3.12、§4.3、§8.1；验收 → §8.2 #10–13；P0 → §6。下文保留为评审记录。

### 11c.1 已核实漏洞（代码证据）

| # | 问题 | 证据 | P0 要求 |
|---|------|------|---------|
| 1 | **店内禁用 = 全局封号**：禁用员工调用 `setStaffUserBanned(user_id, true)`（`ban_duration` 876000h），ops 端再 `kickStaffUserSessions` | `apps/web/src/app/api/dashboard/staff/[id]/route.ts:66`（启用 unban :81，删除 :159）；`apps/ops/src/app/api/ops/restaurants/[id]/staff/[staffId]/route.ts:55` | 店内禁用只写 `disabled_at`；ban/unban 仅限账户级事件，并按「剩余有效店籍」判定。否则 §5.3 与验收 5 不成立 |
| 2 | **ops 删店删光 Auth 用户**：收集 `owner_id` + 全部店籍 `user_id` 后逐个 `auth.admin.deleteUser` | `apps/ops/src/lib/purge-restaurant.ts:117-173` | 仅删除「无剩余店籍且非任何店店主」的用户；否则删 A 店会删掉 B 店员工或老板本人 |
| 3 | **ops 员工接口未列入改动面** | `apps/ops/src/app/api/ops/restaurants/[id]/staff/**` | ops 创建/禁用走同一账户级/店籍级规则；ops 新建遇已存在 login 走同一「关联已有账号」入口 |
| 4 | **改 `login_name` 是账户级操作**：登录邮箱由 `buildStaffEmail(login_name)` 派生 | `PATCH staff` 路径 | 改登录名与店内重置密码同一门禁（全部店籍在操作者管辖内且非店主），否则为另一接管路径 |
| 5 | **API 层当前店传输未定义**：`requirePermission(key)` / `loadPrincipal()` 无店参数，店由用户推导 | `apps/web/src/lib/permissions/require.ts:22`；112 个 `route.ts`，`/api/dashboard/*`、`/api/restaurant/*` 不带 slug；前端 34 处 `fetch('/api/restaurant\|dashboard/…')` | 定唯一传输方式（路径段或 header 二选一）+ 唯一校验入口（如 `requirePermission(key, restaurantId)` 必填），列入 §4.3 / §7 |
| 6 | **中间件 / 改密门禁仍用 metadata 落地** | `apps/web/src/lib/supabase/middleware.ts:101`（`meta.restaurant_slug`）；`apps/web/src/lib/staff-change-password-gate.ts:26` | 列入 §7；落地改为 `listAuthorizedRestaurantsForUser` + last cookie |
| 7 | **`login_name` 其他读取方** | `apps/web/src/lib/order-history/resolve-staff-operator.ts:28` 直接 select 店籍 `login_name` | 迁移删列前改为 join `staff_identities`；审计/操作历史显示同步 |

### 11c.2 设计缺口

1. **「关联已有账号」须本人同意**：否则可枚举 login、拉人进店；且「无店籍、非店主」的账号被拉入后其全部店籍都在 A，A 即可重置密码接管。端态：邀请 + 本人确认；或仅允许同一店主名下店之间直接关联。
2. **约束须 DB 层双向强制（trigger）**：「店主不得在自家店有 staff 行」「`print_agent` 账号全局仅一行店籍且不可再关联为人类员工」跨行/跨表，CHECK/UNIQUE 不够。触发点：店籍 insert/update、`restaurants.owner_id` 变更（含 `license-materialize`）、角色改为 `print_agent`。
3. **第二家店的来源未定**：现建店入口为 `RestaurantOnboarding` 客户端 insert。须定：ops 建店后绑 `owner_id`，还是老板自助建店（影响 P0 是否改 onboarding）。
4. **重置密码门禁同事务判断**：「全部店籍」含已禁用与 `print_agent` 行；与「关联已有账号」互斥加锁，避免判定后被插入新店籍的竞态。
5. **迁移前存量查询**：先查「店主在自家店已有 staff 行」等违约数据，否则加约束失败；旧 `/dashboard/*` 书签与 PWA `start_url` 须重定向。

### 11c.3 已核实无需改

- SQL：未见按 `auth.uid()` 取单一店的函数；§3.5「RLS 按店+用户、多行兼容」基本成立。
- Realtime：`use-restaurant-realtime-refresh` 订阅带 `filter`，不会串推。

### 11c.4 未核实（列为 P0 审计项）

- 浏览器端 Supabase 直查未写 `.eq('restaurant_id', …)`、依赖 RLS 隐式收窄到唯一店的查询：多店后会返回并集。须逐文件扫。
- P2 汇总按店逐个调用单店 sole 的性能。

**第三轮总评：** 端态不变；11c 已并入正文。待 Will 拍板 §9（含「第二家店来源」「API 当前店传输」）后可进实现（仍须 Will 说「按方案改」）。

---

## 12. 给实现者的提醒

- 未获 Will「按方案改」前 **禁止编码**。  
- Feature branch / worktree；不动旁路 WIP。  
- 清冗余 → 业务场景 + UAT → `gate.sh check`；commit/merge 仅当 Will 要求。
