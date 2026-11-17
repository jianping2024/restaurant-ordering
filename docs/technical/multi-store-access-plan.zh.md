# 多店访问与多店概览 — 技术方案（重写稿 · 待 Will 确认）

> **状态**：重写稿 · 未编码 · 2026-11-17  
> **发起**：Will（老板有多家店，要用一个账号看多店数据、进各店操作）  
> **路线**：员工账号多店店籍（ops 关联）；管理员邮箱账号保持一店一个。旧稿（管理员账号多店）已废弃，见 §15 评审历史。  
> **关联**：`docs/ai-schema.md`、`docs/role-permissions-architecture.zh.md`、`docs/product/02-feature-map.md`

---

## 0. 一句话结论

**一个员工账号（全平台唯一登录名）由 ops 关联到多家店 → 在每家店它就是那家店的员工，权限由那家店配置 → 网址里的店 slug 决定当前在哪家店 → 另有一个只读的多店概览页。管理员邮箱账号不变，仍一店一个。**

---

## 1. 背景与目标

### 1.1 需求

- 老板（或店长）用**一个账号**看多家店的数据，并能进入每家店，按那家店给的权限操作。
- 偶尔有员工在两家店上班，也用同一个账号。

### 1.2 目标

1. 同一个员工账号可以属于多家店，每家店一行店籍，角色/权限各自独立。
2. 当前店 = 网址里的店 slug；楼面、厨房、结账、后台、设置、报表只认这家店。
3. 多店概览页：只读，按店分行 + 合计。
4. 单店用户（现在几乎全部用户）体验不变。

### 1.3 非目标

| 不做 | 理由 |
|------|------|
| 管理员邮箱账号管多家店 | 管理员账号就是「这家店的后台账号」，一店一个，不混 |
| 集团 / 品牌层、总部角色、跨店统一菜单或结算 | 不是连锁中台 |
| 厨房 / 结账 / 楼面多店混在一屏 | 与单店 Realtime、打印、会话冲突 |
| 店里自己把员工拉进别的店（邀请流程） | 只有 ops 能关联，见 §3 规则 1 |
| 改顾客点餐 / 桌码 / 打印 agent 配对 | 天然单店 |
| on-prem 一台机器多店 | 本期 on-prem 仍单店 |

### 1.4 已否决

1. **管理员邮箱账号多店**（`owner_id` 一人多店）：打破「一店一个管理员账号」，与需求相反。
2. **只做只读汇总、不让账号进多店**：Will 明确要一个账号进各店操作。
3. **店里发邀请、本人接受**：多出邀请表和防枚举逻辑；改为只有 ops 关联。
4. **用共享 cookie 表示当前店**：多标签页会串店。
5. **登录名留在店籍行、只写第一行**：账号级的东西必须放账号级表。

---

## 2. 术语（全文统一）

| 词 | 指什么 | 代码里 |
|----|--------|--------|
| **管理员账号** | 每家店的后台邮箱账号，权限 `*`，一店一个；由我们自己掌握 | `restaurants.owner_id`；`principal.kind === 'owner'`（`resolve.ts:53` 注释「Backend admin」） |
| **员工账号** | 用登录名登录的账号（合成邮箱 `{login_name}@…`） | `restaurant_staff_accounts` + Auth 用户 |
| **店主 / 店长** | 员工账号在某家店的**角色**，不是管理员账号 | 预设角色 `owner`（显示名「店主」）或自定义角色 |
| **店籍** | 某员工账号在某家店的一行：角色、显示名、本店禁用 | `restaurant_staff_accounts` 一行 |
| **多店账号** | 有 ≥2 行店籍的员工账号 | — |
| **当前店** | 本次请求 / 本页面操作的那家店 | 网址里的 slug |

---

## 3. 端态规则（5 条，唯一）

1. **账号全平台唯一，只有 ops 能把它关联到多家店。** 店里只能建本店员工，不能关联到别的店。
2. **在每家店它就是那家店的员工。** 角色和权限由那家店设置，各店互不影响。
3. **店里可以改它在本店的角色/权限/显示名、禁用、删除。** 删除 = 解除本店关联，只影响本店；删的是最后一家店时才注销账号。禁用只影响本店，不封整个账号。
4. **多店账号的密码和登录名，由本人、ops，或它所关联任一家店的管理员账号来改；带「员工管理」权限的普通员工不能改。** 单店账号和现在一样（有「员工管理」权限即可）。
5. **登录后能选店、切店；另有一个只读的多店概览页。**

