# 运营后台：套餐管理规则（新增 / 修改 / 启用 / 停用 / 删除）

> **状态**：需求设计稿（2026-06-26）  
> **受众**：产品、研发、运营  
> **关联文档**：[`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md)、[`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md)、[`role-permissions-plan.zh.md`](./role-permissions-plan.zh.md)  
> **说明**：本文定义 **运营平台（`apps/ops`）** 对 SaaS 订阅 **套餐（Plan）** 的完整管理能力与业务规则；与 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) 中的三档套餐语义、Feature 矩阵互补。本文中的「套餐 / Plan」指 **SaaS 订阅分层**，与自助餐人头定价无关。

---

## 1. 套餐管理能力

运营平台需要支持对套餐进行完整管理，包括：

| 能力 | 说明 |
|------|------|
| 新增套餐 | 创建新的收费方案 |
| 修改套餐 | 更新名称、描述、默认限额、功能等 |
| 启用套餐 | 恢复可分配状态 |
| 停用套餐 | 禁止分配给新店铺 |
| 删除套餐 | 软删除；未被使用的套餐可物理删除 |
| 查看套餐详情 | 只读展示完整配置与关联店铺数 |
| 配置套餐功能 | 选择该套餐包含的 Feature Key |
| 配置默认桌数上限 | 套餐级默认 `defaultTableLimit` |
| 配置默认账号数上限 | 套餐级默认 `defaultUserLimit` |

套餐管理主要用于运营人员根据不同客户类型灵活配置收费方案，无需改代码或执行 SQL。

---

## 2. 套餐新增

### 2.1 表单字段

| 字段 | 必填 | 说明 |
|------|:----:|------|
| 套餐名称 | ✅ | 例如：试用套餐、基础套餐、Pro 套餐 |
| 套餐 code | ✅ | 系统唯一标识，例如 `TRIAL` / `BASIC` / `PRO` / `CUSTOM` |
| 套餐描述 | — | 面向运营与商务的说明文案 |
| 默认桌数上限 | ✅ | 该套餐默认允许创建的桌台数量 |
| 默认账号数上限 | ✅ | 该套餐默认允许创建的员工账号数量 |
| 默认试用天数 | — | 试用类套餐可填；非试用套餐留空 |
| 套餐功能 | ✅ | 当前套餐包含的 Feature Key 列表 |
| 套餐状态 | ✅ | 启用 / 停用（新建时默认启用） |

### 2.2 校验规则

- **套餐 code 唯一**：提交前校验全局唯一（不含已软删除记录的 code 是否可复用，见 §8.3）。
- **默认限额**：`defaultTableLimit`、`defaultUserLimit` 为正整数；建议下限为 1。
- **Feature Key**：仅允许选择系统已注册的 Key（见 §9）；运营不可随意新增 Key。
- **试用天数**：仅当 code 或套餐类型为试用时必填；否则须为空。

### 2.3 新增后行为

- 套餐写入 `subscription_plans`（或等价表）。
- 套餐功能写入 `subscription_plan_features`（plan ↔ feature 关联表）。
- 写入运营操作日志，类型 `CREATE_PLAN`（见 §10）。
- 启用状态下，套餐可用于分配给店铺（`store_subscriptions` 或餐厅详情中的 plan 选择器）。

---

## 3. 套餐修改

### 3.1 可修改内容

```text
套餐名称
套餐描述
默认桌数上限
默认账号数上限
默认试用天数
包含功能（见 UPDATE SET_PLAN_FEATURES）
是否启用（见 §4、§5）
```

**不可修改**（或受 §8 约束）：

```text
套餐 code（创建后不建议修改；已被店铺使用时禁止修改）
```

### 3.2 修改后对已绑定店铺的影响

**核心规则**：

```text
套餐基础配置修改后，只影响后续套餐判断与无覆盖值的店铺；
若店铺已设置 tableLimitOverride / userLimitOverride，则优先使用店铺覆盖值。
```

**示例**：

