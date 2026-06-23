# Mesa 平台运营后台（Platform Admin）实施计划

> **状态**：规划稿（2026-06-23）  
> **受众**：Mesa 团队内部运营 / 技术支持  
> **与租户侧关系**：本系统 **不是** 店主 `/dashboard`，也 **不是** 厨房 / 服务员入口；见 [`research.md`](../research.md) §1.1。

## 1. 背景与目标

当前开新店、代建店主账号依赖 **独立页面** `/auth/admin/register` + 环境变量 **`ADMIN_BOOTSTRAP_SECRET`** + API **`POST /api/admin/create-restaurant`**（service role）。该方式适合冷启动，但 **无法**：

- 登录后浏览、检索已入驻餐厅；
- 代客重置店主密码、暂停门店服务；
- 跨店查看打印代理与队列，远程吊销设备凭证；
- 记录「谁在何时做了什么」供审计与纠纷处理。

**目标**：建设 **Mesa 平台运营后台**（下文简称 **运营后台**），统一上述能力；逐步 **收口** 裸注册页，仅保留受控 bootstrap 或完全下线。

## 2. 角色与边界（已定）

| 维度 | **平台运营** | **店主 `/dashboard`** | **店内员工** |
|------|----------------|----------------------|--------------|
| 身份 | Mesa 内部运营 / 支持账号 | `restaurants.owner_id` | `{login_name}@mesa.in` |
| 数据范围 | **跨店**（经 service role + 运营鉴权） | **本店**（RLS `owner_id`） | **本店 + 角色**（RLS staff） |
| 典型操作 | 开新店、暂停门店、代客吊销打印代理 | 菜单、订单、桌位、员工 CRUD | 厨房出餐、服务员看板 |
| UI 入口 | **`/ops/*`**（`apps/ops`，独立 Vercel Project；见 [`monorepo-vercel.zh.md`](./monorepo-vercel.zh.md)） | `/dashboard/*`（`apps/web`） | `/{slug}/kitchen` 等 |

**设计原则**（延续 `research.md` §1.1）：

1. **分登录态**：运营账号 **不得** 与店主、员工共用 Supabase session 语义（避免「登着店主就能进运营页」或反向越权）。
2. **分 API 前缀**：`/api/ops/*`（运营） vs `/api/dashboard/*`（店主） vs `/api/print-agent/*`（代理 Bearer）。
3. **最小写权限**：默认只读跨店数据；写操作（吊销、暂停、改 plan）须 **显式按钮 + 二次确认 + 审计日志**。
4. **不向运营页长期展示密钥**：**禁止**列表展示完整 `agentjwt`；极端排障用 **一次性、可审计** 的 support token（P2，另开设计）。

## 3. 现状（代码与文档）

| 项 | 现状 |
|----|------|
| 开新店 | `/auth/admin/register` + `POST /api/admin/create-restaurant`（校验 `ADMIN_BOOTSTRAP_SECRET`） |
| 运营 UI | **无** |
| 运营登录 | **无**（仅 shared secret 调 API） |
| 打印代理跨店 | 仅在 [`print-agent-plan.md`](./print-agent-plan.md) P2-6 片段描述 |
| 店主侧吊销 | 配对码 revoke（`/api/print-agent/pairings/[id]/revoke`）；**设备级 `revoked_at` 写入** 店主 dashboard API **待补齐**（与 [`print-agent-device-revocation-auth.zh.md`](./print-agent-device-revocation-auth.zh.md) 同步） |
| 餐厅 plan | `restaurants.plan`：`free` \| `pro`（schema 已有，**无**运营 UI） |
| 功能开关 | `restaurants.feature_flags`（店主可改；运营 **覆盖** 能力未做） |
| 门店国家 | `country_code` **规划中**（见 `print-agent-plan.md`），代建表单须一并纳入 |

## 4. 功能范围（运营视角）

以下按 **Mesa 日常运营** 需要排列，不按技术模块堆砌。

### 4.1 P0 — 必须（替代裸注册页）

| 功能 | 说明 |
|------|------|
| **运营登录 / 登出** | 独立账号体系（见 §5）；登录后进入 `/ops` |
| **餐厅列表** | 分页；按名称、slug、店主邮箱、plan、创建时间筛选；展示 `suspended_at`（待加列）状态 |
| **创建餐厅 + 店主** | 吸收现有 register 能力：店名、slug（可自动生成）、店主邮箱、初始密码、`print_locale`（默认 `pt`）、`country_code`（落地后必填）；邮箱已确认，无需验证链接 |
| **餐厅详情（概览）** | 只读：基本信息、店主邮箱、slug、菜单链接、plan、功能开关快照、创建时间；快捷入口：代客重置密码、暂停/恢复（P0 可只做重置密码） |
| **重置店主密码** | 生成临时密码或设指定密码；可选强制下次登录改密（`user_metadata`）；**须审计** |
| **审计日志（基础）** | 至少记录：创建餐厅、重置密码、登录运营后台（见 §7） |

