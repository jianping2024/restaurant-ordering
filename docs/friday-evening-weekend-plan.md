# 自助餐「周五晚上按周末计价」— 设计修改计划

## 1. 背景与需求

**业务诉求**：自助餐在**周五晚上**应使用与**周六、周日**相同的「周末」价格规则，而不是「平日」价。

**典型场景**：

| 时间 | 期望日历类型 | 说明 |
|------|-------------|------|
| 周五 12:00 午市 | `weekday` | 仍按平日价 |
| 周五 19:00 晚市 | `weekend` | 与周六晚市同价 |
| 周六 / 周日全天 | `weekend` | 不变 |
| 周五若标记为节假日 | `holiday` | 节假日优先，不变 |

---

## 2. 现状（问题根因）

### 2.1 日历类型判定

当前 `calendar_kind` 仅由**里斯本时区下的星期几**决定，与具体时刻无关：

```sql
-- supabase/migrations/20260512150000_resolve_buffet_prices_nearest_slot.sql
elsif v_dow in (0, 6) then   -- 仅周六(6)、周日(0)
  v_cal := 'weekend';
else
  v_cal := 'weekday';        -- 周五(5) 永远走这里
end if;
```

前端预览辅助函数 `getDayKindForDate()`（`src/lib/buffet-pricing-admin.ts`）同样只认日期、不认时刻，周五一律返回 `weekday`。

### 2.2 与时段的关系

- **时段**（`buffet_time_slots`）负责：当前时刻落在哪个「午市 / 晚市」窗口。
- **价格规则**（`buffet_price_rules`）负责：`buffet × 时段 × calendar_kind × 有效期` 四维匹配。
- 周五晚上若运营只配了「晚市 × 周末」价、未配「晚市 × 平日」价，则 `resolve_buffet_prices` 会**匹配不到规则**，服务员端无法展示/落单自助餐价。

### 2.3 优先级（保持不变）

```
holiday（日历覆盖） > special（活动日） > 周末判定 > weekday
```

本次改动**只扩展「周末判定」**，不改动节假日 / 特殊日逻辑。

---

## 3. 方案对比

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 餐厅级起始时刻** | 在餐厅设置「周五起算周末价的时刻」，如 `18:00` | 配置一次、运营易懂；改 SQL 一处即可 | 无法区分「同一时刻不同时段不同策略」（极少见） |
| **B. 时段级开关** | 每个时段增加「周五落入本时段时按周末计价」 | 与「晚市 = 周末价」心智一致；午/晚可不同 | 多时段都要勾选；SQL 需先选时段再定 calendar_kind |
| **C. 复制规则** | 周五晚市再建一套 `weekday` 规则，价格填周末价 | 零代码 | 易漏配、难维护、预览/冲突检测误导 |
| **D. 新 calendar_kind** | 增加 `friday_evening` | 语义最精确 | 破坏现有四维模型；矩阵、筛选、i18n 全要扩 |

**推荐：A + B 组合，默认走 A，B 作为可选覆盖。**

- **默认（A）**：`restaurants.buffet_friday_weekend_from`（`time`，可空）。非空时：周五且本地时刻 ≥ 该值 → 视为 `weekend`。
- **可选（B）**：`buffet_time_slots.friday_uses_weekend_pricing`（`boolean`，默认 `false`）。为 `true` 的时段在**周五且时刻落在该时段内**时，强制 `weekend`（用于 A 不适用时的细调；若与 A 同时存在，**取更「像周末」的一侧：任一为真即 weekend**）。

单店当前阶段可**只实现 A**，已足够覆盖「周五晚上算周末」；B 可在第二期加。

---

## 4. 推荐设计（方案 A 详述）

### 4.1 配置项

| 字段 | 表 | 类型 | 说明 |
|------|-----|------|------|
| `buffet_friday_weekend_from` | `restaurants` | `time`，nullable | 为空 = 关闭（行为与现网一致）；如 `18:00:00` 表示周五 18:00 起按周末价 |