```text
Pro 套餐默认桌数从 50 改为 60。
→ 没有单独覆盖值的 Pro 店铺，自动使用 60 桌。
→ 已经单独设置 tableLimitOverride = 80 的店铺，仍然使用 80 桌。
```

**解析优先级**（店铺有效限额，高 → 低）：

1. `store_subscriptions.table_limit_override`（或餐厅行上的 `tableLimitOverride`）
2. `store_subscriptions.user_limit_override`（或餐厅行上的 `userLimitOverride`）
3. 当前绑定套餐的 `defaultTableLimit` / `defaultUserLimit`

**Feature 变更**：

- 修改套餐包含的功能后，**无** `restaurant_plan_features` 行级覆盖的店铺，立即按新套餐功能参与权限判断。
- 已有 `restaurant_plan_features` 覆盖的店铺，行级覆盖仍优先于套餐默认（与 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) §6.2 一致）。

### 3.3 操作日志

修改套餐基础字段 → `UPDATE_PLAN`；仅改功能 → `UPDATE_PLAN_FEATURES`（见 §10）。

---

## 4. 套餐启用

### 4.1 行为

套餐 `isActive = true` 且 `deletedAt = null` 时：

```text
可以被分配给新店铺
已绑定该套餐的店铺可以正常使用
套餐包含的功能正常参与权限判断
```

### 4.2 操作

- 运营在列表或详情页点击「启用」。
- 将 `isActive` 设为 `true`（若当前为停用状态）。
- 写入操作日志，类型 `ENABLE_PLAN`。

### 4.3 约束

- 已软删除的套餐（`deletedAt` 非空）须先「恢复」再启用，不可直接 `isActive = true`（见 §7）。

---

## 5. 套餐停用

### 5.1 行为

套餐 `isActive = false` 且 `deletedAt = null` 时：

```text
不能再分配给新店铺
已绑定该套餐的店铺继续可用（第一版规则）
套餐功能对已绑定店铺仍正常参与权限判断
```

### 5.2 第一版业务规则

```text
停用套餐只影响新分配，不影响已绑定店铺继续使用。
```

**原因**：若停用套餐立刻影响老客户，可能造成客户突然无法使用系统。

若需停止某个店铺使用，应通过 **店铺套餐状态** 控制，而非停用套餐本身：

| 店铺状态 | 语义（参考 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) §6.1） |
|----------|------|
| `SUSPENDED` | 配合 `suspended_at`；全店暂停服务 |
| `DISABLED` | 店铺订阅禁用 |
| `EXPIRED` | 到期降级或锁定高级能力 |

### 5.3 操作

- 运营点击「停用」→ 二次确认 → `isActive = false`。
- 写入操作日志，类型 `DISABLE_PLAN`。

---

## 6. 套餐删除

### 6.1 不建议物理删除（默认：软删除）

套餐可能已被店铺使用、关联历史授权或付款记录，影响审计与追溯。因此 **默认采用软删除**：

```text
deletedAt = <timestamp>
isActive = false
```

（实现层可同时维护 `isDeleted = true` 或由 `deletedAt IS NOT NULL` 推导。）

### 6.2 允许删除的条件

| 场景 | 处理方式 |
|------|----------|
| **从未被任何店铺使用** | 允许 **物理删除** 或软删除（产品可统一为软删除以简化实现） |
| **已被店铺使用** | **禁止物理删除**；仅可软删除或停用 |

**判断条件**：

```text
没有任何 store_subscriptions（或等价订阅绑定表）关联该 planId
```

关联店铺数 > 0 时，API 返回业务错误，前端展示 §12 的「已被使用」提示。

### 6.3 删除后的规则

```text
不在套餐列表默认展示
不能被分配给新店铺
历史店铺授权记录仍然可以查询
历史数据不受影响
```

列表可提供筛选：**显示已删除套餐**。

### 6.4 恢复已删除套餐（可选）

- 运营可将 `deletedAt` 置空，并手动选择是否同时 `isActive = true`。
- 写入操作日志，类型 `RESTORE_PLAN`。
- 恢复后 code 仍须保持唯一；若 code 已被新套餐占用则拒绝恢复。

