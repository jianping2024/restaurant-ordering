# 本次改动业务场景测试报告：数据概览当日营业额按开桌日统计

**日期：** 2026-10-21  
**分支：** `fix/dashboard-revenue-opened-at`  
**需求：** 数据概览「当日营业额」（已收）及同集合的今日桌数/今日客人，按里斯本开桌日 `opened_at` 归属；增值分析同口径。未收仍为全场在开桌未结清合计。

---

## 1. 本次修改

- **内容：** 关台合格会话的营业日从「关台日」改为「开桌日」；取数窗口按 `opened_at`；唯一分桶 `sessionRevenueDateKey`。
- **文件：** `session-revenue-date.ts`、`build-overview.ts`、`closed-session-revenue.ts`、`analytics.repository.ts`、RPC 迁移、产品文档。
- **角色 / 页面：** 店主 · 数据概览；增值分析日趋势（同口径）。
- **流程：** 开桌 → 点餐收款 → 关台 → 概览已收计入开桌日。

## 2. 核心业务规则

1. 【本次新增】已收 / 今日桌数 / 今日客人：`opened_at` 的 Lisbon 自然日 = 归属日。
2. 【已实现】仍只统计已关台且合格（qualifying）会话；强关未付不计。
3. 【已实现】未收 = 当前所有 open|billing 桌的未结清，不按开桌日切。
4. 【本次新增】昨开今关 → 计入开桌日；今开明关 → 关台后计入开桌日（关台日不计）。

## 3. 详细测试场景

### 场景 1：同日开同日关 → 计入当日已收

- **前置状态：** 店主登录；本里斯本日尚无该桌记录。
- **操作过程：** 开一桌 → 下单收款 → 当日关台 → 打开数据概览。
- **预期结果：** 已收增加该桌金额；今日桌数 +1；今日客人与该桌一致。
- **数据验证：** 会话 `opened_at`/`closed_at` 同属 Lisbon 今日；`todayRevenue` 含该笔。
- **异常恢复：** 刷新概览后数字不变。
- **标签：** 【已验证】（见 §4 API/单测）

### 场景 2：昨开今关 → 不进今日已收

- **前置状态：** 会话 `opened_at` = 昨日 Lisbon，`closed_at` = 今日；已合格关台。
- **操作过程：** 查看「今日」已收（或单测等价）。
- **预期结果：** 今日已收不含该笔；开桌日含该笔。
- **数据验证：** `todayRevenueFromBundle(开桌日)` > 0；`todayRevenueFromBundle(关台日)` = 0。
- **异常恢复：** 不适用。
- **标签：** 【已验证】（单测 `counts revenue on opened_at day even when closed the next Lisbon day`）

### 场景 3：今开仍未关 → 只在未收

- **前置状态：** 今日开桌，仍 open|billing，有未结金额。
- **操作过程：** 看概览已收与未收。
- **预期结果：** 已收不加该桌全额；未收可见该桌欠款。
- **数据验证：** live 会话不进 closed-session revenue bundle。
- **异常恢复：** 关台收款后已收进开桌日。
- **标签：** 【已验证】（API 概览结构 + 口径代码路径）

### 场景 4：强关未付不计

- **前置状态：** 强制/未付关台会话。
- **操作过程：** 计入当日 KPI。
- **预期结果：** 不进已收、不进今日桌数。
- **标签：** 【已验证】（单测 forced close）

### 场景 5：增值分析与概览同日口径

- **前置状态：** 同批 closed qualifying 会话。
- **操作过程：** 对比概览当日已收与增值分析该 Lisbon 日营业额分桶规则。
- **预期结果：** 均用 `sessionRevenueDateKey(opened_at)`，无第二套关台日分桶。
- **标签：** 【已验证】（代码唯一写法 + `buildRevenueTrend` 单测）

### 场景 6：顺序/并发

- **说明：** 统计为只读聚合；并发关台不改变「按开桌日」规则。两桌同日开、先后关，均计入开桌日。
- **标签：** 【未验证】（本地未做双端同时关台；风险低）

### 场景 7：历史日表

- **说明：** 已 seal 的 `analytics_daily_*` 若曾按关台日写入，与新口径可能不一致；当日现算走新口径。本次未要求 backfill。
- **标签：** 【未验证】（需产品决定是否重算历史）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 单测 closed-session-revenue / buildRevenueTrend / rpc map | **pass** |
| mesa-local-uat stack-health + owner login + GET /dashboard | **pass**（`:3006`） |
| GET `/api/dashboard/revenue-interval`（opened_at 窗） | **pass** |
| 浏览器概览：已收 €0 + 未收 €150 + 今日桌 0 + 用餐桌 4 | **pass** |
| 本地 RPC 按 `opened_at` 取窗 + 索引 | **pass** |
| 场景 6 双端并发关台 | 【未验证】 |
| 场景 7 历史 seal 日表 backfill | 【未验证】 |

## 5. 风险与待确认

- 历史 seal 日表未 backfill：回看旧日曲线可能仍是关台日口径。
- 跨午夜开桌的桌，关台前只在未收；关台后整笔进开桌日。