**补充约束（DB 强制）：**
- 管理员账号不能在任何店有店籍（管理员和员工是两类账号，不混）。
- 管理员账号一店一个：`restaurants.owner_id` 非空时唯一。
- `print_agent`（打印设备账号）全平台只能有一行店籍，不能被关联到别的店，也不能成为管理员。

---

## 4. 当前事实（已对照代码）

1. 店籍表 `user_id` 全局唯一，`login_name` 在店籍行上且全局唯一（`docs/ai-schema.md`、迁移 `20260712120000_staff_login_name_unique_drop_email.sql`）。
2. 有**两套**按用户推导单店的鉴权：
   - `permissions/principal.ts` 的 `loadPrincipalWithCapabilities()`（无店参数）+ `require.ts` 的 `requirePermission(key)`；
   - `staff-api-auth.ts:125-175` 的 `staffSessionForSlug(slug)`，按 user `.maybeSingle()` 取店籍，另有一份权限加载 `loadStaffCapabilities`（`:70-101`，与 `principal.ts:22-63` 重复）。
   - `[slug]/kitchen/page.tsx` 混用两者（`:19` 按 slug 门禁，`:50` 用无店 principal 取权限）。
3. 查店籍和管理员店都用 `.maybeSingle()`（`staff-gate-db.ts:17-30, 57-61, 83-93`）。
4. 登录预检按登录名取单行，按该行禁用/暂停决定能否登录（`staff-access.ts:87-127`；`api/auth/login/route.ts:85-103`）。
5. `user_metadata` 存单店字段，解析器缺任一字段即返回 null（`staff-account.ts:141-157`）；强制改密标志 `must_change_password` 和账号类型都经它读取（`staff-change-password-gate.ts`、`dashboard-access.ts:153`、中间件 `supabase/middleware.ts:97-101`）。
6. 店内禁用会封整个账号（`api/dashboard/staff/[id]/route.ts:66`，启用解封 `:81`）；ops 禁用同样封号并踢会话（`apps/ops/.../staff/[staffId]/route.ts:54-55`）。
7. 删除员工会注销整个 Auth 账号（`staff/[id]/route.ts:174` → `retireStaffAuthUser`）；注销失败的保留分支靠改邮箱释放登录名（`packages/shared/src/staff-user-ban.ts:32-53`）。
8. ops 删店会删光该店所有人的 Auth 账号（`apps/ops/src/lib/purge-restaurant.ts`）。
9. 改角色权限会踢掉该角色所有人的全部会话（`api/dashboard/roles/[id]/route.ts:113-115`），同时已经 `bumpPermissionsVersion`。
10. 重置员工密码会写单店形状的 metadata（`staff/[id]/reset-password/route.ts:51-60`）。
11. ops 员工接口只有列表和禁用/启用，没有新建或关联（`apps/ops/src/app/api/ops/restaurants/[id]/staff/**`）。
12. 店作用域 API：`/api/restaurants/[slug]/**` 已有 40 个 route；`/api/dashboard/**` + `/api/restaurant/**` 有 31 个 route 不带店，前端约 34 处请求调用它们；后台页面 25 个、`/dashboard` 链接约 129 处。
13. 浏览器端直接查库的组件只有 4 个（`RestaurantOnboarding` 插入建店；`CheckoutRequestsProvider`、`TablesManager`、`CheckoutRequestDetailHost` 已带 `restaurant_id` 条件）。
14. 数据库 RLS 函数按「这家店 + 当前用户」判断（`staff_has_restaurant_permission` / `is_active_restaurant_staff` 等），一人多行店籍天然兼容，不用改语义。
15. 店籍行 `login_name` 的读取方：`order-history/resolve-staff-operator.ts`、`audit/resolve-actor.ts:40-50`、`table-party-groups-server.ts:96-101`、`staff-dashboard-api.ts`、`StaffAccountsManager.tsx`、`staff-accounts-list.ts`、`types/index.ts`、`packages/shared/src/print-agent-staff.ts`、ops 员工列表与审计。
16. 概览数据由 `dashboard-overview.ts` 按 `(admin, restaurantId)` 计算，可逐店复用。
17. Realtime 订阅带店过滤（`use-restaurant-realtime-refresh`），不会串推。
18. ops 可以改店 slug（`apps/ops/src/app/api/ops/restaurants/[id]/route.ts:178-206`）。

