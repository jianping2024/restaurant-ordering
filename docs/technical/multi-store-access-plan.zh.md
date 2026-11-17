# 多店访问与老板汇总 — 技术方案（待 Claude / Will 评审）

> **状态**：草案 · 未编码 · 2026-11-17  
> **发起**：Will（老板有多家店，要看多店数据）  
> **作者建议**：Cursor Auto（本文件）  
> **评审请重点看**：§2 端态、§3 模型、§6 分期、§9 待决  
> **关联**：`docs/product/02-feature-map.md`（「多门店连锁总部账号」现为「当前不做」）、`docs/ai-schema.md`（`restaurant_staff_accounts` / `restaurants.owner_id`）、`apps/web/src/lib/staff-gate-db.ts`、`docs/role-permissions-architecture.zh.md`

---

## 0. 一句话结论

**一个登录账号 → 多店店籍（每店独立角色/权限）→ 会话里只有一个「当前店」做经营操作 → Dashboard 另开「有权店」汇总。**  
不上集团/连锁总部层；不给每家店单独账号；不把「店列表」做成员工表上的旁路配置字段。

---

## 1. 背景与目标

### 1.1 业务动机

- 有的老板开了多家店，需要用**同一账号**看到几家店的经营数据。
- 店员通常仍只在一家店干活；偶发「同一人管两家」时，需要能**切店**，而不是再注册一个号。

### 1.2 目标（本方案范围）

1. 同一 `auth.users` 可关联多家 `restaurants`（店籍）。
2. 登录后选择（或恢复）**当前店**；楼面 / 厨房 / 结账 / 设置 / 单店报表只认当前店。
3. 老板（及获授权的人）在 Dashboard 能看**多店汇总**（筛选 + 合计），并可点进某一店的现有单店页。
4. 租户隔离不放松：无权店不可读不可写；API 以服务端校验「当前店 ∈ 店籍」为准。

### 1.3 非目标（明确不做）

| 不做 | 理由 |
|------|------|
| 集团 / 品牌 org 表、总部角色、跨店统一菜单/结算 | 当前痛点是「几个独立店 + 同一人看数」，不是连锁中台 |
| 厨房 / 结账 / 楼面「一次看多店混合实时」 | 与现有单店 Realtime、打印、会话生命周期冲突大 |
| 每店一个登录账号当默认方案 | 老板体验差，审计与权限难统一 |
| 仅 UI 挂「可访问店列表」、库仍 `user_id` 唯一 | 假开通，门禁仍只认一家 |
| 改动顾客点餐 / 桌码 / print-agent 设备模型 | 顾客与设备天然单店 |

### 1.4 已否决的并列选项（勿在评审里当等价方案重提）

1. **只做选店、不做汇总** — 老板仍要开很多标签页比数，达不到「看到几个店的数据」。
2. **先做 org 再做店籍** — 过度设计；店籍 + 当前店已够本期。
3. **owner 继续 `maybeSingle`、员工另开多店** — 老板恰恰是多店主体，店主路径必须一并改为列表。

---

## 2. 端态形状（Best practice · 唯一推荐）

改完后，业务概念只保留这四种写法：

| 概念 | 唯一表示 | 说明 |
|------|----------|------|
| **身份** | `auth.users` 一条 | 邮箱 / 员工登录名进同一人 |
| **店籍** | 「用户 ↔ 餐厅」多行关系，每行带本店角色/权限来源 | 店主拥有的店与员工受雇的店都进入**同一可读店列表**（来源字段可区分） |
| **当前店** | 会话中的一个 `active_restaurant_id`（cookie / server session） | 经营面全部只认它；切店 = 改这个值并重绑 Realtime |
| **多店汇总范围** | Dashboard 查询参数 / 页级筛选：`restaurant_ids ⊆ 有权店` | 只用于读模型汇总；写操作仍必须落在当前店或显式单店 API |

**一句话端态：** 人可以有很多店；同一时刻只能在一家店里干活；看数时可以按有权店集合汇总。

---

## 3. 当前事实（已证实）

依据可核对，不是推测：

1. `restaurant_staff_accounts.user_id` **全局唯一**（`docs/ai-schema.md`）→ 一人不能挂多店员工行。
2. `loadStaffGateAccountForUser` / `loadOwnerRestaurantForUser` 均对用户用 **`maybeSingle()`**（`apps/web/src/lib/staff-gate-db.ts`）→ 应用层假定一人一店。
3. 店主权限是 `restaurants.owner_id` 路径上的 `*`，员工走 `restaurant_roles.permissions`（既有 capability 体系）。
4. 产品地图将「多门店连锁总部账号」列在 **当前不做**（`docs/product/02-feature-map.md`）。
5. 业务数据与 RLS 均以 `restaurant_id` 为租户边界（保持不变，本方案只扩展「谁能进哪些店」）。