**后台入口**：自助餐设置页顶部或「价格规则」Tab 增加一块 **「周末扩展」**：

- 开关：周五晚上是否按周末计价
- 时间选择：起算时刻（`TimeHmInput`，里斯本墙钟）
- 说明文案：「仅影响周五；周六、周日逻辑不变；节假日仍以特殊日期为准。」

### 4.2 解析算法（`resolve_buffet_prices`）

在现有 `v_cal` 赋值之后、选时段之前插入：

```
if v_override is null                    -- 非 holiday / special
   and v_dow = 5                         -- 周五 (PostgreSQL dow: 0=周日 … 5=周五)
   and v_friday_from is not null         -- 餐厅已配置
   and v_t >= v_friday_from
then
  v_cal := 'weekend';
end if;
```

其中 `v_friday_from` 自 `restaurants` 读出（`p_restaurant_id`）。

**注意**：时区仍用 `Europe/Lisbon`（与现网一致）；`v_t` 已是本地墙钟。

### 4.3 前端镜像逻辑

扩展 `getDayKindForDate` → 新增 **`getDayKindForDateTime(date, time, overrides, opts?)`**：

```ts
// 伪代码
function getDayKindForDateTime(date, time, overrides, { fridayWeekendFrom }) {
  const base = getDayKindForDate(date, overrides); // holiday/special/Sat-Sun
  if (base !== 'weekday') return base;
  if (isFriday(date) && fridayWeekendFrom && time >= fridayWeekendFrom) return 'weekend';
  return 'weekday';
}
```

**必须与服务端 SQL 保持同一套规则**，供：

- 价格预览（`BuffetPricePreview`）
- 价格矩阵缺价提示（`BuffetCalendarPanel` 对周五的 coverage 检查需分「日级默认」与「晚市时刻」或改为按预览时刻检查）

### 4.4 运营配置不变的部分

- 仍配置 **「晚市 × 周末」** 与 **「午市 × 平日」** 等规则，**无需**为周五单独建 `calendar_kind`。
- 周五 19:00 会自动命中「晚市 × 周末」行；周五 12:00 仍命中「午市 × 平日」。

---

## 5. 数据模型变更

### 5.1 Migration（建议文件名）

`supabase/migrations/YYYYMMDDHHMMSS_buffet_friday_evening_weekend.sql`

```sql
alter table public.restaurants
  add column if not exists buffet_friday_weekend_from time;

comment on column public.restaurants.buffet_friday_weekend_from is
  'Lisbon local time: on Fridays at or after this time, buffet pricing uses calendar_kind=weekend. NULL = disabled.';

-- replace resolve_buffet_prices (copy latest body + Friday branch)
```

### 5.2 TypeScript 类型

- `Restaurant` 接口增加 `buffet_friday_weekend_from?: string | null`（`HH:MM` 或 `HH:MM:SS`）
- 餐厅 settings API / dashboard 读取与保存该字段

### 5.3 可选第二期（方案 B）

```sql
alter table public.buffet_time_slots
  add column if not exists friday_uses_weekend_pricing boolean not null default false;
```

---

## 6. 界面与文案

| 位置 | 改动 |
|------|------|
| `BuffetSettingsManager` 或独立 `BuffetWeekendPolicyPanel` | 周五周末起算时刻配置 |
| `BuffetSettingsGuide` | 增加一步说明周五晚市策略 |
| `i18n/messages.ts` | `kindHelpWeekend` 改为「周六、周日，以及已配置的周五晚上」；新增配置项中英文/葡文 |
| `BuffetPricePreview` | 展示「生效日历类型」时用 `getDayKindForDateTime`，避免周五晚上仍显示「平日」 |
| `BuffetCalendarPanel` | 周五行增加提示：「默认按平日；若已设周五晚周末时刻，请确保晚市 weekend 价已配置」 |

---

## 7. 影响面清单