**P0 交付后**：`/auth/admin/register` 标记 **deprecated**；仅保留环境变量 bootstrap **创建首个运营账号**（或一次性脚本），新开店一律走运营后台。

### 4.2 P1 — 打印与支持（你提到的「远程吊销凭证」）

| 功能 | 说明 |
|------|------|
| **跨店打印代理设备列表** | 读 `print_agent_devices`：`restaurant_id`、店名/slug、`device_id`、`label`、`paired_at`、`valid_until`、`revoked_at`、`last_seen`、`agent_version`、最近打印状态 |
| **代客吊销设备** | 写 `revoked_at`；与店主 dashboard 吊销 **同一底层逻辑**；吊销后须配合 Agent API **JWT 校验后查设备行**（见 `print-agent-device-revocation-auth.zh.md`） |
| **吊销活跃配对码** | 跨店查 `print_agent_pairings` 未消费且未吊销记录，支持 revoke（防店员误留码） |
| **跨店 `print_jobs` 只读排障** | 按餐厅、`type`、`status`、时间、`table_id` / 展示用桌名筛选；**不**展示完整 payload 内敏感字段以外的顾客 PII；支持查看错误信息、`claimed_by`、代理版本 |
| **餐厅维度「打印健康」** | 详情 Tab：活跃设备数、最近 heartbeat、最近失败任务条数（只读聚合） |

**安全**：运营列表 **不显示** `agentjwt` 明文；JWT 仅在 claim 时由代理本地保存。

### 4.3 P2 — 租户治理与商业化预留

| 功能 | 说明 |
|------|------|
| **暂停 / 恢复门店** | 建议新增 `restaurants.suspended_at`、`suspension_reason`（migration）；暂停后：顾客扫码点餐不可用（维护页）、员工无法登录、店主 dashboard 只读或只显示暂停说明（产品二选一，**推荐**：店主可登录看数据但不可改配置、不可接单） |
| **编辑餐厅元数据** | 名称、地址、电话、`print_locale`、`country_code`；**slug 变更** 须二次确认（QR 失效风险） |
| **Plan 与功能开关（运营覆盖）** | 写 `plan`；可选 `feature_flags` 平台强制项（如 beta 功能），与店主自助开关的关系：**运营覆盖优先** 或 **合并策略** 须在 UI 标明 |
| **员工账号只读 + 代客停用** | 跨店读 `restaurant_staff_accounts`；滥用场景写 `disabled_at`（与店主 HR 操作同效，须审计） |
| **运营账号管理** | 多运营人员：邀请、停用、角色（`support` / `admin`）；**不再** 依赖单一 `ADMIN_BOOTSTRAP_SECRET` 调业务 API |
| **审计日志（完整）** | 吊销设备、暂停门店、改 plan、停用员工等全部入表；支持按餐厅、操作人、时间导出 |
| **一次性 support token** | 极端排障：短期只读代理配置 token，单次有效、绑定 `device_id` + 操作人，**不可** 替代正式 `agentjwt` 长期展示 |

### 4.4 P3 — 后续可选

| 功能 | 说明 |
|------|------|
| **计费 / 订阅** | 对接 Stripe 等；`plan` 与 entitlements 联动 |
| **只读「进店」** | 以店主身份只读查看 dashboard（**高风险**）；若做须短时会话 + 强审计 + 店主通知 |
| **数据导出 / 注销** | GDPR：按餐厅导出、合规删除流程 |
| **运营看板** | 全平台订单量、活跃门店、代理版本分布（只读统计） |

## 5. 认证与权限模型（建议）

### 5.1 运营账号

**建议** 新增表 **`platform_admin_accounts`**（实施时写 migration + 更新 `docs/ai-schema.md`）：

```text
id uuid PK
user_id uuid UNIQUE FK -> auth.users
role text  -- support | admin
display_name text
disabled_at timestamptz nullable
created_at timestamptz
```

- 运营人员使用 **正常 Supabase Auth 邮箱 + 密码**（**非** `@mesa.in` 员工邮箱，避免与 `restaurant_staff_accounts` 混淆）。
- 登录后 middleware / layout 校验：`auth.uid()` 存在于 `platform_admin_accounts` 且 `disabled_at IS NULL`。
- **`admin`**：可管理其他运营账号、改 plan、暂停门店；**`support`**：只读 + 重置密码 + 吊销打印凭证（可配置）。

### 5.2 Bootstrap（冷启动）

1. 部署配置 `ADMIN_BOOTSTRAP_SECRET`（可保留，仅用于 **创建第一个** `platform_admin_accounts` 或第一个 `admin` 用户）。
2. 首个运营 `admin` 在 `/ops/bootstrap`（一次性）或 CLI 脚本创建后，**业务开新店** 不再要求填写 shared secret。
3. 长期：**轮换 / 下线** `ADMIN_BOOTSTRAP_SECRET` 对 `create-restaurant` 的依赖。

### 5.3 API 鉴权

