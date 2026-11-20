# 多店访问 · 第一批（纯重构）实现计划

> 依据：`docs/technical/multi-store-access-plan.zh.md`（下称「方案」），已由 Will 确认「按方案改」（2026-11-20）。
> **不要重新分析、不要再问已拍板的事。** 有新发现写进本会话报告，由主会话判断。

## 0. 已拍板（不要再问）

- 当前店 = 网址 slug。后台 `/dashboard/r/[slug]/…`；多店概览 `/dashboard/multi-store`（第三批做）。接口统一 `/api/restaurants/[slug]/…`，不用 header、不另开前缀。
- 管理员账号（`restaurants.owner_id`）一店一个、不多店；多店只给员工账号，只由 ops 关联（第二批做）。
- 第一批 = **纯重构**：上线后所有人行为与现在一致；不出现选店、切店、多店概览、ops 关联。
- 被否掉的：cookie 表示当前店；邀请确认流程；header 传店；管理员账号多店；逐店串行计算概览。

## 1. 第一批范围（方案 §9 第一批）

1. 迁移第一步（方案 §5.1–5.3）：`staff_identities`（含 `must_change_password`、`favorite_restaurant_ids`）、回填、放开 `user_id` 唯一改 `UNIQUE(restaurant_id,user_id)`、trigger、`owner_id` 部分唯一；旧 `login_name` 列暂留。违约预查脚本。
2. 唯一鉴权入口（方案 §6.2）：`listAuthorizedRestaurantsForUser`、`loadPrincipalForRestaurant`、`requirePermission(key, restaurantId)`、`resolveStaffLoginTarget`；合并 `staffSessionForSlug` / `loadStaffCapabilities` / `staff-gate-db` 重复查询；删 `parseStaffUserMetadata`。
3. 后台页面迁入 `/dashboard/r/[slug]/…`（25 页、约 129 处链接、`dashboard-top-nav`、`dashboard-feature-registry`、PWA `site-manifest` 启动页）；旧 `/dashboard/*` 跳转到上次所在店（第一批人人只有一家店，即跳到自己的店）。
4. 接口迁入 `/api/restaurants/[slug]/…`（`/api/dashboard/**` + `/api/restaurant/**` 共 31 个 route，前端约 34 处请求）。
5. service role 店 id 来源（方案 §6.2）：110 个 `createAdminClient` 文件审计（其中 67 个 API route，随网址迁移一起改）；**品牌类型 `AuthorizedRestaurantId` 强制**（只有 `loadPrincipalForRestaurant` 产生），lint 规则或检查脚本只作补充，接入 `gate.sh check`。
9. 回滚兼容（方案 §5.4）：新旧两边都写、只读新的；旧接口地址保留一个版本周期（调用同一实现）；发布 0（反向跳转 + 同步 trigger + `favorited_at`）由 A2 会话做。
6. `login_name` / `must_change_password` 改读新表；登录预检、改密门禁、中间件不再读 metadata。
7. on-prem（方案 §5.3 后段）：升级前违约预查、刷新 baseline、全新安装 + 增量升级验收。
8. 浏览器直查补店条件（方案 §4 第 13 条）。

## 2. 分工（顺序）

**拆分原则：** 按「改的是哪一批文件」拆，不按技术层拆。页面、接口、前端请求、admin client 店 id 来源在同一批文件里交织（组件里既有 `<Link>` 又有 `fetch`，route 里既要搬路径又要改店 id 来源），按层拆会让多个会话改同一个文件；而网址迁移是同一种机械套路，一个会话做完上下文最省。账号表 / 登录和 on-prem 与网址迁移基本不碰同一批文件，适合并行。

| 阶段 | 会话 | 内容（对应 §1） | 依赖 |
|---|---|---|---|
| A 地基 | 1 个 | §1-1 迁移 + §1-2 新鉴权入口（**新增**带店入口与 `resolveStaffLoginTarget`；旧无参入口本批暂留，标 `@deprecated`，阶段 C 删除）+ 违约预查脚本 | 无 |
| B1 网址迁移 | 1 个 | §1-3 页面 + §1-4 接口 + 前端请求 + §1-5 admin client 店 id 来源与 lint 规则 + §1-8 浏览器直查 + middleware 从网址取店 / 不读 metadata。先做脚手架（`/dashboard/r/[slug]` 布局、页面与接口路径 helper、导航、旧网址跳转、PWA），再逐个领域迁移 | A 已合进 main |
| B2 账号表与登录 | 1 个，与 B1 并行 | §1-6：登录预检 `resolveStaffLoginTarget` 接入、改密页 / 改密门禁、`must_change_password` 读写新表、删 `parseStaffUserMetadata` 的调用方、非路由的 `login_name` 读取方（`staff-dashboard-api.ts`、`resolve-actor.ts`、`resolve-staff-operator.ts`、`table-party-groups-server.ts`、`print-agent-staff.ts`、`StaffAccountsManager.tsx` 等） | A 已合进 main |
| B3 on-prem | 1 个，与 B1 并行 | §1-7：升级前违约预查、刷新 baseline、全新安装 + 增量升级验收 | A 已合进 main |
| C 收尾 | 主会话 | 删除旧无参入口（编译期暴露漏改）、清冗余、门禁、本地 UAT、合并 | B1–B3 合进 main |