| 模块 | 是否必改 | 说明 |
|------|----------|------|
| `resolve_buffet_prices` | ✅ | 唯一权威计价入口 |
| `getDayKindForDate` / 新 datetime 版 | ✅ | 后台预览与缺价检测 |
| 服务员落单 API（`staff/waiter/buffet`） | 间接 | 已调 RPC，随 DB 函数生效 |
| 已锁定订单行 | ❌ | 落单时价格已锁定，规则变更不回溯 |
| `docs/buffet-pricing-design.zh.md` | ✅ | 4.3 / 4.4 节补充周五策略 |
| 价格矩阵 `BuffetPriceMatrix` | 可选 | 可在周五列标注「12:00 平日 / 19:00 周末」图例 |

---

## 8. 测试用例

### 8.1 SQL / RPC（里斯本时区）

假设 `buffet_friday_weekend_from = 18:00`，晚市 slot 18:00–22:00，规则：午市 weekday €15、晚市 weekend €25。

| `p_at`（里斯本） | 期望 `calendar_kind` | 期望命中 |
|------------------|---------------------|----------|
| 2026-05-22 Fri 12:00 | weekday | 午市 weekday €15 |
| 2026-05-22 Fri 18:00 | weekend | 晚市 weekend €25 |
| 2026-05-22 Fri 17:59 | weekday | 午市或最近 slot 的 weekday |
| 2026-05-23 Sat 12:00 | weekend | 周末规则 |
| 2026-05-22 Fri 20:00 + 当日 holiday 覆盖 | holiday | 节假日优先 |
| `buffet_friday_weekend_from = NULL` | 与现网一致 | 周五全天 weekday |

### 8.2 边界

- 跨日时段（22:00–02:00）在周五 23:00：calendar_kind = weekend（周五晚上分支先成立）。
- 跨日时段在周六 01:00：`v_dow = 6`，已是 weekend，不依赖周五配置。
- 夏令时切换日：沿用现有 Lisbon TZ 转换，不单独处理。

### 8.3 前端

- 保存 `buffet_friday_weekend_from` 后预览周五 19:00 显示 weekend 与正确价格。
- 关闭开关（置 NULL）后行为回退。

---

## 9. 实施步骤（建议顺序）

1. **Migration**：加列 + 更新 `resolve_buffet_prices`。
2. **`buffet-pricing-admin.ts`**：实现 `getDayKindForDateTime`，单测覆盖周五前后时刻。
3. **餐厅 settings API + Dashboard UI**：读写 `buffet_friday_weekend_from`。
4. **预览 / 日历提示**：接入 datetime 版 day kind。
5. **更新** `buffet-pricing-design.zh.md` **与本计划状态**。
6. **Staging 验证**：用真实晚市/午市 slot 与规则走通服务员落单。

预估工作量：**小～中**（约 0.5–1 天，若只做方案 A）。

---

## 10. 待产品确认（Open questions）

1. **起算时刻默认值**：新餐厅默认 `NULL`（关闭）还是默认 `18:00`（开启）？建议 **NULL**，由店长显式开启，避免误伤已有仅配 weekday 规则的店。
2. **「晚上」定义**：是否统一为一个时刻阈值即可，还是必须按「晚市时段开始时间」自动推导？建议 **可配置时刻**，默认与晚市 `start_time` 对齐的 UX 快捷按钮（「与晚市开始时间同步」）。
3. **周五白天是否可能标为 special/holiday**：已支持，覆盖优先于周五周末扩展。
4. **是否二期做时段级开关（方案 B）**：若存在「周五 17:00 下午茶仍平日、17:30 另一 slot 算周末」等复杂排期再开。

---

## 11. 小结

| 项 | 决策 |
|----|------|
| 核心改动 | 扩展「周末」判定：周五 + 本地时刻 ≥ 可配置阈值 → `calendar_kind = weekend` |
| 存储 | `restaurants.buffet_friday_weekend_from`（`time`, nullable） |
| 权威逻辑 | `resolve_buffet_prices`；前端镜像用于预览 |
| 运营操作 | 继续维护「时段 × 周末/平日」价格矩阵，无需 duplicate 周五规则 |
| 兼容性 | NULL = 现网行为；已落单订单不受影响 |
