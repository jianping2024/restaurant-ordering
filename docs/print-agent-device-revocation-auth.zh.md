# Print Agent：JWT 校验后未强制执行设备吊销 / 过期

> **风险等级**：High  
> **状态**：计划中（文档阶段；实现待阶段 1–2）  
> **根因文件**：`src/lib/print-agent-auth.ts`（`verifyAgentBearer`，约 L9–17）  
> **数据表**：`public.print_agent_devices`（`valid_until`、`revoked_at`）— 见 `docs/ai-schema.md`  
> **推荐方案**：阶段 1–2：每次 Agent Bearer 请求在 JWT 校验后查询设备行；阶段 4 可选短 JWT + 刷新

## 问题摘要

`print_agent_devices` 行上有 **`valid_until`**（凭证有效期）与 **`revoked_at`**（吊销时间），但 Agent API 鉴权目前仅调用 `verifyPrintAgentJwt`（签名校验 + JWT `exp`）。

吊销或过期后，在 **JWT 未过期** 前，设备仍可：

- 轮询 `GET /api/print-agent/pending-jobs`
- 认领 / 更新 `print_jobs`
- 读取 routing、print-stations、runtime-config

**部分例外**：`POST /api/print-agent/heartbeat` 在 `UPDATE` 时使用 `.is('revoked_at', null)`，吊销设备会得到 `403 device_not_found_or_revoked`，但 **不会在鉴权入口统一拦截**，且其它路由无同等检查。

JWT 与 `valid_until` 在 claim 时均使用 `PRINT_AGENT_CREDENTIAL_TTL_SEC`（180 天，`src/lib/print-agent-credential.ts`）。吊销与 JWT 生命周期解耦，因此吊销后最长仍有约 180 天窗口（若未修复）。

## 受影响 Agent 路由（Bearer JWT）

| 路由 | 当前鉴权 | 吊销后预期（修复后） |
|------|----------|----------------------|
| `GET .../pending-jobs` | 仅 JWT | 401/403 |
| `PATCH .../jobs/[id]` | 仅 JWT | 401/403 |
| `GET .../routing` | 仅 JWT | 401/403 |
| `GET .../print-stations` | 仅 JWT | 401/403 |
| `GET .../runtime-config` | 仅 JWT | 401/403 |
| `POST .../heartbeat` | JWT + UPDATE 时 `revoked_at` 过滤 | 401/403（入口统一 + 可保留 UPDATE 防御） |

**不在此范围**：`POST .../claim`（配对码，非 Bearer）、staff/owner 的 `pairings/*`（已有 `revoked_at` 逻辑）。

## 数据与约束

| 列 | 含义 |
|----|------|
| `id` | 与 JWT `device_id` 一致 |
| `restaurant_id` | 与 JWT `restaurant_id` 一致（租户边界） |
| `valid_until` | 凭证到期（timestamptz） |
| `revoked_at` | 非 null 表示已吊销 |

**活跃设备定义（建议）**：

```text
revoked_at IS NULL AND valid_until > now()
```

查询必须同时匹配 **`id` + `restaurant_id`**（不得仅按 `device_id` 查）。

**鉴权（不得削弱）**：

- Agent 路由继续使用 service-role `createAdminClient()` 查设备；不向客户端暴露 service key。
- Staff/owner 对 `print_agent_devices` 的 RLS 不变；本修复不新增公开策略。

**无需迁移**：现有表与索引（`print_agent_devices_pkey`、`idx_print_agent_devices_restaurant`）足以支持按主键 + `restaurant_id` 点查。

## 目标行为

1. 任意 Agent Bearer 请求：JWT 有效 **且** 设备行活跃 → 继续现有业务逻辑。
2. JWT 无效/缺失 → `401 unauthorized`（保持现状）。
3. JWT 有效但设备已吊销或 `valid_until` 已过 → `401` 或 `403`（建议与 heartbeat 对齐：`403` + `device_not_found_or_revoked` 或统一 `401`；实现时全站一致即可）。
4. JWT 中 `restaurant_id` 与行不一致 → 拒绝（防跨店 token 复用）。