---

## 7. 套餐状态模型

### 7.1 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `isActive` | boolean | 是否启用（可分配给新店铺） |
| `deletedAt` | timestamptz nullable | 软删除时间；`null` 表示未删除 |

### 7.2 状态组合

| isActive | deletedAt | 展示状态 | 含义 |
|:--------:|:---------:|----------|------|
| true | null | **启用** | 正常可用 |
| false | null | **停用** | 不可分配给新店铺；已绑定店铺不受影响 |
| false | 有值 | **已删除** | 列表默认隐藏；不可分配 |
| true | 有值 | — | **不允许出现**（API 须拒绝） |

### 7.3 列表默认查询

```sql
-- 默认列表
WHERE deleted_at IS NULL

-- 「显示已删除」
-- 无 deleted_at 过滤，或 deleted_at IS NOT NULL
```

分配给新店铺时，仅展示 `is_active = true AND deleted_at IS NULL` 的套餐。

---

## 8. 套餐 code 规则

### 8.1 命名示例

```text
TRIAL
BASIC
PRO
CUSTOM_BASIC
CUSTOM_PRO
```

与 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) 中 `basic` / `pro` / `business` 产品语义可映射；**code 为运营可配置的 stable id**，DB 列 `restaurants.plan` 可存 code 或经 migration 对齐。

### 8.2 规则

| 规则 | 说明 |
|------|------|
| 唯一性 | 全局唯一（建议对 `deleted_at IS NULL` 的行做 partial unique index；已删除 code 是否可复用由产品决定，**第一版建议不可复用**） |
| 创建后不建议修改 | 代码、权限配置、运营记录可能依赖 code |
| 已被店铺使用时禁止修改 | 若 `store_subscriptions` 存在该 `planId`，PATCH 拒绝修改 `code` |
| 格式 | 建议大写英文 + 下划线；前后端校验 `[A-Z][A-Z0-9_]*` |

---

## 9. 套餐功能配置规则

### 9.1 原则

- **Feature Key 由开发维护**（见 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) §4 矩阵与 `plan-features.ts`）。
- **运营只负责选择** 套餐是否包含已有 Key，不可在后台「发明」新 Key。

### 9.2 运营可执行操作

在套餐编辑页的「功能配置」中：

```text
勾选 / 取消勾选功能（等效于新增或移除套餐与 Feature 的关联）
```

产品文案上的「启用 / 停用功能」在套餐维度即 **包含 / 不包含** 该 Key；与店铺级 `restaurant_plan_features.enabled` 不同。

### 9.3 示例：Pro 套餐功能

```text
BASIC_TABLE_OPERATION
BASIC_ORDER_HISTORY
BASIC_MENU_MANAGEMENT
BASIC_TODAY_OVERVIEW
ABNORMAL_OPERATIONS
TREND_ANALYTICS
REPORT_EXPORT
OWNER_DAILY_REPORT
ITEM_CONSUMPTION_ANALYTICS
ADVANCED_ORDER_HISTORY
```

### 9.4 校验

- 保存时校验每个 Key 存在于系统注册表。
- 基础营业类 Key 若从套餐中全部移除，须警告（可能违反 G1「基础营业不被锁」原则，见 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) §1.2）。

---

## 10. 套餐修改日志

### 10.1 必须记录的操作类型

| action | 说明 |
|--------|------|
| `CREATE_PLAN` | 新增套餐 |
| `UPDATE_PLAN` | 修改名称、描述、默认限额、试用天数等 |
| `ENABLE_PLAN` | 启用 |
| `DISABLE_PLAN` | 停用 |
| `DELETE_PLAN` | 软删除（或允许的物理删除） |
| `RESTORE_PLAN` | 恢复已删除套餐 |
| `UPDATE_PLAN_FEATURES` | 修改套餐包含的功能 |

### 10.2 日志字段