---

## 4. 数据与门禁模型

### 4.1 店籍（推荐）

**优先复用并扩展 `restaurant_staff_accounts`，而不是另建平行 membership 表。**

| 变更 | 内容 |
|------|------|
| 唯一约束 | 去掉 `user_id` 全局唯一；改为 **`UNIQUE (restaurant_id, user_id)`** |
| 登录名 | 保持 `login_name` 平台唯一（现状）；一人多店共用同一登录名 / 同一 `user_id` |
| 每店角色 | 现有 `role` / `role_id` 继续表示**该店**权限；允许同一人在 A 店是 owner 员工预设、在 B 店是 frontdesk |
| 店主 | **方案 A（推荐评审）**：`restaurants.owner_id = user` 的店自动进入有权列表（capability `*`），**不强制**为店主再插 staff 行；有权列表 = `owned restaurants ∪ staff rows`。**方案 B**：店主也落 staff 行 `role=owner`——与历史「店主 ≠ staff 行」（`role-permissions-architecture.zh.md`）冲突，不推荐除非评审明确要统一表 |

`login_name` 与多店：一人一个 `user_id`，多行 staff 共用同一 `user_id`；`login_name` 仍在账户级唯一（需确认现表是账户级还是「每行一 login」——现状是表级 `login_name unique`，多行同 user 时 **login_name 只应出现在「主账户」行或改为账户级字段**）。  
**评审点：** 多行 staff 是否允许每行不同 `login_name`？（建议：**不允许**；`login_name`/`display_name` 以 user 为准，或仅第一行持有，其余行继承。实现前在迁移设计里写死一种。）

### 4.2 当前店

| 项 | 建议 |
|----|------|
| 存储 | HttpOnly cookie（或现有 supabase session 旁路 cookie）如 `mesa_active_restaurant_id` |
| 校验 | 每个需租户的请求：解析用户 → 有权店列表 → `active ∈ 列表`，否则 403 或强制回选店页 |
| 默认 | 登录后：若仅 1 家 → 直接写入；若多家且 cookie 仍有效且仍有权 → 复用；否则进选店页 |
| 切店 | 顶栏切换 → 写 cookie → 软导航到该店默认落地页；客户端 Realtime 退订旧店、订新店 |

**禁止：** 仅信 URL slug / body 里的 `restaurant_id` 而不核对店籍。slug 路由仍可用，但必须 `slug → id ∈ 有权店`。

### 4.3 有权店列表（sole helper）

新增唯一服务端函数（命名示例）：

```text
listAuthorizedRestaurantsForUser(userId) →
  [{ restaurantId, slug, name, source: 'owner' | 'staff', role?, capabilities... }]
```

所有「选店 / 切店 / 汇总范围 / 门禁」只消费这个列表；**禁止**第二套「员工配置店 id 数组」字段。

### 4.4 门禁改造要点

将下列「取一家」改为「列表 + active」：

- `loadOwnerRestaurantForUser` → `listOwnedRestaurantsForUser` + `resolveActiveRestaurant`
- `loadStaffGateAccountForUser` → 按 `active_restaurant_id` 取**该店** staff 行（或 owner 短路）
- middleware / `dashboard-access` / `requirePermission` 路径：principal 绑定 **(user, activeRestaurant)**

Principal 端态建议：

```text
Principal = {
  userId,
  restaurantId,           // = active
  kind: 'owner' | 'staff',
  capabilities,
  authorizedRestaurantIds // 或懒加载，但切店 UI 需要
}
```

---

## 5. 产品流程

### 5.1 登录

```text
登录成功
  → listAuthorizedRestaurants
  → 0 家：错误页（无店籍）
  → 1 家：设 active → 原 post-login redirect
  → N 家：选店页 → 设 active → redirect
```

### 5.2 切店（已登录）

- 入口：Dashboard / 员工壳顶栏「当前店」下拉（仅授权店）。
- 切店后：离开旧店经营页；Realtime 重绑；本地仅单店草稿（如结账 draft）按店+session 分区的保持不动，**不**跨店复用。

### 5.3 员工管理（设置）