---

## 5. 数据模型与迁移

### 5.1 表

```text
staff_identities                         -- 新表：员工账号级
  user_id              uuid PK  FK auth.users ON DELETE CASCADE
  login_name           text UNIQUE
  must_change_password boolean not null default false
  created_at, updated_at

restaurant_staff_accounts                -- 店籍
  去掉 user_id 全局唯一 → UNIQUE (restaurant_id, user_id)
  删除 login_name 列（第二步，见 5.3）
  其余列不变：role / role_id / display_name / disabled_at …

restaurants
  owner_id 非空时唯一（partial unique index）
```

- `staff_identities` 每个员工账号一行（含 `print_agent`）；管理员账号没有行。
- RLS：`staff_identities` 不对浏览器开放，只走服务端 admin client。

### 5.2 约束（DB trigger）

| 触发 | 检查 |
|------|------|
| 店籍 insert / update | 该 user 不是任何店的 `owner_id`；该 user 若有 `print_agent` 店籍则不能有第二行；不能把人类员工改成 `print_agent` |
| `restaurants.owner_id` insert / update（含 onboarding、`license-materialize`） | 该 user 在任何店都没有店籍 |

这样员工账号直接调接口建店也会被拒，不用另外收紧建店入口。

### 5.3 迁移步骤（两步，可回滚）

1. **违约预查**（有结果先人工清理）：同一 user 是两家店的 `owner_id`；管理员账号在某店有店籍；`print_agent` 账号多行。
2. **第一步迁移**：建 `staff_identities`，从店籍行回填 `login_name`，从 `user_metadata` 回填 `must_change_password`；放开 `user_id` 唯一、加 `UNIQUE(restaurant_id, user_id)`；加 trigger 和 `owner_id` 唯一。旧 `login_name` 列暂留，代码改为只读新表。
3. **第二步迁移**（第一批代码稳定后）：`rg login_name` 中对店籍行的读取清零后，删店籍行 `login_name` 列。
4. 存量 `user_metadata` 里的 `restaurant_id` / `restaurant_slug` / `staff_role` / `staff_account_id` 读路径一律忽略，新写路径不再写；不批量清理（避免踢掉所有人会话）。

迁移顺序按 `docs/db-migration-runbook.zh.md`：先本地 Docker，再云端。

---

## 6. 当前店与鉴权

### 6.1 当前店从哪来

- **页面**：网址里的 slug。员工 / 厨房已有 `/[slug]/staff…`、`/[slug]/kitchen…`；后台改为 `/dashboard/r/[slug]/…`（推荐，见 §13 待定 1）。
- **接口**：一律放在现有前缀 `/api/restaurants/[slug]/…` 下；31 个 `/api/dashboard/**`、`/api/restaurant/**` route 迁进来，不另开前缀、不用请求头，不长期保留旧路径。
- slug 每次请求解析成 `restaurantId`；解析失败（旧书签、ops 改了 slug）→ 页面回上次所在店或选店页，接口 404。
- **禁止**只信 body 里的 `restaurant_id` 而不核对店籍。

### 6.2 唯一鉴权入口

```text
listAuthorizedRestaurantsForUser(userId)
  → 管理员：名下那一家
  → 员工：所有店籍中「已启用、非 print_agent」的店
  → 每项带 suspended_at；暂停店列出并标暂停，但不作为默认进入的店

loadPrincipalForRestaurant(userId, restaurantId)
  → 管理员且是这家店的 owner_id：权限 *
  → 否则读这家店的店籍：已启用、角色未禁用 → 该角色权限；否则无权
  → 暂停：管理员可只读进入看暂停提示，员工拒绝；写操作沿用现有 suspended 门禁

requirePermission(key, restaurantId)   -- 接口门禁，店参数必填

resolveStaffLoginTarget(loginName)     -- 登录预检
  → staff_identities.login_name → user_id → listAuthorizedRestaurantsForUser
  → 「可进入」为空才拒绝（错误码按全部禁用 / 全部暂停区分）
```

**删除，不留转发壳：** 无参 `loadPrincipalWithCapabilities()` / `loadPrincipal()` / `requirePermission(key)`；`staff-api-auth.ts` 的 `staffSessionForSlug` / `loadStaffCapabilities`；`staff-gate-db.ts` 两个重复的单行查询；`staff-access.ts#preflightStaffLogin` 的单行逻辑；`parseStaffUserMetadata`。删掉无参入口后，漏改的调用点会在 TypeScript 编译时报错。

