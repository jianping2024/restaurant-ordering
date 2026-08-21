# Farvoo ↔ 打票系统：账单同步

**读者：** Restaurant（点餐/结账）/ Farvoo 打票 Agent 实现方  
**日期：** 2026-08-21  
**状态：** 宏翔合作已结束。投递主路径：**云端挂单 + Agent 复用打印同款 Realtime/拉取**（不用浏览器直 POST Agent）。

## 职责拆分（定稿）

| 侧 | 管什么 | 不管什么 |
| --- | --- | --- |
| **Restaurant（结账）** | 功能开关；点「同步账单」写入云端 `bill_sync_jobs`；记操作；成功提示「同步完成」 | 分单开票、出税票、打票工作台；同步后在 Farvoo 改票 |
| **Farvoo 打票（Agent）** | Realtime/补偿/fallback 拉取；本地临时表（JSON）；本机分单/打票/重打；按 `item_code` upsert 商品；ack | 替代 Restaurant 结账；跟关台绑死 |

**产品口径：** Restaurant 只提供**账单初稿**。同步后改动在打票本机做；照理同步后应关台。关台不影响 Agent 草稿与开票/重打。

发票开票人 = **打票本地登录账号**（≠ 点同步的人）。  
**全店仅一台 Agent。**  
金额：**十进制字符串**。`source_system` 固定 `"farvoo"`。

---

## 1. 总流程

```text
结账页点「同步账单」（开关已开 + 已登录）
  → 云端写入 bill_sync_jobs（pending）+ 操作记录
  → Agent：复用打印同款机制
       · Realtime 订 bill_sync_jobs（门铃）
       · 或启动/重连 compensation
       · Realtime 挂了才 fallback 轮询
  → Agent 持 agentjwt：GET pending-bill-syncs
  → 写入/覆盖本地临时表 → upsert 商品 → ack
  → 结账页「同步完成」（或失败/超时可再同步）
  → 店员在 Agent 本机：读临时表 → 分单 / 打票
```

**鉴权：** 完全复用打印配对 claim 的 **`agentjwt`**（Agent → Farvoo）。不为同步再配对、不做浏览器→Agent 密钥、不依赖收银机知道 Agent 局域网地址。

---

## 2. 功能开关（默认关闭）

| 项 | 定法 |
| --- | --- |
| 键 | `bill_sync_to_fiscal`（见 [`restaurant-features.zh.md`](../restaurant-features.zh.md)） |
| 默认 | **关闭** |
| 开启后 | 结账页出现「同步账单」 |
| 关闭时 | 入口隐藏；入队 API **拒绝** |
| 独立于 | `bill_receipt_print` |

---

## 3. 与打印小票：一条管道、两种任务

**定法：不另起一套拉取。** 仍是现有那一个 Agent、同一条 Realtime 连接、同一套 `agentjwt`、同一种「门铃 → 拉一次 → fallback」骨架；只是**多盯一张表、多一种 pending**。

| | 打印小票 | 账单同步 |
| --- | --- | --- |
| 云端表 | `print_jobs` | **`bill_sync_jobs`（另表）** |
| 发现 | Realtime 订 `print_jobs` → `GET pending-jobs` | 同一 Notifier **加订** `bill_sync_jobs` → `GET pending-bill-syncs` |
| 凭证 | `agentjwt` | **同一 `agentjwt`** |
| Realtime 会话 | claim 下发的员工 session + anon_key | **同一条连接上的同一套 session** |
| 成功 | 出纸 | 初稿进 Agent 临时表 |
| Fallback | Realtime 失败 → polling pending-jobs | **同一次 fallback 回路**里顺带（或紧挨着）拉 pending-bill-syncs |

实现约束：

- **一条管子，两种货**：拉到打印任务 → 出纸；拉到同步任务 → 写临时表。  
- compensation / 重连补拉：可同轮拉取两种 pending，或同一 Notifier 内两次 GET；**禁止**再开第二个 Realtime 客户端 / 第二套独立轮询专干同步。  
- 禁止把同步行塞进 `print_jobs`。

---

## 4. 鉴权（细节）

| 项 | 定法 |
| --- | --- |
| 谁调谁 | **Agent → Farvoo 云端**（与拉打印同向） |
| REST | `Authorization: Bearer <agentjwt>` |
| Realtime | 现有 print-agent session（与订 `print_jobs` 相同来源） |
| 店员入队 | 开关 + 登录 + 结账权限；操作记录记 Restaurant user |
| 不做 | 浏览器直 POST Agent；`bill_sync_secret`；为同步 pair-terminal |

