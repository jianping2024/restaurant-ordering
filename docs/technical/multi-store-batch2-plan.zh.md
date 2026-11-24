# 多店访问 · 第二批（开放多店）实现计划

> 依据：`docs/technical/multi-store-access-plan.zh.md`（下称「方案」）§3、§6.2–6.3、§7、§8.1–8.3、§11.2。Will 已确认「按方案改」（2026-11-20），2026-11-23 说「开始第二批」。
> 第一批（纯重构）已全部合进 main 并上线。**不要重新分析、不要再问已拍板的事。** 有新发现写进本会话报告，由主会话判断。
> 界面参照可交互原型 `docs/technical/multi-store-prototype.html`（选店页、顶栏切店、ops 批量关联三屏；多店概览是第三批，不做）。

## 0. 已拍板（不要再问）

- 当前店 = 网址 slug：后台 `/dashboard/r/[slug]/…`，接口 `/api/restaurants/[slug]/…`（第一批已落地）。
- 管理员账号（`restaurants.owner_id`）一店一个、不多店；多店只给员工账号，只由 ops 关联。管理员是我们自己，不为防管理员加规则。
- 方案 §3 五条端态规则、§7 操作表全部照做，包括：
  - 本店禁用 / 启用只写本店 `disabled_at`，不碰 Auth 封禁、不踢会话。
  - 本店删除 = 删本店店籍；删的是最后一家店时才注销账号并删 `staff_identities`。
  - 改角色权限不踢会话（靠 `permissions_version` 生效）。
  - 规则 4：多店账号的密码和登录名只能由本人、ops 或任一关联店的管理员账号改。
  - ops 删店只注销「删后无剩余店籍、也不是其他店管理员」的账号。
- 暂停店：员工进不去（方案 §6.2「员工拒绝」，第一批推迟到本批）；管理员仍可只读进入看暂停提示。在可进入列表里灰显、不可进。
- 收藏存店籍行 `favorited_at`（列已由发布 0 迁移建好）；最近进过存浏览器本地；上次所在店 cookie `mesa_last_restaurant_id`（方案 §6.3），只用于选默认店，不参与鉴权。
- 选店页与切店下拉**共用同一个可搜索店铺列表组件**（收藏 → 最近（最多 5）→ 全部按城市、店名；店名 / 城市即时筛选；↑↓ 回车），不做两套。
- 规模按一个账号约 100 家店验收；`listAuthorizedRestaurantsForUser` 一条查询，不逐店查。
- 被否掉的：cookie 表示当前店；邀请确认流程；header 传店；管理员账号多店；本批做多店概览（第三批）。

## 1. 本批新增的约定（主会话 2026-11-23 定）

- 选店页网址 `/dashboard/select-store`（不带店 slug，同 `/dashboard/multi-store` 一样属于无店后台命名空间；静态路由优先于 `dashboard/[...page]`）。
- 收藏接口 `PUT` / `DELETE /api/restaurants/[slug]/favorite`（店作用域，只写本人在本店的店籍行）。
- 员工工作台（`/[slug]/staff…`、`/[slug]/kitchen…`）：可进入店 ≥2 时只加一个「切换店铺」入口跳选店页，不做下拉。
- 多店概览入口本批不出现（第三批再加）。

## 2. 分工（按改哪批文件拆）

| 阶段 | 会话 | 内容 | 依赖 |
|---|---|---|---|
| **2A 账号级与店级规则** | 1 个 | 方案 §7 全表 + §11.2 场景 6–12 的后端与员工管理界面 | 无 |
| **2B 选店与切店** | 1 个，与 2A 并行 | 方案 §8.1、§8.2、§6.3 + 暂停店员工拒绝 + 收藏接口 + 共用店铺列表组件 + 员工工作台「切换店铺」入口 | 无 |
| **2C ops 关联** | 1 个，2A 合进 main 后开 | 方案 §8.3：按登录名关联已有账号、多店勾选、角色名匹配、提交前预览、批量解除关联 | 2A（解除关联复用 2A 的「删店籍 / 末店注销」唯一实现） |
| **收尾** | 主会话 | 合并、清冗余复核、§11.2 场景 2–12、17、19、20 全量回归 | 2A–2C 合进 main |

