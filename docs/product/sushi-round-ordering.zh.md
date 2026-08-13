# 寿司自助同桌轮次点餐（实现契约）

> **状态**：已定稿（2026-08-12），待实现  
> **读者**：产品、开发、AI 代理  
> **前置**：[`buffet-open-table.zh.md`](../buffet-open-table.zh.md)、[`menu-order-append.zh.md`](../menu-order-append.zh.md)、[`04-business-rules.md`](./04-business-rules.md)

## 目的

`sushi` 业态下，顾客免费菜（`price = 0`）走 **同桌轮次合单 + 全员确认送厨**；收费菜即时单独下单。Classic 业态与 URL **不变**。

**代码变更涉及下列规则时，须同步更新本文档。**

---

## 1. 适用范围

| 条件 | 行为 |
|------|------|
| `restaurants.buffet_service_mode = classic` | **不**启用轮次；沿用现有 `MenuOrderingController` 立即 append |
| `buffet_service_mode = sushi` + 功能设置关闭轮次 | 同 classic（仅保留免费菜整餐限量，见 §3） |
| `buffet_service_mode = sushi` + 轮次开启 | 免费菜走轮次；收费菜走即时 append |
| 员工代点 `waiter_flow: true` | **绕过**轮次与确认；仍受整餐免费菜限量（员工可超额）；即时 append |

顾客入口 URL **唯一**：`/{slug}/menu?table_id=…`（QR 不变）。服务端按业态渲染 **ClassicMenuPage** 或 **SushiMenuPage** 根组件，禁止第二套路由。

---

## 2. 菜品分类（硬判定）

### 2.1 免费菜（参与轮次）

同时满足：

1. 服务端 catalog 当前 `menu_items.price = 0`（append 时再次查价，不信任客户端）
2. 非 `buffet_base`、非 kitchen remake

### 2.2 收费菜（不参与轮次）

`price > 0`：**不限整餐免费额度、不计入轮次份数上限**；顾客本地 cart + 即时 `POST …/orders/append`（与 classic 相同，保留本机 `order_cooldown_seconds` 防连点）。

### 2.3 整餐免费菜限量（与轮次独立）

仅对 **`price = 0` 且配置了 `per_person_qty_limit` + `over_limit_unit_price`（成对）** 的菜品：

- 免费额度 = `per_person_qty_limit ×` 开台人数（多套餐 `buffet_base` 成人+儿童求和）
- 客人：**不可超过**免费额度（硬拦）
- 员工代点：可超额；交互见 [`04-business-rules.md`](./04-business-rules.md) §4 寿司限量

未配限量的免费菜：仅受 **轮次份数上限**（§4），不受整餐 per-dish 上限。

---

## 3. 功能设置（Dashboard → 功能管理）

| 字段 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `sushi_round_ordering_enabled` | `true` | bool | 仅 `sushi` 生效 |
| `sushi_per_person_per_round_cap` | `8` | 1–20 | 每人每轮免费菜份数上限 |
| `sushi_round_confirm_timeout_seconds` | `25` | 15–45 | 送厨确认超时；未投票视为同意 |
| `sushi_round_cooldown_seconds` | `120` | 30–600 | 送厨成功后 **session 级**冷却 |
| `sushi_round_defer_cooldown_seconds` | `30` | 15–120 | 本轮被「暂缓送厨」后，禁止再次发起送厨 |
| `sushi_round_rules_notice` | 空 | 多语 JSON 可选 | 顾客 intro / 顶栏「?」 |

保留现有 `order_cooldown_seconds`（5–60）：**本机**提交按钮冷却，与桌级冷却职责不同。

---

## 4. 轮次份数上限

- **仅计免费菜**（§2.1）本轮 `table_order_round_lines` 的 `qty` 之和
- 上限 = `sushi_per_person_per_round_cap × guest_count_snapshot`
- `guest_count_snapshot`：当前 session 开台人数（`buffet_base` 成人+儿童合计）；**发起送厨时冻结**到 round 行（§6.2），确认期不随改人数变化
- 加菜 API 与 finalize 前 **服务端权威校验**；人数 `< 1` → `guest_count_required`；超额 → `round_cap_exceeded`

---

## 5. 状态机（`table_order_rounds.status`）

```text
idle          — 无活跃轮次（或上一轮已 closed）
collecting    — 有人加免费菜后自动进入；可继续加免费菜
pending_confirm — 已发起送厨；锁篮（§7）；等待投票 / 超时
cooldown      — append 成功；至 cooldown_until
closed        — session 结束 / 并桌作废 / 强制关台归档
```