---

## 5. 挂单载荷（`bill_sync_jobs` 快照）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `request_id` | string (uuid) | 本次点击；网络重试同一次沿用 |
| `source_system` | `"farvoo"` | 固定 |
| `source_sale_id` | string (uuid) | 账单 ID（覆盖键） |
| `table_display_name` | string | 如 `"018"` |
| `scope_type` | `"whole_table"` \| `"split"` | |
| `lines` / `gross_total` | | 仅 `whole_table` |
| `splits` | array | 仅 `split`（业务分单初稿，仅参考） |

### `lines[]`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `item_code` | string | **必填非空** |
| `name` | string | |
| `qty` | string | 不入主档 |
| `unit_price_gross` | string | |
| `line_gross` | string | 不入主档 |
| `vat_rate` | string | **百分数点两位**，如 `"13.00"`、`"23.00"`（表示 13% / 23%）。**禁止** `"0.13"` / `"0.23"` 小数率。入队与 Agent 均校验；不符 → 整单失败 |

---

## 6. Agent：临时表 + 覆盖 + 商品

**临时表（Agent SQLite）：**  
`id` / `request_id` / `source_sale_id` / `payload_json` / `status`(`open`\|`invoiced`\|`discarded`) / 时间戳。

**同 `source_sale_id` 再同步：**

| 本地状态 | 定法 |
| --- | --- |
| 无行 / `open` / `discarded` | **覆盖**为最新快照（丢弃上一份 `open`） |
| 已 `invoiced` | **整单失败**，ack `failed`，原因码建议 `already_invoiced`；**不覆盖**、不改税票。结账页展示失败原因（可再引导去 Agent 重打/NC）。不「静默忽略当成功」 |

**关台：** 与 Agent 无关。

**ack 顺序（必须）：**  
校验（含 `item_code`、`vat_rate` 格式、同行同 code 冲突）→ **写/覆盖临时表** → **upsert 商品成功** → **再** ack `succeeded`。  
任一步失败 → ack `failed` + **可读 `error_message` / 原因码**（云端与结账页原样可展示）。  
**禁止**先 ack 再写表（否则云端 succeeded、本机无草稿）。写表与 upsert 宜同一本地事务或等价「全成或全败再 ack」。

**同 code 冲突：** 同一请求内同 `item_code` 若 `name` / `unit_price_gross` / `vat_rate` 不一致 → 整单失败并回传原因，不部分写入。

不自动开 FT。

### 与「直连开 FT」双路径防重（定稿）

账单同步 **只**产临时表草稿；正式 FT 仍走 Agent 开票（本机工作台或既有 Local API `fiscal-documents`）。

| 规则 | 定法 |
| --- | --- |
| 同步本身 | 不创建税务文件，不占 InvoiceNo |
| 开 FT 幂等 | 与 [`farvoo-fiscal-agent-integration.zh.md`](./farvoo-fiscal-agent-integration.zh.md) §3.1 一致：业务键含 `source_system` + `source_sale_id` + `scope_type` + `scope_id` + `fiscal_purpose`；**无论**草稿来自同步临时表还是桌台直推销售快照，同一业务键不得签出第二张 FT |
| 已有 FT 后再同步 | 见上：临时表已 `invoiced` → 同步 ack `failed` / `already_invoiced`；未标 invoiced 但税务库已有同业务键 FT → 开票路径幂等返回原票，同步覆盖 `open` 草稿不自动再开 |

---

## 7. Realtime / 防遗漏（复用打印，针对新表）

`pending` → `processing` → `succeeded`（临时表+商品已落盘）| `failed`。

| 规则 | 定法 |
| --- | --- |
| 发现 | **同一条** Agent Realtime/fallback 管道上加订 `bill_sync_jobs`（不另起第二套拉取） |
| 补偿 | 订阅成功/重连后立刻拉 pending（可与打印 pending 同轮） |
| Fallback | 仅 Realtime 不可用时，在**原有** polling 回路中兼拉 `pending-bill-syncs` |
| 表侧必做 | `bill_sync_jobs` **单独**加入 `supabase_realtime` publication + 本店可读 RLS（session 能订到行；与 `print_jobs` 配置同类、表不同） |
| 同 `request_id` | 重放不双写 |
| 同 `source_sale_id` 新单 | 新 `request_id`；`open` 则覆盖；`invoiced` 则 failed |
| 文案 | ack 成功后结账页才示 **「同步完成」**（以云端 job=`succeeded` 为准，不以「仅入队」为准） |
| 实现锁 | 改 `realtime.go` / Notifier 时注释+测试锁死「单连接多表」；禁止拆成第二套独立轮询 |
| 禁止 | 主路径 interval；同步进 `print_jobs`；多 Agent |