- 路由：`/api/ops/*`，统一 `requirePlatformAdmin()`（service role 查 `platform_admin_accounts` + 可选 role 检查）。
- **禁止** 在客户端暴露 `SUPABASE_SERVICE_ROLE_KEY`；所有跨店写操作经服务端。
- 与现有 `POST /api/admin/create-restaurant`：**P0 可复用逻辑** 抽到 `src/lib/platform/create-restaurant.ts`，由 ops API 调用；旧路由可转调同一 lib 并 deprecate。

## 6. UI 与路由（建议）

| 路径 | 页面（`apps/ops`） |
|------|------|
| `/ops/login` | 运营登录 |
| `/ops` | 概览（门店数、近期新建、异常打印摘要） |
| `/ops/restaurants` | 餐厅列表 |
| `/ops/restaurants/new` | 创建餐厅 + 店主 |
| `/ops/restaurants/[id]` | 详情 Tab：概览 / 打印 / 员工（P1/P2） |
| `/ops/audit` | 审计日志（P0 基础 / P2 完整） |
| `/ops/settings/admins` | 运营账号管理（P2） |

- 布局与组件 **可参考** 店主 dashboard 的信息密度，但 **视觉区分**（避免误以为是店家后台）。
- 文案默认 **中文**；P2 再考虑运营侧 i18n（非阻塞）。

## 7. 审计日志（建议表结构）

**`platform_admin_audit_log`**（P0 可最小实现）：

```text
id uuid PK
actor_user_id uuid FK -> auth.users
action text          -- e.g. restaurant.create, owner.reset_password, device.revoke
target_type text     -- restaurant | user | print_agent_device | ...
target_id text       -- uuid 或复合键
restaurant_id uuid nullable FK
metadata jsonb       -- 非敏感上下文（旧 plan、device label）
ip inet nullable
created_at timestamptz
```

- **不记录** 密码、JWT、`agentjwt`、完整 `print_jobs.payload`。
- 保留期建议 ≥ 1 年（合规可调）。

## 8. 与打印代理文档的衔接

- 跨店设备列表、代客吊销：**本节 P1** 为产品入口；底层拒绝逻辑以 [`print-agent-device-revocation-auth.zh.md`](./print-agent-device-revocation-auth.zh.md) 为准（JWT 校验后查 `revoked_at` / `valid_until`）。
- 店主 dashboard **设备吊销 API** 与运营后台 **共用** `src/lib/print-agent-revoke-device.ts`（命名示意），避免两套写 `revoked_at` 逻辑。
- [`print-agent-plan.md`](./print-agent-plan.md) P2-6 第 5 项 **收敛到本文档**。

## 9. 实施顺序（建议）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **0** | 本文档评审定稿；确定 `/ops` 路径与表名 | — |
| **1** | migration：`platform_admin_accounts`、`platform_admin_audit_log`；`requirePlatformAdmin`；`/ops/login` + layout | Supabase |
| **2** | 餐厅列表 + 创建（抽离 `create-restaurant` lib）；重置店主密码 + 审计 | 阶段 1 |
| **3** | 打印：跨店 devices / jobs 只读 + 代客吊销 + 审计 | 设备吊销鉴权修复建议 **同步或先于** 对外宣传「远程吊销立即生效」 |
| **4** | `suspended_at`、plan/功能开关运营编辑、员工只读与代客停用、运营账号 CRUD | migration |
| **5** | 下线 `/auth/admin/register` 或重定向到 `/ops/login`；文档与 README 更新 | 阶段 2 稳定 |

## 10. 非目标（第一期不做）

- 替代店主 `/dashboard` 的业务配置（菜单、桌位等仍由店主自理）。
- 在运营后台直接改订单金额、关台、改菜品状态（涉及资金，须单独工单流程若未来要做）。
- 顾客 PII 批量导出（除非 P3 合规项目单独立项）。

## 11. 参考代码路径

| 用途 | 路径 |
|------|------|
| 现有代建 API | `src/app/api/admin/create-restaurant/route.ts` |
| 现有注册页 | `src/app/auth/admin/register/page.tsx` |
| 店主 dashboard 范例 | `src/components/dashboard/DashboardSettingsShell.tsx` |
| 打印配对 revoke | `src/app/api/print-agent/pairings/[id]/revoke/route.ts` |
| 设备查询（店主） | `src/lib/print-agent-devices-server.ts` |
| 角色边界说明 | `research.md` §1.1 |
| 员工账号（租户内） | `docs/staff-accounts-plan.md` |

## 12. 验收清单（P0 + P1）

- [ ] 运营账号可登录 `/ops`，非运营账号访问 `/ops/*` 返回 403 或跳转登录。
- [ ] 可创建餐厅 + 店主，行为与现 register 页等价（含 `email_confirm`）。
- [ ] 餐厅列表可搜索；详情可见基本信息与菜单链接。
- [ ] 可重置店主密码，且审计表有记录。
- [ ] 可跨店查看 `print_agent_devices`，可代客吊销，吊销后 Agent API 拒绝（依赖鉴权修复）。
- [ ] 可跨店只读筛选 `print_jobs`，页面不展示 `agentjwt`。
- [ ] `/auth/admin/register` 已 deprecated 或仅 bootstrap 可用（与阶段 5 一致）。