### 5.1 转移

| 从 | 事件 | 到 |
|----|------|-----|
| — | 首条免费菜入 round | `collecting` |
| `collecting` | `POST …/round/submit-request` | `pending_confirm` |
| `pending_confirm` | 全员确认或超时 finalize 成功 | `cooldown` |
| `pending_confirm` | 任一票 `defer`（暂缓） | `collecting`（清空 votes；记录 defer 时间） |
| `cooldown` | `now >= cooldown_until` | `idle`（可自动开新 collecting） |
| 任意 | session `billing` / `closed` / 并桌来源 session | `closed` |
| `collecting` | 行数清零且超时无活动（可选 housekeeping） | `idle` |

**禁止**跳过 `pending_confirm` 直接 append（顾客路径）。

---

## 6. 数据模型（须 migration + RLS）

### 6.1 `table_order_rounds`

| 列 | 说明 |
|----|------|
| `id` | uuid PK |
| `restaurant_id`, `session_id`, `table_id` | FK；session 唯一活跃 round（partial unique: status not in closed） |
| `status` | §5 |
| `guest_count_snapshot` | 发起送厨时冻结；投票 quorum 用此值 |
| `per_person_cap` | 发起时快照设置项 |
| `submit_request_id` | uuid；本轮送厨意图 id（弹窗去重用） |
| `submit_requested_at`, `submit_deadline_at` | 进入 pending_confirm 时写入 |
| `defer_used_at` | 本轮是否已用过暂缓（每轮最多一次） |
| `defer_cooldown_until` | 暂缓后禁止再次 submit-request |
| `cooldown_until` | cooldown 结束时间 |
| `append_client_request_id` | finalize 成功后写入；append 幂等 |
| `created_at`, `updated_at` | |

### 6.2 `table_order_round_lines`

| 列 | 说明 |
|----|------|
| `id` | uuid PK |
| `round_id` | FK |
| `menu_item_id` | FK |
| `qty` | ≥1 |
| `guest_client_id` | 见 §8 |
| `note` | 顾客购物车备注；空串表示无；`char_length ≤ 120` |
| `added_at` | |
| UNIQUE | `(round_id, menu_item_id, guest_client_id)` — upsert 合并 qty |

### 6.3 `table_order_round_votes`

| 列 | 说明 |
|----|------|
| `id` | uuid PK |
| `round_id`, `submit_request_id` | FK / 关联 |
| `guest_client_id` | |
| `vote` | `pending` \| `confirm` \| `defer` |
| `voted_at` | |
| UNIQUE | `(round_id, submit_request_id, guest_client_id)` |

### 6.4 RLS

- 顾客（anon + table context）：**仅**读写本 `session_id` 且 `restaurant_id` 匹配 QR 的 round/lines/votes
- **禁止**跨桌、跨 session
- staff/service_role：只读审计；写路径走 API service role

---

## 7. 送厨确认（硬规则）

### 7.1 发起

- 任意客人 `POST …/round/submit-request`
- 前置：`status = collecting`、轮次免费菜 qty > 0、未在 `defer_cooldown_until` 内、session `open`、非 billing
- 写入 `pending_confirm`、生成 `submit_request_id`、`submit_deadline_at = now + confirm_timeout`
- **锁篮**：pending_confirm 期间 **禁止**新增/修改/删除 round lines

### 7.2 票数

- Quorum = **`guest_count_snapshot`**（开台人数），**不是**在线设备数
- 每 `guest_client_id` 最多一票；登记 client 数可 > 人数但 **仅前 N 个有效票**（N = snapshot）— 实现推荐：session 内 active client 登记上限 = 开台人数

### 7.3 投票

| 操作 | API | 效果 |
|------|-----|------|
| 确认送厨 | `POST …/round/vote { vote: confirm }` | 记录 confirm |
| 暂缓送厨 | `POST …/round/vote { vote: defer }` | **二次确认**后生效（§7.5） |

- **不需要**填写原因
- **顾客 UI 不展示**否决者身份；仅 toast：「有人暂缓了本次送厨」
- 后台 `operation_logs` 或专用审计表保留 `guest_client_id` + 时间（员工可查，顾客不可见）

### 7.4 超时与 finalize