**文件边界：**
- 2A：`app/api/restaurants/[slug]/staff-accounts/**`、`app/api/restaurants/[slug]/roles/**`、`StaffAccountsManager.tsx` 与员工管理相关组件 / lib（`staff-dashboard-api.ts`、`staff-accounts-list.ts` 等）、`packages/shared` 的 `staff-user-ban.ts` / 店籍删除与注销 helper、ops `restaurants/[id]/staff/**`（禁用不封号）、ops `purge-restaurant.ts`。
- 2B：`lib/permissions/restaurant-access*.ts`、`lib/dashboard-entry.ts`、`lib/legacy-store-api.ts`、`lib/auth/post-login-redirect.ts`、`app/api/auth/login/**`、`app/dashboard/select-store/**`、`app/dashboard/r/[slug]/layout.tsx` 与顶栏组件、新的店铺列表组件、`app/api/restaurants/[slug]/favorite/**`、middleware（写 last cookie 时）、员工工作台头部组件。
- 2C：ops 新增页面 / 接口（`apps/ops/src/app/**` 新文件）、可共用的店籍写入放 `packages/shared`（新文件）；不改 2A 已改的 ops 员工路由，只调用 2A 的删除 helper。
- 两边都想改的文件：先报告主会话，不要各改一半。

**合并顺序：** 2A、2B 谁先完成谁先合；后合的一方 rebase。2C 在 2A 合进 main 后基于 main 开工。

## 3. 已核实的代码事实（2026-11-23，main `a9e99be9`）

- 鉴权入口：`apps/web/src/lib/permissions/restaurant-access.ts` — `listAuthorizedRestaurantsForUser`（:71，暂停店列出并排最后）、`loadPrincipalForRestaurant`（:84，暂停店目前放行）、`resolveStaffLoginTarget`；规则纯函数在 `restaurant-access-rules.ts`（`suspended_at` 排序 :158，登录预检错误码 :165–170）。
- 无店入口：`lib/dashboard-entry.ts` `pickEnterableStore` 取第一家（:20）；`resolveDashboardEntry` 供 `/dashboard`、旧书签、PWA 启动页；`lib/legacy-store-api.ts:21` 旧接口别名同样取第一家。
- 登录后跳转：`lib/auth/post-login-redirect.ts` `resolvePostLoginRedirect`（:22），员工走 `staffLandingPathFromCapabilities(slug, capabilities)`（:87）。
- 店内禁用仍封号踢会话：`app/api/restaurants/[slug]/staff-accounts/[id]/route.ts:70-71`（`setStaffUserBanned` + `kickStaffUserSessions`）；启用 / 改角色 :138 踢会话；删除 :170 踢会话、:187 `retireStaffAuthUser` 注销整个账号。
- 重置密码：`staff-accounts/[id]/reset-password/route.ts`（POST）踢会话，未判断规则 4。
- 改角色权限踢该角色所有人：`app/api/restaurants/[slug]/roles/[id]/route.ts:120`。
- ops 禁用封号踢会话：`apps/ops/src/app/api/ops/restaurants/[id]/staff/[staffId]/route.ts:61`。
- ops 删店删光该店所有人的 Auth 账号：`apps/ops/src/lib/purge-restaurant.ts:173`。
- 收藏列 `restaurant_staff_accounts.favorited_at` 已存在（迁移 `20261120130000`）；DB trigger 已拒「管理员有店籍 / 管理员两店 / 打印账号多店」（迁移 `20261120120000`）。
- 本地测试店：白云自助火锅 `restaurant-mohnrib5`，员工 `qiantai1`；UAT 脚本 `scripts/mesa-local-uat.mjs`。多店测试账号需要自己在本地种：再建一家测试店，把同一员工账号用 SQL 关联进去（2C 落地前只能这样）。

## 4. 每个会话的通用要求

- 按 skill `token-saving-delivery` 执行；独立 worktree，分支基于最新 main；不碰共享 checkout，不动别人的 WIP；本地端口和 `MESA_NEXT_DIST_DIR` 用自己的（见记忆「Parallel work」「Build vs running dev」「UAT env quirks」：worktree 的 `.env.local.dev` 局域网 IP 要改成 `127.0.0.1`）。
- 实现 + 单测用主模型；lint / typecheck / 单测可交给 haiku 子代理，只回 exit code 与 FAIL；浏览器 UAT 交 sonnet 子代理。
- 有迁移：新时间戳迁移，先本地 Docker 跑通（`db push --local --include-all`），更新 `docs/ai-schema.md`；on-prem baseline 需要时一并刷新。
- 门禁：清冗余 `scan.md` → `gate.sh scan` → 证据（含 `mesa-local-uat`）→ `gate.sh uat` → `gate.sh check`。
- 行为验收：
  - 单店员工、单店管理员与现在一致，不出现选店。
  - 本阶段对应的 §11.2 场景逐条过：2A 是 6–12；2B 是 2、3、4、5、14、15、17；2C 是 19 + 关联后场景 2。
- 只 commit 到自己的分支；**不合并 main、不 push**；完成后报告分支名与 commit SHA，由主会话合并。
- 遇到方案没覆盖、或与代码事实冲突：写进报告并停在那一步，不自行改方案。
- 落地时同步 `docs/agent-sole-index.zh.md` 对应领域一行（如「唯一店铺列表组件」「唯一店籍删除 / 注销 helper」）。