| 字段 | 说明 |
|------|------|
| 操作类型 | 上表 action |
| 操作人 | 运营账号 id / 邮箱 |
| 操作时间 | timestamptz |
| 套餐 ID | `planId` |
| 套餐名称 | 快照，便于列表展示 |
| 修改前数据 | JSON snapshot（敏感字段除外） |
| 修改后数据 | JSON snapshot |
| 操作原因 | 可选；停用 / 删除建议必填 |

写入 **`platform_audit_logs`**（或 [`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md) §7 定义的运营审计表），与改餐厅 plan、暂停门店等同一体系。

---

## 11. 前端页面设计（`apps/ops`）

### 11.1 页面与操作

| 页面 / 区域 | 操作 |
|-------------|------|
| 套餐列表 | 新增、筛选（启用 / 停用 / 已删除）、进入详情 |
| 套餐详情 | 编辑、启用、停用、删除、恢复（可选） |
| 套餐表单（新建 / 编辑） | 基础字段 + 功能多选 + 保存 |
| 删除确认弹窗 | 见 §12 |

路由建议：`/ops/plans`、`/ops/plans/new`、`/ops/plans/[id]`、`/ops/plans/[id]/edit`。

### 11.2 列表字段

| 列 | 说明 |
|----|------|
| 套餐名称 | 例如 Pro 套餐 |
| 套餐 code | 例如 `PRO` |
| 默认桌数 | 例如 50 |
| 默认账号数 | 例如 10 |
| 包含功能数 | 当前关联 Feature 数量 |
| 状态 | 启用 / 停用 / 已删除 |
| 关联店铺数 | `COUNT(store_subscriptions WHERE plan_id = ? AND 未解绑)` |
| 更新时间 | 最近修改时间 |
| 操作 | 编辑 / 启用 / 停用 / 删除（按状态显隐） |

### 11.3 权限

- 读：`support` 及以上。
- 写（新增 / 修改 / 启用 / 停用 / 删除）：`admin`（与 [`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md) §5 一致）。

### 11.4 与餐厅详情的衔接

餐厅详情「分配套餐」下拉仅加载 **启用且未删除** 的套餐；变更餐厅绑定套餐写入餐厅维度的审计日志（`UPDATE_RESTAURANT_PLAN` 等，可与本文套餐日志区分）。

---

## 12. 删除确认提示

### 12.1 未被使用

```text
确认删除该套餐吗？

删除后，该套餐将不能再分配给店铺。
```

### 12.2 已被使用

```text
该套餐已有店铺正在使用，不能物理删除。

你可以停用该套餐，停用后它将不能分配给新店铺，但不会影响已有店铺。
```

按钮：**停用套餐**（主操作）、**取消**。

---

## 13. 数据模型建议

与 [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) 演进对齐；落地时须更新 [`ai-schema.md`](./ai-schema.md)。

### 13.1 `subscription_plans`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `code` | text unique | 稳定标识 |
| `name` | text | 套餐名称 |
| `description` | text nullable | |
| `default_table_limit` | integer | 默认桌数上限 |
| `default_user_limit` | integer | 默认账号数上限 |
| `default_trial_days` | integer nullable | 试用天数 |
| `is_active` | boolean default true | |
| `deleted_at` | timestamptz nullable | 软删除 |
| `created_at` / `updated_at` | timestamptz | |

### 13.2 `subscription_plan_features`

| 列 | 说明 |
|----|------|
| `plan_id` | FK → subscription_plans |
| `feature_key` | Plan Feature 枚举 |
| PK | `(plan_id, feature_key)` |

### 13.3 `store_subscriptions`（店铺 ↔ 套餐绑定）

| 列 | 说明 |
|----|------|
| `id` | uuid PK |
| `restaurant_id` | FK → restaurants |
| `plan_id` | FK → subscription_plans |
| `status` | `active` \| `trial` \| `expired` \| `disabled` \| `suspended` 等 |
| `table_limit_override` | integer nullable |
| `user_limit_override` | integer nullable |
| `expire_at` | timestamptz nullable |
| `created_at` / `updated_at` | |