- `POST …/round/finalize`（客户端在 deadline 单次 timer；mount/reconcile 时补调）
- 条件：`status = pending_confirm` 且（**已收齐 confirm 数 = guest_count_snapshot** 或 **now ≥ submit_deadline_at**）
- 超时未投票 → **视为 confirm**
- 若存在任一 `defer` → **不 finalize**；回 `collecting`（§5.1）
- finalize 成功：合并 lines → **一次** `orders/append`（`client_request_id = append_client_request_id`）→ `cooldown`

### 7.5 暂缓（defer）限制

- 须 **二次确认** modal：`确定暂缓送厨？同桌需重新发起`
- **每轮仅 1 次** defer（`defer_used_at`）
- defer 后 **30s**（`sushi_round_defer_cooldown_seconds`）内禁止 `submit-request`
- defer 后清空本轮 votes，**保留** round lines

---

## 8. 顾客身份 `guest_client_id`

- 首次进菜单：`localStorage` 生成 UUID，键名 `mesa_guest_client_id_{restaurant_id}_{table_id}`
- 服务端 session 登记；**同一 session 有效 client 数 ≤ 开台人数**
- 伪造多 id：**超额票无效**；defer **按 round 计次**不按 client

---

## 9. API（顾客路径）

基路径：`/api/restaurants/[slug]/table-order-round/…`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 当前 session 活跃 round + lines + votes（mount / Realtime 后 reconcile） |
| POST | `/lines` | upsert 免费菜行（含 note）；由购物车「下单」写入，禁止卡片 debounce 直写 |
| DELETE | `/lines/:id` | 仅 `collecting`；仅允许删除 **本 client** 添加的行 |
| POST | `/submit-request` | → pending_confirm |
| POST | `/vote` | confirm / defer |
| POST | `/finalize` | 幂等 finalize + append |

**限流**：按 `session_id` 独立限流（**不可**与 append 共用 IP 桶）；建议 60 req/min/session。

**append**：仍走唯一 `POST …/orders/append`；round finalize 内部调用，顾客不直调。

---

## 10. Realtime 与刷新

- 订阅 `table_order_rounds`、`table_order_round_lines`、`table_order_round_votes`，filter `session_id=eq.{id}`
- 模式：postgres_changes → debounce 2s → GET round（**禁止** interval 轮询）
- 菜单页 **可见**时订阅；隐藏/离开 unsubscribe
- 同一 `submit_request_id` 确认弹窗 **只展示一次**（客户端 dedupe）

---

## 11. 安全与并发（硬门禁）

1. **finalize 幂等**：`UPDATE … WHERE status='pending_confirm'` 仅一行成功；append 用固定 `append_client_request_id`
2. **append 失败**：round 保持 `pending_confirm` 或转 `finalize_failed` 可重试态；**禁止**重复送厨成功
3. **pending_confirm 锁篮**：服务端拒绝 lines 写
4. **改人数**：送厨确认进行中 **不更新** `guest_count_snapshot`；collecting 阶段上限随 live 人数变
5. **转台 / 并台**：见 §11.1（须在既有 RPC **同一事务**内处理 round）
6. **billing / 关台**：round → `closed`；拒绝 vote / submit / lines
7. **整餐免费菜限量**：finalize → append 前仍跑 `checkSushiLimitForCartLine`（`price=0` 项）

### 11.1 转台 / 并台 / 「RPC 同事务」

**「RPC 同事务」含义**：服务员转台、并台走现有 Postgres RPC（`transfer_table_session` / `merge_table_sessions`）。这些函数在库内是一次事务：要么桌位/订单/会话 **和** round 一起改成功并提交，要么全部回滚。  
**禁止**只在 Next.js API 里「RPC 成功后再另一次 UPDATE round」——会半截（桌并了、篮子还挂旧 session，或 RPC 成功但 round 更新失败）。

#### 转台（`transfer_table_session`）

- 会话 **`session_id` 不变**，只换 `table_id` / `display_name`
- round **跟着 session**：在 RPC 内把该 session 未 `closed` 的 `table_order_rounds.table_id`（及若有桌名快照列）改为目标桌
- round `status`、lines、votes、冷却 **不变**
- Realtime 仍按 `session_id` 过滤，顾客无需换轮次订阅键；扫码若仍带旧 `table_id` 按现有转台顾客 URL 规则处理

#### 并台（`merge_table_sessions`）