- 「添加员工到本店」= 在**当前店**插入/启用一条 `(restaurant_id, user_id)` 店籍。
- 同一人已在别店：支持「关联已有账号到本店」（按 login_name / email 查找 `user_id`，再插本店行），而不是再注册 Auth 用户。
- 禁用：按**本店** `disabled_at`；不影响其他店籍。

### 5.4 老板多店汇总（Dashboard）

**范围（V1 建议最小集）：**

| 能力 | V1 |
|------|-----|
| 有权店列表 + 多选筛选（默认全选有权店） | ✅ |
| 今日已收 / 未收 按店分行 + 合计 | ✅（复用现有单店口径函数，按店循环再加总；**不**新造第二套营收公式） |
| 点店名进入该店现有 Dashboard（并设 active） | ✅ |
| 增值分析多店对比 | 可 V1.1；V1 可只做「先切店再看现有页」 |
| 跨店写操作（改菜单、关台等） | ❌ 必须先切到该店 |

口径约束（对齐 AGENTS sole）：

- 未收：继续 `liveSessionUncollectedAmount` 等现有公式，按店计算后展示。
- 禁止为汇总再写一套「用 floor sessionTotal 相加」的平行口径。

---

## 6. 分期

| 期 | 交付 | 可独立验收 |
|----|------|------------|
| **P0** | 库约束 + `listAuthorizedRestaurants` + active cookie + 登录选店 + 顶栏切店；经营 API/中间件按 active 校验 | 一人两店可登录、切换，各店楼面数据不串 |
| **P1** | 设置里「关联已有账号到本店」；本店禁用不影响他店 | 同一 login 两店不同角色 |
| **P2** | Dashboard 多店今日汇总卡（筛选+合计+下钻） | 老板一屏看两店今日已收/未收 |
| **P3（可选）** | 增值分析等多页的店筛选 | 非阻塞 P0–P2 |

**编码前：** 仍走 analyze → Will 确认 → feature branch；本文件评审通过后再动库。

---

## 7. 主要改动面（供评审估工作量）

| 区域 | 代表路径 | 动作 |
|------|----------|------|
| 迁移 | `supabase/migrations/*_multi_store_staff_membership.sql` | 改唯一约束；必要时 login_name 策略；回填无 |
| Schema 文档 | `docs/ai-schema.md` | 同步约束与语义 |
| 门禁 | `staff-gate-db.ts`、`staff-identity-gate.ts`、`dashboard-access.ts`、`permissions/resolve.ts`、middleware | 列表 + active |
| 登录 UX | staff/owner login、post-login-redirect、新选店页 | 1 店跳过 / N 店选择 |
| 壳 UI | Dashboard 顶栏 / 员工壳 | 当前店切换 |
| 员工 CRUD API | dashboard staff routes | 支持关联已有 user；按店禁用 |
| 汇总 UI | dashboard home / 今日营收相关 | P2 |
| 产品地图 | `02-feature-map.md` | 「多门店」从不做改为本方案范围 |
| Realtime | 员工 board / kitchen hooks | 切店退订/重订（无轮询） |
| 测试 | `staff-access.test.ts` 等 + `mesa-local-uat` + 业务场景文档 | 见 §8 |

**稳定点（尽量不翻）：** 顾客 anon 路径、print-agent 设备一对店、RLS 按 `restaurant_id` 的表结构、capability 注册表 key 集合（除非汇总页要新 permission）。

---

## 8. 风险与验证

### 8.1 风险

| 风险 | 缓解 |
|------|------|
| 串店读写 | 服务端强制 `active ∈ authorized`；UAT 用两店账号交叉打 API |
| 大量 `maybeSingle` 店主/员工假设残留 | P0 以 `rg` 扫 `owner_id`+`maybeSingle`、`loadOwnerRestaurant`、`loadStaffGate` 调用点列清单，逐个改 |
| on-prem shadow `admin` | 单独规则：本机认领店仍单店；与 cloud 多店账号测试隔离 |
| Realtime 切店后仍收旧店事件 | 切店流程必须 teardown channel；UAT 两浏览器/两店对照 |
| login_name 多行冲突 | §4.1 评审锁定一种模型后再迁 |
| 汇总口径漂移 | 只复用单店 sole 公式聚合 |

### 8.2 验收场景（评审可增删）

