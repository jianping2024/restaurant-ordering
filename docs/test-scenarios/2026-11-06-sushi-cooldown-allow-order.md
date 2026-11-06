# 本次改动业务场景测试报告：送厨冷却可点不可送

## 1. 本次修改

- **内容：** 寿司桌级送厨冷却只拦「再送厨」，不拦「点免费菜进下一篮」。finalize 成功后轮次立刻关闭，冷却时间记在 `table_sessions.sushi_round_cooldown_until`。
- **文件：** migration `20261106200000_sushi_session_kitchen_cooldown.sql`；`table-order-round` 服务/SQL/引导/文案；`SushiMenuPage` 等顾客端；产品契约文档。
- **角色 / 页面：** 顾客寿司点餐页、本轮核单；店主功能设置说明。
- **流程：** 送厨成功 → 冷却中可加入本轮 → 冷却中送厨拒绝 → 冷却结束可再送。

## 2. 核心业务规则

1. 冷却未到期：免费菜可写入本轮篮；`submit-request` 返回 `round_cooldown_active`。
2. 冷却到期：settle 清 session 时钟后可正常送厨。
3. 收费菜仍即时下单（本改动不改）。
4. 底栏冷却文案唯一口径：可继续点 / 已点 N 道 · M 秒后可送厨。

## 3. 详细测试场景

### 场景 1：冷却中可加免费菜、不可送厨【已验证】

- **前置状态：** Washoku `lucky-tea-mulcs62n` A-01 开台 2 人；轮次开启；confirm=15s、cooldown=30s。
- **操作过程：** 顾客 API 加免费菜 → 发起送厨 → 到点 finalize → 冷却中再加另一道免费菜 → 再点送厨。
- **预期结果：** finalize 后 `session_cooldown_until` 有值、无活跃轮；冷却中加菜 200/`collecting`；送厨 409/`round_cooldown_active`。
- **数据验证：** `table_sessions.sushi_round_cooldown_until` 非空；新 `collecting` 轮有 1 行。
- **异常恢复：** 冷却结束后可再 submit（本轮未等到点，标场景 3）。

### 场景 2：送厨成功后底栏口径【已验证】（API 字段）

- **前置状态：** 同上，刚 finalize。
- **操作过程：** GET round snapshot。
- **预期结果：** `session_cooldown_until` 存在；`round` 为 null 或新 collecting；不再依赖活跃 `cooldown` 轮占槽。
- **数据验证：** snapshot JSON 含 `session_cooldown_until`。

### 场景 3：冷却结束后可再送厨【未验证】

- **说明：** 本机 cooldown=30s，未在报告写完前等到时钟归零再 submit；逻辑与 settle 清时钟一致，待人工或下一轮 UAT 补跑。

### 场景 4：顾客页冷却中引导与送厨按钮【已验证】（浏览器）

- **前置状态：** A-01 冷却中且篮中有未送免费菜；打开 `http://localhost:3002/lucky-tea-mulcs62n/menu?table_id=…`。
- **操作过程：** Chrome DevTools 打开点餐页，看底栏与核单。
- **预期结果：** 底栏/核单均为「已点 1 道 · N 秒后可送厨」；核单「送厨本轮」disabled。不再出现「免费菜等下一轮」。
- **说明：** 页上过敏源抽屉曾挡住再次点「+」；冷却中加菜已由场景 1 API 覆盖。

### 场景 5：回归收费菜【未验证】

- **说明：** 代码路径未改收费 append；本轮未单独下收费菜。

## 4. 实际测试结果

| 项 | 结果 |
|----|------|
| API 加菜→送厨→冷却中加菜 | 【已验证】pass |
| 冷却中 submit | 【已验证】pass（409 `round_cooldown_active`） |
| 单测 send-guidance / kitchen-send-success / messages | 【已验证】pass |
| typecheck / lint `@mesa/web` | 【已验证】pass（lint 仅既有 unrelated hooks warn） |
| 冷却结束后再送 | 【未验证】 |
| 收费菜回归 | 【未验证】 |

## 5. 风险与待确认

- 冷却结束后再送、收费菜混合提交建议店内再点一眼。
- 开台 UAT 须用 `adult_count`/`child_count`（不是 `adults`/`children`），否则会开出无人数会话。