> **迁移说明**：当前 `restaurants.plan` 为 `free \| pro` 文本列；可渐进迁移为 `plan_id` FK，或保留 code 冗余列并与 `subscription_plans.code` 同步。

---

## 14. API 契约（建议）

前缀：`/api/ops/plans/*`；鉴权：运营 session + `admin` 角色写操作。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ops/plans` | 列表；query: `includeDeleted`, `isActive` |
| POST | `/api/ops/plans` | 新增 |
| GET | `/api/ops/plans/[id]` | 详情 + 关联店铺数 + 功能列表 |
| PATCH | `/api/ops/plans/[id]` | 修改基础字段（不含 code 若已使用） |
| POST | `/api/ops/plans/[id]/enable` | 启用 |
| POST | `/api/ops/plans/[id]/disable` | 停用 |
| DELETE | `/api/ops/plans/[id]` | 软删除；无关联时可物理删除 |
| POST | `/api/ops/plans/[id]/restore` | 恢复软删除 |
| PUT | `/api/ops/plans/[id]/features` | 全量替换功能列表 → `UPDATE_PLAN_FEATURES` |

错误码示例：

| code | 场景 |
|------|------|
| `plan_code_duplicate` | code 冲突 |
| `plan_code_immutable` | 已使用套餐禁止改 code |
| `plan_in_use` | 已关联店铺，拒绝物理删除 |
| `plan_invalid_state` | 如 `isActive=true` 且 `deletedAt` 有值 |

---

## 15. 验收标准

### 15.1 新增套餐

1. 运营人员可以新增套餐。
2. 套餐 code 必须唯一。
3. 新增套餐可以配置默认桌数、账号数和功能。
4. 新增后可分配给店铺。
5. 写入 `CREATE_PLAN` 审计日志。

### 15.2 修改套餐

1. 运营人员可以修改套餐名称、描述、默认桌数、默认账号数、试用天数。
2. 运营人员可以修改套餐包含的功能。
3. 修改默认限额后，没有 `tableLimitOverride` / `userLimitOverride` 的店铺使用新默认值。
4. 有覆盖值的店铺不受默认值修改影响。
5. 写入 `UPDATE_PLAN` / `UPDATE_PLAN_FEATURES` 日志。

### 15.3 启用套餐

1. 启用后可以分配给新店铺。
2. 已绑定店铺与权限判断正常。
3. 写入 `ENABLE_PLAN` 日志。

### 15.4 停用套餐

1. 停用后不能再分配给新店铺。
2. 停用不影响已绑定店铺继续使用。
3. 单店停用须通过店铺套餐状态（`SUSPENDED` / `DISABLED` / `EXPIRED`），而非停用套餐本身。
4. 写入 `DISABLE_PLAN` 日志。

### 15.5 删除套餐

1. 未被任何店铺使用的套餐可以删除（软删除或物理删除）。
2. 已被店铺使用的套餐不能物理删除。
3. 删除采用软删除（`deletedAt`）。
4. 已删除套餐不能再分配给新店铺。
5. 历史授权记录仍可查询。
6. 写入 `DELETE_PLAN` 日志。

### 15.6 操作日志

1. 新增、修改、启用、停用、删除、恢复、修改功能均写入运营审计日志。
2. 日志含操作人、时间、前后快照（或 diff）。

---

## 16. 与现有文档的关系

| 文档 | 关系 |
|------|------|
| [`subscription-plan-design.zh.md`](./subscription-plan-design.zh.md) | 定义 **三档套餐语义、Feature 矩阵、店铺级覆盖与门控**；本文定义 **运营如何 CRUD 套餐实体** |
| [`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md) | 运营后台总计划；套餐管理属 P2「Plan 与功能开关」的扩展 |
| [`role-permissions-plan.zh.md`](./role-permissions-plan.zh.md) | 角色权限与套餐权限正交；改套餐功能后仍须 `permission && planFeature` |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-06-26 | 初版：新增 / 修改 / 启用 / 停用 / 删除规则，状态模型，code 与功能配置，审计日志，UI 与 API 建议，验收标准 |