1. **一人一店**：行为与现在一致（无选店页）。  
2. **老板两店**：登录 → 选 A → 看 A 楼面；切 B → 只见 B；A 的单不出现在 B。  
3. **员工只绑 A**：列表无 B；手改 cookie / 调 B 的 API → 403。  
4. **同一人 A 店收银、B 店服务员**：角色/侧栏随 active 变。  
5. **A 店禁用该员工**：不能再进 A；B 仍可。  
6. **P2**：汇总页两店今日已收/未收与分别进单店页数字一致。  
7. **回归**：顾客扫码、单店结账、打印配对不受影响。

---

## 9. 请 Claude / Will 评审的待决项

请直接表态同意 / 反对 / 改写：

1. **店主店籍：** 采用方案 A（`owner_id` 并入有权列表，不强制 staff 行）还是方案 B（店主也落 staff 行）？  
2. **`login_name`：** 多店多行时，登录名是否必须全局一人一个、禁止每行不同？  
3. **P2 汇总最小集：** 是否只做「今日已收/未收按店 + 合计」，增值分析留 P3？  
4. **cookie 名与寿命：** 是否接受 `mesa_active_restaurant_id` + 与登录会话同寿？  
5. **权限 key：** 多店汇总是否新加 `dashboard.multi_store.view`，还是「有权店数 ≥ 2 且具备现有今日营收类能力即可」？  
6. **on-prem：** 是否确认 Mode B 本阶段仍单店、不允许多店同机账号切换？

---

## 10. 文档与产品同步（落地时）

- 更新 `docs/product/02-feature-map.md`：多门店条目改为「店籍 + 当前店 + 老板汇总（无集团层）」。  
- 更新 `docs/ai-schema.md` 约束说明。  
- 业务场景落盘：`docs/test-scenarios/YYYY-MM-DD-multi-store-access.md`（编码后）。  
- sole 索引：若新增 sole helper，在 `docs/agent-sole-index.zh.md` 对应域加一行。

---

## 11. 评审结论栏（Claude · 2026-11-17）

| 项 | 结论（通过 / 修改后通过 / 驳回） | 备注 |
|----|--------------------------------|------|
| 端态（§2） | 修改后通过 | 四个概念的分法没问题。但「当前店」现在有两种表示：cookie，以及员工/厨房页 URL 里的 slug（`/[slug]/staff`、`/[slug]/kitchen`），违反 sole 规则。cookie 还被所有标签页共享：老板标签 1 开 A 店、标签 2 切到 B 店，之后标签 1 的写请求会写进 B 店。**端态**：当前店只认 URL 里的 slug（Dashboard 也改到店的作用域下）；每个经营请求都带上店，服务端按 `loadPrincipal(user, restaurantId)` 逐请求校验店籍；切店就是页面导航，页面卸载时 Realtime 自然重绑。§1.2.4 要写清两层隔离：数据库 RLS 管「是不是这家店的人」，应用层管「当前在哪家店」；RLS 不认当前店。 |
| 店籍模型（§4.1） | 修改后通过 | 店主用方案 A，对齐 role-permissions「店主 ≠ staff 行」。**登录名必须上移到账户级**：员工登录邮箱 = `buildStaffEmail(login_name)`，它本来就是 `auth.users` 的属性。「只放第一行、其余行继承」驳回。端态：新建账户级表（如 `staff_identities(user_id PK, login_name UNIQUE)`），店籍行删掉 `login_name`；`display_name` 留在店籍行（店内称呼、操作人快照）。加约束：`print_agent` 设备账号只能有一条店籍。措辞：员工预设角色 `owner` 与店主（`restaurants.owner_id`）是两回事，文档要分开写。 |
| 当前店（§4.2） | 修改后通过 | 当前店的权威来源改为 URL（见上）。cookie 改名 `mesa_last_restaurant_id`，只决定登录后默认进哪家店。校验只查一条 `(user, restaurant)` 是否存在，不在 Edge middleware 里每次拉整个列表。 |
| 分期（§6） | 修改后通过 | 迁移改唯一约束后，P0 就已允许一人挂两店，所以下方「遗漏风险 1–3」的账户级/店级拆分**必须与 P0 迁移同批交付**，否则 P1「关联已有账号」一开就有跨店接管。P1–P3 不变。 |
| 非目标（§1.3） | 通过 | `print_agent` 单店籍约束只是本方案带出的结果，不算改设备模型。 |
| 待决（§9）建议答案 | 见下 | |

### §9 建议答案