### 6.3 上次所在店

cookie `mesa_last_restaurant_id`：持久（约 90 天）、HttpOnly、SameSite=Lax，值为 `userId:restaurantId`。只用于登录后默认进哪家；读取时 userId 必须与当前登录一致且该店仍可进入，否则忽略。**不参与任何鉴权。**

---

## 7. 账号级与店级操作

| 操作 | 谁能做 | 实现要点 |
|------|--------|----------|
| 关联到另一家店 / 从某店解除关联（ops 侧） | 只有 ops | ops 员工页新增「关联已有账号」（按登录名，选该店角色）；写平台审计 |
| 在本店新建员工 | 本店「员工管理」权限 | 同时写 `staff_identities` + 店籍行；登录名已存在 → 报「登录名已被占用」（不提示是哪家店的） |
| 改本店角色 / 权限 / 显示名 | 本店「员工管理」权限 | 只改本店店籍行；**不踢会话**（靠 `permissions_version` 生效） |
| 改角色本身的权限 | 本店角色管理权限 | 删掉 `roles/[id]` 里的全局踢会话 |
| 本店禁用 / 启用 | 本店「员工管理」权限（Web 与 ops 同规则） | 只写本店 `disabled_at`；**不碰 Auth 封禁、不踢会话** |
| 本店删除 | 本店「员工管理」权限 | 删本店店籍行；没有剩余店籍时才 `retireStaffAuthUser`，并删 `staff_identities` 行 |
| 重置密码 / 改登录名 | 单店账号：本店「员工管理」权限；**多店账号：本人、ops，或任一关联店的管理员账号** | 设 `staff_identities.must_change_password`；改密后踢该账号全部会话（账号级事件） |
| ops 删店 | ops | 只注销「删店后没有剩余店籍、也不是其他店管理员」的账号；其余只删本店店籍 |
| Auth 封禁 | 只作平台制裁（ops）和注销时使用 | 任何店内操作都不封、不解封 |

**强制改密：** `must_change_password` 读写 `staff_identities`（登录、改密页、中间件），不再走 metadata。

---

## 8. 产品流程

### 8.1 登录

```text
员工：登录名 → resolveStaffLoginTarget 预检 → signIn
管理员：邮箱 → signIn（流程不变）
→ must_change_password 为真 → 改密页（改完继续）
→ listAuthorizedRestaurantsForUser
   0 家：无可进入店铺的提示
   1 家：直接进（写 last cookie）
   N 家：上次所在店仍可进 → 直接进；否则选店页
```

A 店禁用或暂停只让 A 从可进入列表里消失，不影响登录 B。

### 8.2 切店

顶栏店名下拉（只在可进入店 ≥2 时显示）→ 导航到目标店网址 → 更新 last cookie → 页面和 Realtime 随网址重载。两个标签页可以各开一家店。

### 8.3 ops 关联

ops → 某店 → 员工 → 「关联已有账号」：输入登录名、选该店角色 → 新增店籍行。ops 也可在这里解除关联。都写 `writePlatformAudit`。

### 8.4 多店概览页（只读）

- 路径 `/dashboard/multi-store`（推荐，见 §13 待定 2）；不带店 slug，不属于任何一家店。
- 入口：可进入店 ≥2 才在侧栏显示（仅 UX，不是授权）。
- 范围：逐店 `loadPrincipalForRestaurant` + `dashboard.overview.view` 通过的店；店名标签可多选。
- 每家店一行：已收、未收、已结桌/人、在座桌/人（`DashboardTodayKpis` 的 `todayRevenue`、`diningUncollectedAmount`、`todayTableCount`/`todayGuests`、`diningTableCount`/`diningGuests`），加一行合计；营收取不到显示「—」；暂停店标「已暂停」。
- 数据：服务端逐店调 `dashboard-overview` 现有 `(admin, restaurantId)` 计算，数字与单店首页一致；不在浏览器端直查。
- 打开时加载一次 + 手动刷新，不轮询。
- 不新增全局权限 key。

---

## 9. 分批上线