**文件边界：** B1 动 `app/dashboard/**`、`app/api/dashboard/**`、`app/api/restaurant/**`、`app/api/restaurants/[slug]/**`、组件里的 `<Link>` / `fetch` 路径、`lib/dashboard-top-nav.ts`、`lib/dashboard-feature-registry.ts`、`lib/pwa/**`、`lib/supabase/middleware*.ts`、lint 配置；B2 只动 auth / staff-account / staff-access / staff-identity-gate / change-password 相关与上表列出的 `login_name` 读取方，**不改任何路由路径**；B3 只动 `deploy/on-prem/**`。若 B1 搬动的 route 文件内容也被 B2 改了，后合并的一方 rebase 解决（git 能识别改名）。

**阶段 C 追加（B1 发现，主会话 2026-11-20 判定）：**
- `/api/print-agent/*` 8 个后台 session route（settings、devices、devices/[id]/revoke、pairing、pairings/[id]/revoke、bill-receipt-printer、print-jobs/[id]/retry、print-jobs/recent）迁入 `/api/restaurants/[slug]/print-agent/…`，处理 middleware bypass，删 `requireSettingsRestaurantAuth` 无店重载。
- 品牌类型规则细化：写操作与员工私有读取收 `AuthorizedRestaurantId`；顾客公开读取用 `PublicRestaurantId`（只由公开 slug 解析器产生）；员工路由换成 `loadPrincipalForRestaurant` 后铺开。
- 合并 `staff-api-auth.loadRestaurantBySlug` 与 `staff-gate-db.loadRestaurantRefBySlug` 为一个。
- 修 `npm run test:unit` 列表（含 main 上 `ec287e5e` 已删的 `bill-sync-content-unchanged.test.ts`）。
- 暂停店：第一批保持现网行为（已登录员工看到后台 + 暂停横幅，写操作被既有门禁拒），方案 §6.2「员工拒绝」推迟到第二批。

**合并顺序：** B3 → B2 → B1（B1 最大，最后 rebase 一次）。

**B1 过大时：** 脚手架完成并提交后，B1 可以按领域再分出第二个会话（如「菜单 / 自助餐」与其余），但必须在脚手架合进 B1 分支之后，且两边不改同一领域。

## 3. 每个会话的通用要求

- 独立 worktree，分支基于最新 main；不碰共享 checkout，不动别人的 WIP；本地端口 / `MESA_NEXT_DIST_DIR` 用自己的（见记忆「Parallel work」「Build vs running dev」）。
- 实现 + 单测用主模型；跑 lint/typecheck/单测可交给 haiku 子代理，只回 exit code 与 FAIL。
- 有迁移：先本地 Docker 跑通（`db push --local --include-all`），更新 `docs/ai-schema.md`。
- 门禁：清冗余 `scan.md` → `gate.sh scan` → 证据（含 `mesa-local-uat`）→ `gate.sh uat` → `gate.sh check`。浏览器 UAT 交 sonnet 子代理。
- 行为验收：单店员工、单店管理员登录与各页面、接口与现在一致；地址栏变为新网址；旧网址跳转。
- 只 commit 到自己的分支；**不合并 main、不 push**，完成后报告分支名与 commit SHA，由主会话合并。
- 遇到方案没覆盖、或与代码事实冲突：写进报告并停在那一步，不自行改方案。

## 4. 已核实的代码事实（入口）

见方案 §4（18 条，均附文件:行）。关键：两套鉴权 `principal.ts` / `staff-api-auth.ts:125-175`；`[slug]/kitchen/page.tsx` 混用；`staff-access.ts:87-127` 登录预检；`staff-account.ts:141-157` metadata 解析；`/api/restaurants/[slug]/**` 已有 40 个 route。