**范围外（本修复 PR）**：短生命周期 JWT + refresh（阶段 4）、Dashboard 设备吊销 API（阶段 5）、Go print-agent 发版（除非改错误处理文案）。

---

## 分阶段任务

### 阶段 0 — 确认与复现（只读）

| 项 | 内容 |
|----|------|
| **Goal** | 证明吊销后非 heartbeat 路由仍可用；固定修复前基线。 |
| **Files affected** | 无（只读）；参考 `src/lib/print-agent-auth.ts`、`src/app/api/print-agent/*/route.ts` |
| **Risk level** | 低 |
| **What will be changed** | 无。 |
| **What must not be changed** | 生产数据（除测试设备）；JWT 签发、RLS、claim 流程。 |
| **Manual tests required** | 见下 |

**操作**

1. 配对一台测试 Agent，保存返回的 `agentjwt` 与 `device_id`、`restaurant_id`。
2. 确认 `GET /api/print-agent/pending-jobs`（`Authorization: Bearer <token>`）返回 `200`。
3. 在库中执行（测试设备）：
   ```sql
   UPDATE print_agent_devices
   SET revoked_at = now()
   WHERE id = '<device_id>' AND restaurant_id = '<restaurant_id>';
   ```
4. 再次用 **同一 Bearer** 调用：
   - `GET .../pending-jobs` → 修复前预期 **仍 200**（漏洞）。
   - `POST .../heartbeat` → 修复前预期 **403** `device_not_found_or_revoked`。
5. 对照：未吊销设备仍正常；清除 `revoked_at` 或换新配对码后恢复。

**不修改代码。**

---

### 阶段 1 — 鉴权层集中设备门禁

| 项 | 内容 |
|----|------|
| **Goal** | JWT 校验通过后，强制 DB 侧设备活跃检查（单一实现）。 |
| **Files affected** | `src/lib/print-agent-auth.ts`；可选 `src/lib/print-agent-device-active.ts`（小 helper） |
| **Risk level** | 中（每次 Agent 请求多一次 DB 往返；吊销/过期设备行为变更） |
| **What will be changed** | 将 `verifyAgentBearer(req)` 改为 **async**，签名如 `verifyAgentBearer(req, admin)`：先 `verifyPrintAgentJwt`；再 admin 查询 `print_agent_devices`（`id`、`restaurant_id`、`revoked_at IS NULL`、`valid_until > now()`）；失败返回 `null`。 |
| **What must not be changed** | `src/lib/print-agent-jwt.ts` 算法与 claims；`PRINT_AGENT_CREDENTIAL_TTL_SEC`；`claim` 路由；`print_agent_*` RLS；迁移文件。 |
| **Manual tests required** | 阶段 0 步骤 4：吊销后 **pending-jobs 等全部失败**；`valid_until` 设为过去同样失败；JWT 中错误的 `restaurant_id` 失败。 |

---

### 阶段 2 — 接入所有 Agent API 路由

| 项 | 内容 |
|----|------|
| **Goal** | 无路由绕过集中门禁。 |
| **Files affected** | `src/app/api/print-agent/pending-jobs/route.ts`；`jobs/[id]/route.ts`；`print-stations/route.ts`；`routing/route.ts`；`runtime-config/route.ts`；`heartbeat/route.ts` |
| **Risk level** | 中（触及打印轮询、job claim、状态回写） |
| **What will be changed** | 各 handler 在业务逻辑前 `await verifyAgentBearer(req, admin)`。heartbeat 可在入口拦截后保留或简化 UPDATE 上的 `.is('revoked_at', null)`。 |
| **What must not be changed** | Job 查询范围、`filterPrintJobsByRestaurant`、rate limit、成功响应 JSON 形状；`claim`、pairing staff API。 |
| **Manual tests required** | 完整 Agent 冒烟：配对 → poll → claim job → 更新状态 → heartbeat → routing/runtime-config/print-stations；中途 SQL 吊销 → 下一轮 poll 失败。 |