| 批次 | 内容 | 上线后行为 | 验收重点 |
|------|------|-----------|----------|
| **第一批：纯重构** | §5.3 第一步迁移；鉴权合并为 §6.2；后台页面与接口迁入店作用域网址；旧 `/dashboard/*` 与 PWA 启动页跳转；`login_name`、`must_change_password` 读新表；浏览器直查补店条件 | **所有人行为与现在一致**（还没有多店账号） | 单店全流程回归；编译无无店入口 |
| **第二批：开放多店** | 登录选店 / 切店；§7 全部规则（禁用不封号、删除即解除关联、改权限不踢会话、规则 4、ops 删店）；ops 关联界面 | ops 没关联第二家店前仍与单店一样 | 先只给测试账号关联两家店，跑 §11 全部场景 |
| **第三批：概览页** | §8.4 | 多店账号多一个页面 | 数字与各店首页一致 |
| **收尾** | §5.3 第二步：删店籍行 `login_name` 列 | — | `rg` 清零 |

**第一批和第二批必须先后上线、不能拆反：** 放开 `user_id` 唯一（第一批迁移）之后，ops 还没法关联第二家店，所以不会出现多店账号；等第二批的账号级 / 店级规则上线后，ops 才开始关联。

---

## 10. 改动面

| 区域 | 动作 |
|------|------|
| `supabase/migrations` + `docs/ai-schema.md` | §5 |
| `permissions/principal.ts`、`require.ts`、`staff-api-auth.ts`、`staff-gate-db.ts`、`staff-access.ts`、`staff-identity-gate.ts`、`dashboard-access.ts`、`settings-restaurant-auth.ts` | 合并为 §6.2；删除无店入口与重复实现 |
| 42 个调用鉴权的文件（route + page） | 改为带店 |
| `app/dashboard/**`（25 个页面、约 129 处链接）、`lib/dashboard-top-nav.ts`、`lib/dashboard-feature-registry.ts`、`lib/pwa/site-manifest.ts`（启动页） | 迁入 `/dashboard/r/[slug]/…`；旧路径跳转 |
| `api/dashboard/**`、`api/restaurant/**`（31 个 route）+ 前端约 34 处请求 | 迁入 `/api/restaurants/[slug]/…` |
| `lib/supabase/middleware.ts`、`lib/supabase/middleware-session-policy.ts` | 从网址取店；不再读 metadata |
| `auth/post-login-redirect.ts`、`api/auth/login`、`auth/staff-change-password*`、`staff-change-password-gate.ts`、`staff-account.ts` | §8.1；`must_change_password` 读写新表；删 `parseStaffUserMetadata` |
| 选店页、顶栏切店 | 新增 |
| `api/dashboard/staff/**`、`staff-dashboard-api.ts`、`StaffAccountsManager.tsx` | §7；规则 4 在 UI 与接口同时判断 |
| `api/dashboard/roles/[id]` | 删全局踢会话 |
| `packages/shared`：`staff-user-ban.ts`、`print-agent-staff.ts`、`create-restaurant.ts` | 注销时删 `staff_identities`；打印账号写新表；建店受 §5.2 约束 |
| ops：`restaurants/[id]/staff/**`、`purge-restaurant.ts` | 禁用不封号；新增关联 / 解除关联；删店只注销无剩余店籍的账号 |
| `login_name` 读取方（§4 第 15 条） | 改读 `staff_identities` |
| 旁路管理员判定：`checkout-confirm-payment-auth.ts`、`print-agent/receipt-printers/route.ts` | 并入 `loadPrincipalForRestaurant` |
| 浏览器直查（§4 第 13 条） | 确认都带当前店条件 |
| 多店概览页 | 新增 |
| `02-feature-map.md`、`agent-sole-index.zh.md`、测试场景文档 | 落地时同步 |

**不动：** 顾客端；打印 agent 设备配对；RLS 函数语义；权限注册表；管理员账号的登录与 onboarding 流程。

---

## 11. 风险与验收

### 11.1 风险

| 风险 | 控制 |
|------|------|
| **串店**：改完后读写到错误的店 | 删除所有无店鉴权入口，漏改即编译报错；一人两店、两标签页交叉写验收 |
| 单店用户回归 | 一家店直接进、不出现选店；旧链接和 PWA 跳转；第一批纯重构单独上线回归 |
| 迁移失败或数据不一致 | 违约预查；两步迁移，旧列晚删 |
| 禁用不再封号后被禁用的人还能登录 | 登录预检「可进入为空即拒绝」+ 逐请求读店籍 |
| 多店账号被单店员工改密码接管他店 | 规则 4 |
| ops 改 slug 后旧链接失效 | §6.1 回上次所在店或选店页 |
| 概览页逐店计算慢 | 实现时测；店多时再考虑批量，口径仍复用单店计算 |