1. **店主店籍**：方案 A。有权店 = 名下的店 ∪ 已启用且非 `print_agent` 的店籍行。用约束禁止给店主在自己店里插 staff 行，避免一家店出现两种身份。
2. **login_name**：是，一人一个，账户级全局唯一，迁到账户级表（见 §4.1）。
3. **P2 汇总最小集**：同意。只做今日已收/未收按店分行 + 合计 + 点进单店；口径直接复用 `dashboard-overview.ts` 的单店 sole 函数按店调用，不另写汇总公式。增值分析留 P3。
4. **cookie**：不承载当前店，只作「上次所在店」的落地默认（名称、用法见 §4.2），寿命同登录会话。
5. **权限 key**：不新加 `dashboard.multi_store.view`。汇总范围 = 有权店中在**该店**有 `dashboard.overview.view` 的店（店主为 `*`）。「≥ 2 店」只决定是否显示汇总入口，不是授权判定。新 key 会变成不属于任何店的全局权限，与逐店 capability 模型冲突；把「店数 ≥ 2」当授权条件就是 AGENTS 禁止的平行白名单。
6. **on-prem**：确认 Mode B 本阶段只支持单店。`listAuthorizedRestaurantsForUser` 在 on-prem 下只返回已认领的那一家；影子 `admin` 仍走 `loadClaimedOnPremRestaurant`。

### 遗漏的调用点风险（已在代码中核对）

1. **改密码会跨店接管（严重）**：`api/dashboard/staff/[id]/reset-password` 用 `auth.admin.updateUserById` 改的是全局账号密码。A 店有员工管理权的人能重置同一人在 B 店用的密码；若此人是 B 店店主，等于接管 B 全店。端态：只有当此人全部店籍都在操作者有 `settings.staff.manage` 的店里、且此人不是任何店的店主时，才允许店内重置；否则只能本人改或走平台。
2. **删员工会断掉他在别店的登录（严重）**：`DELETE staff/[id]` 调 `retireStaffAuthUser` 删除或封禁 Auth 用户。端态：只删本店店籍行；仅当这是最后一条店籍且此人不是任何店的店主时，才退役 Auth 用户。
3. **改角色会踢掉所有店的会话**：`PATCH staff/[id]` 用 `staffMetadataPayload` 把 `restaurant_id / restaurant_slug / staff_role / staff_account_id` 写进 `user_metadata`（单店形状），再用 `kickStaffUserSessions` 踢掉全部会话。端态：metadata 不再存店和角色（principal 只信 DB，role-permissions 已要求）；踢会话只用于账户级事件。
4. **§7 门禁清单不全**：
   - `staff-gate-db.ts` 里 `loadStaffGateByUserId` 与 `loadStaffGateAccountForUser` 是同一查询的两份，先合并成一个再改；
   - 还要改：`staff-api-auth.ts:137`、`permissions/principal.ts`、`staff-access.ts:100`（按 login_name 查，迁表后变账户查询）、`auth/post-login-redirect.ts`、`staff-change-password*.ts`、`api/auth/login/route.ts`；
   - `checkout-confirm-payment-auth.ts:77`、`print-agent/receipt-printers/route.ts:48` 自己用 `slug + owner_id` 判定店主，绕开 `requirePermission`，是第二套门禁，应并入；
   - 员工创建 `api/dashboard/staff/route.ts` 每次都新建 Auth 用户；「关联已有账号」改造这一个入口，不在旁边另开。
5. **§3 漏了一条能降风险的事实**：RLS 函数 `staff_has_restaurant_permission`、`is_active_restaurant_staff`、`assert_restaurant_session_operator` 都按「这家店 + 当前用户」查店籍，一人多行天然兼容，数据库层不用改。`audit/resolve-actor`、`order-history/resolve-staff-operator`、`table-party-groups-server`、`permissions/restaurant-roles` 已按店过滤，也不用改。

**总评：修改后再评，暂不进入实现。** 必须改的 5 条：

1. 当前店只认 URL，cookie 降级为落地默认（§2 / §4.2）；
2. 账户级操作与店籍级操作拆开（改密 / 删除 / metadata / 踢会话），写进 §4 并列入 P0；
3. `login_name` 上移账户级表，迁移方案写死；
4. 按上文补全 §7 调用点清单，并合并 gate 的两份查询；
5. §3 补上「RLS 已兼容多行」事实与两层隔离写法。

改完只需复核 §2、§4、§6，其余部分本轮已通过。

---

## 12. 给实现者的提醒（评审通过后）

- 未获 Will「按方案改」前 **禁止编码**。  
- 开独立 feature branch / worktree；不动旁路 WIP。  
- 实现后：清冗余 → 业务场景报告 + localhost UAT → `gate.sh check`；commit/merge 仅当 Will 要求。