---

### 阶段 3 — 自动化回归

| 项 | 内容 |
|----|------|
| **Goal** | 防止回退为「仅验 JWT」。 |
| **Files affected** | 新建 `src/lib/print-agent-auth.test.ts`；可选 `package.json` 增加 `node --test` 脚本（与 `checkout-confirm-payment.test.ts` 模式一致） |
| **Risk level** | 低 |
| **What will be changed** | 表驱动用例：活跃行 → 成功；`revoked_at` 非空 → 失败；`valid_until` 过期 → 失败；无行 → 失败；JWT `exp` 过期 → 失败且可不调 DB。 |
| **What must not be changed** | 不新增 npm 依赖；不修改 Go print-agent（本阶段）。 |
| **Manual tests required** | `npm run lint`；运行新增单元测试；可选 staging 重复阶段 0 curl。 |

---

### 阶段 4 — 短 JWT + 刷新（延后，可选）

| 项 | 内容 |
|----|------|
| **Goal** | 缩短 JWT 泄露后的有效窗口。 |
| **Files affected** | `print-agent-jwt.ts`、`claim/route.ts`、新 renew API、`apps/print-agent/*`、文档、可能的新表/列 |
| **Risk level** | 高（需 print-agent 安装包发版与 `print-agent-v*` 标签） |
| **What will be changed** | 短 `exp`（如 15–60 分钟）、refresh 端点每次重查 `revoked_at` / `valid_until` 再签发。 |
| **What must not be changed** | 未与 Agent 发版对齐前不要单独上线 refresh API。 |
| **Manual tests required** | 吊销后 refresh 失败；过期无 refresh 时 poll 失败；从旧版长 JWT 升级路径。 |

---

### 阶段 5 — Dashboard 设备吊销 UX（延后，可选）

| 项 | 内容 |
|----|------|
| **Goal** | 运营无需 SQL 即可吊销设备（当前仅有 pairing `pairings/[id]/revoke`）。 |
| **Files affected** | 新 `devices/[id]/revoke` staff API、Dashboard UI、`docs/ai-schema.md`（若记录操作流程） |
| **Risk level** | 中（须 owner 租户隔离） |
| **What will be changed** | Owner  scoped `UPDATE print_agent_devices SET revoked_at = now()`。 |
| **What must not be changed** | 无阶段 1–2 时吊销 UX 无安全收益。 |
| **Manual tests required** | Owner 吊销本店设备 → Agent 立即被拒；它店 `device_id` → 404/403。 |

---

## 实现检查清单（阶段 1–2 完成后）

- [ ] `verifyAgentBearer`（或等价函数）为 async，且所有 Bearer 路由已 `await`
- [ ] 查询条件包含 `restaurant_id` + `device_id` + `revoked_at IS NULL` + `valid_until > now()`
- [ ] 吊销设备：`pending-jobs` / `jobs` / `routing` / `print-stations` / `runtime-config` 不再返回 200
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过（改动 API 路由）
- [ ] 阶段 3 单元测试已添加并通过

## 推荐合并顺序

```text
阶段 0（复现）→ 阶段 1 + 2（同一 PR）→ 阶段 3 → 发布
阶段 4、5 独立 PR，按需排期
```

## 参考

- JWT：`src/lib/print-agent-jwt.ts`
- 凭证 TTL：`src/lib/print-agent-credential.ts`（`PRINT_AGENT_CREDENTIAL_TTL_SEC`）
- Claim 写入设备 + 签发 JWT：`src/app/api/print-agent/claim/route.ts`
- Heartbeat 部分吊销检查：`src/app/api/print-agent/heartbeat/route.ts`（L67–80）
- 表定义（初始迁移）：`supabase/migrations/20260516100000_print_agent_pairings_devices.sql`（L20–28）