### 11.2 验收场景

1. 单店员工、单店管理员：登录、各页面、接口与现在一致，不出现选店。
2. 测试账号 ops 关联 A、B 两店：登录出现选店；上次所在店记住。
3. 两个标签页分别在 A、B 写操作，数据各进各店。
4. 该账号在 A 是收银、在 B 是店长：侧栏与可用功能随网址变。
5. 只属于 A 的员工请求 B 的接口：403；改 cookie 无效。
6. A 店禁用该账号：进不了 A，B 正常，登录不受影响；A 暂停同理。
7. A 店删除该账号：只解除 A 关联，B 正常；只剩一家店时删除才注销账号。
8. A 店改某角色权限：该账号在 B 的标签页不被登出。
9. A 店有「员工管理」权限的普通员工不能重置该多店账号的密码、不能改其登录名；A 或 B 的管理员账号可以；ops 可以。
10. ops 删除 A 店：B 店的人（含该多店账号、B 管理员）都能正常登录。
11. 管理员账号被关联为员工、管理员账号再当第二家店的管理员、打印账号被关联到别的店：DB 拒绝。
12. 新员工首次登录强制改密生效（读新表）。
13. 多店概览：只列有概览权限的店，数字与各店首页一致；单店账号看不到入口。
14. 旧 `/dashboard/*` 书签、手机桌面图标：进入上次所在店或选店页。
15. ops 改 A 店 slug：已开的 A 标签页刷新后回到选店或上次所在店，不报错白屏。
16. 顾客扫码点餐、打印 agent 配对与出单：回归正常。

---

## 12. 合理性与难度（评估结论）

- **合理**：符合「一个账号进多家店、每店权限各自配置」；管理员账号模型不变；RLS 本来就按「店 + 人」判断，数据模型只是放开唯一约束 + 登录名上移。
- **难度**：中等偏大。约八成是机械改动（网址和接口带店：25 个页面、约 129 处链接、31 个 route、约 34 处请求）；真正要小心的是鉴权合并（两套入口合一）和账号级 / 店级规则。
- **风险可控**：最大风险是串店，靠「删除无店入口 → 编译期暴露漏改」控制；功能默认不生效（ops 不关联就没有多店账号），可以先用测试账号验证，再给真实账号开。

---

## 13. 待定（实现前由 Will 确认，均已有推荐值）

1. **后台网址形态**：推荐 `/dashboard/r/[slug]/…`（避开 `/dashboard/settings` 等固定段与 slug 冲突；`/[slug]/…` 下已有顾客页 `menu`、`bill`，不混放）。
2. **多店概览网址**：推荐 `/dashboard/multi-store`。

---

## 14. 未核实

- 打印 agent 运行时鉴权是否按 user 推导店（在「打印账号只能一行店籍」约束下预计不受影响）。
- 夜间关台定时任务 `api/cron/nightly-close-sessions`（预计用 service role 按店遍历，不受影响）。
- 129 处 `/dashboard` 链接中有多少是服务端重定向、多少是导航链接，实现时逐个处理。
- 线上是否已有一人当两家店管理员、管理员同时有店籍的存量数据（§5.3 预查）。

---

## 15. 评审历史

- **第 1–4 轮（Claude / Cursor）**：确立「网址即当前店」、账号级 / 店级操作拆分、登录名上移、ops 删店与禁用封号的跨店问题。当时的路线是「管理员账号（`owner_id`）多店 + 员工多店 + 邀请确认」。
- **第 5 轮（Claude，对照代码）**：补出第二套鉴权入口 `staffSessionForSlug`、登录预检单行、metadata 解析器、改密竞态、建店 RLS、封禁多来源、改权限踢会话等。
- **路线修正（Will，2026-11-17）**：管理员邮箱账号是我们自己的后台账号、一店一个，不做多店；多店只针对员工账号（店主 / 店长等角色），由 ops 关联，各店管理员管理其本店权限；管理员都是我们自己，不为防管理员加规则。本稿据此重写，旧稿全文见 git 历史（提交 `4303954d` 及其后工作区版本）。

---

## 16. 给实现者的提醒

- 未获 Will「按方案改」前 **禁止编码**。
- 独立 worktree / 分支；不动旁路 WIP。
- 按 §9 分批；每批清冗余 → 业务场景 + 本地 UAT → `gate.sh check`；commit / merge 仅当 Will 要求。