---

## 8. UI

**Restaurant：** 结账页「同步账单」；job=`succeeded` →「同步完成」；`failed`（含 `already_invoiced`、校验失败）展示回传原因并可再试（已开票场景再试仍应失败直至产品另定）。未配对/超时 pending → 提示未送达。不做打票工作台。

**可选：** 打印助手只读投递历史（与小票分栏）。

**Agent：** 临时表草稿 → 分单 + 打票 + 重打。开票人依赖打票本机登录（§13）；临时表有草稿 ≠ 已能合规开票（名册/PIN/登录未齐时体验会卡，属打票侧依赖，不在同步管道内假装闭环）。

---

## 9. HTTP（示意）

均需 `Authorization: Bearer <agentjwt>`：

```http
GET  /api/print-agent/pending-bill-syncs
POST /api/print-agent/bill-syncs/{id}/ack
# ack body: { "status": "succeeded"|"failed", "error_code"?: "...", "error_message"?: "..." }
```

员工会话入队：

```http
POST /api/.../bill-syncs    # 写 bill_sync_jobs + 操作记录；开关关闭 → 拒绝
```

---

## 10. 载荷示例

```json
{
  "request_id": "8f3c1a2e-6b14-4d90-9c2a-1b7e0d4a9f21",
  "source_system": "farvoo",
  "source_sale_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "table_display_name": "018",
  "scope_type": "whole_table",
  "lines": [
    {
      "item_code": "BF-LUNCH-ADULT",
      "name": "BUFFET ADULTO ALMOCO",
      "qty": "3",
      "unit_price_gross": "14.95",
      "line_gross": "44.85",
      "vat_rate": "13.00"
    },
    {
      "item_code": "006",
      "name": "CERVEJA SUPERBOCK",
      "qty": "1",
      "unit_price_gross": "2.25",
      "line_gross": "2.25",
      "vat_rate": "23.00"
    }
  ],
  "gross_total": "47.10"
}
```

---

## 11. 明确不做

- 浏览器直 POST Agent / `bill_sync_secret` / 依赖 `agent_base` 局域网发现（已否决为主路径）  
- 同步任务写入 `print_jobs`  
- **另起第二套** Realtime 客户端或独立轮询专干账单同步  
- 为同步再配对或 pair-terminal  
- 同步 = 自动开 FT  
- 结账页打票工作台  
- 多 Agent  
- 关台清 Agent 草稿  
- 成功文案暗示已开票；**仅入队未 ack 就显示「同步完成」**  
- 空 `item_code`；`vat_rate` 用 `"0.13"` 小数率  
- 已 `invoiced` 再同步时静默当成功或覆盖税票草稿语义  
- 先 ack `succeeded` 再写临时表  
- 同 code 冲突时部分落库且不回传原因  
- 默认开启 `bill_sync_to_fiscal`  
- 主路径 interval 轮询  

---

## 12. 实现必齐 / 联调埋雷点（结论）

管道方案风险可控；下列**不定或不落地则联调必炸**——编码可先搭骨架，合并前必须齐：

**高优先级**

| 项 | 要求 |
| --- | --- |
| 云端表/API/Realtime | `bill_sync_jobs` + publication + RLS + `pending-bill-syncs` / ack；缺一则 Restaurant 再完整也空转 |
| 税率字符串 | 统一 `"13.00"` 百分数点两位，禁止 `"0.23"` |
| 与直连开 FT 双路径 | 开票业务幂等键防双开（§6）；同步不签 FT |
| 已 invoiced 再同步 | ack `failed` + `already_invoiced`，结账页与 ack 语义对齐 |

**中等（实现时防）**

| 项 | 要求 |
| --- | --- |
| 一条管子加订 | 禁止第二套 Realtime/轮询；改 Notifier 用注释+测试锁死 |
| ack 时机 | 临时表 + upsert 成功后再 ack |
| 同单商品冲突 | 整单失败 + 原因回传 |
| 开票人 / §13 | 工作台开票仍依赖打票登录；同步闭环 ≠ 开票闭环 |

**已知非目标（定法不是洞）**  
不自动开 FT、不混 `print_jobs`、不多 Agent、关台不清草稿；落盘临时表已覆盖「重启丢单」。