- 来源 session → `closed`（`closed_reason=merged`）；订单挂到目标 session（现有规则）
- 来源 session 上所有未 `closed` 的 round → **在同一 RPC 事务内** `status=closed`；**lines / votes 作废，不合并进目标**
- 目标 session 的活跃 round **不动**（不自动并入来源篮子）
- 若目标正在 `pending_confirm`：该轮 `guest_count_snapshot` **不因并台改写**（与确认期冻结一致）；下一轮 collecting 再用并台后 live 人数
- 服务员 UI：来源桌有 `collecting` / `pending_confirm` 且 lines qty > 0 时，确认弹窗须明示：  
  `来源桌有未送厨的本轮菜，并台后将作废，无法送厨`

#### 关台 / billing

- 关台或进入 `billing` 的 session：未 `closed` round → `closed`（优先在关台/billing RPC 或同一写路径事务内完成；不得留下活跃 round）

---

## 12. UI（SushiMenuPage）

| 元素 | 行为 |
|------|------|
| 顶栏 | `本桌 N 人 · 每轮免费菜最多 M 份`；collecting 显示整桌 `本轮 x/M`（**无**送厨按钮） |
| pending_confirm | 全员确认 modal + `已确认 a/N · 约 Ts`；**不显示**否决者 |
| 底栏 | 与 classic 同一 `CustomerMenuFooter`：购物车 → **下单**；有本机未送厨免费菜 → **本轮核单**（可兼入口查看已点）；已送厨 → **查看已点** |
| 免费菜 `+` | 仅写入本机购物车（可写备注）；**下单**才 upsert 本 `guest_client_id` 的 round lines |
| 本轮核单 | 只列出**本机**未送厨免费菜 + **送厨本轮**（唯一送厨入口） |
| 收费菜 | 同一购物车 + 即时 append |
| Intro | 一次；下单进核单 / 只看自己的 / 送厨确认 |

Classic **不得**出现轮次 UI 组件。

---

## 13. 性能（实现必做）

- lines **upsert**（同 round + item + client 合并 qty + note）
- 购物车「下单」一次提交；**禁止**卡片 debounce 直写 round
- finalize **按 (menu_item_id, note) 聚合**（唯一函数 `aggregateRoundLinesForAppend`，append parse 共用）后条件更新防双 append；**禁止**再按 item 把不同备注拼成一行
- session 级限流（§9）

---

## 14. 错误码（API）

| code | 含义 |
|------|------|
| `round_not_collecting` | 非 collecting 却加菜 |
| `round_basket_locked` | pending_confirm 改 lines |
| `round_cap_exceeded` | 超轮次上限（人数 ≥ 1） |
| `guest_count_required` | 用餐人数为 0（未登记自助人数） |
| `round_empty` | 空篮送厨 |
| `round_defer_cooldown` | 暂缓冷却中 |
| `round_defer_already_used` | 本轮已暂缓过 |
| `round_confirm_pending` | 已在确认中重复发起 |
| `round_cooldown_active` | 桌级冷却 |
| `session_billing` | 结账中 |
| `guest_client_limit` | 超额 client 登记 |
| `per_person_limit_exceeded` | 整餐免费菜上限（append 前） |

---

## 15. 当前不做

- 两阶段超时（先等在线设备再补默认票）— 二期
- 顾客可见否决者编号
- 暂缓原因
- 共享收费菜轮次
- 新 URL / 新 QR
- 顾客端 orders Realtime（仍靠 session reconcile）

---

## 16. 相关代码（待建）

| 类型 | 路径 |
|------|------|
| 页面分支 | `app/[slug]/menu/page.tsx` → `SushiMenuPage` / `ClassicMenuPage` |
| UI | `components/menu/sushi/*` |
| API | `app/api/restaurants/[slug]/table-order-round/**` |
| Lib | `lib/table-order-round/*` |
| 设置 | `FeatureFlagsManager`、`api/restaurant/features` |
| Schema | `supabase/migrations/*table_order_round*` |

---

## 17. 验收清单

- [ ] 3 人桌 2 手机：第 3 票超时默认同意，~25s 送厨
- [ ] 暂缓二次确认；每轮 1 次；30s 内不可再发起
- [ ] pending_confirm 不可写入 round lines（购物车可加免费菜，下单被拒）
- [ ] 收费菜即时 append，不占轮次额度
- [ ] 整餐免费菜限量仅 `price=0`
- [ ] finalize 幂等；append 失败可重试不双送
- [ ] billing / 关台：round 同路径 closed
- [ ] 转台：session 不变，round.table_id 在 `transfer_table_session` 同事务更新
- [ ] 并台：来源 round 同事务 closed、篮子作废；目标 round 不自动合并；有未送厨篮子时服务员确认文案
- [ ] classic 零回归
- [ ] 员工代点绕过轮次
- [ ] on-prem Realtime UAT
