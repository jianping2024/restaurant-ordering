# 本次改动业务场景测试报告：经典业态掩藏寿司功能设置

日期：2026-11-01  
分支：`fix/hide-sushi-features-classic`

## 1. 本次修改

- **内容**：功能设置页「寿司同桌轮次」整卡仅在 `buffet_service_mode = sushi` 时展示；经典业态不展示，保存请求不带该组字段；`PATCH /api/restaurant/features` 在经典业态下忽略寿司字段写入（库内已有值保留）。
- **文件**：`FeatureFlagsManager.tsx`、`settings/features/page.tsx`、`api/restaurant/features/route.ts`、`docs/product/04-business-rules.md`、`docs/agent-sole-index.zh.md`
- **角色 / 页面**：店主或有 `settings.features.manage` 的员工 → Dashboard → 餐厅设置 → 功能设置
- **唯一写法**：是否可配寿司轮次设置 = `isSushiBuffetMode(本店 buffet_service_mode)`（UI 显隐与 API 写入同一判定）

## 2. 核心业务规则

1. 【本次新增】经典业态：功能设置不出现「寿司同桌轮次」整卡。
2. 【本次新增】经典业态：保存其它功能项时，不改写寿司相关列。
3. 【本次新增】经典业态：即便请求体带寿司字段，服务端也不写入。
4. 【已实现】寿司业态：整卡仍展示，可改可存（行为保持）。
5. 【已实现】下单冷却等通用项与业态无关，经典 / 寿司均可见。
6. 【已实现】业态字段仅 Ops 可改；店内不可改业态。本地部署业态以本机库为准（认领 / check-in 同步）。

## 3. 详细测试场景

### 场景 1：寿司店打开功能设置，可见寿司同桌轮次

- **前置状态**：本机 `lucky-tea-mulcs62n`（Washoku Sushi）`buffet_service_mode = sushi`；店主 `luckytea@gmail.com`
- **操作过程**：登录 → 打开 `/dashboard/settings/features`
- **预期结果**：页面出现「寿司同桌轮次」卡片及轮次/筛选/上限等控件；「下单冷却」仍在
- **数据验证**：无需写库
- **异常恢复**：无
- **标签**：【已验证】见 UAT

### 场景 2：经典业态打开功能设置，不出现寿司同桌轮次

- **前置状态**：将 `lucky-tea-mulcs62n` 临时改为 `classic`（测完恢复 `sushi`）
- **操作过程**：刷新功能设置页
- **预期结果**：无「寿司同桌轮次」标题与控件；「下单冷却」等通用项仍在
- **数据验证**：业态列为 classic
- **异常恢复**：测完恢复 sushi
- **标签**：【已验证】见 UAT

### 场景 3：经典业态保存其它设置，不改寿司列

- **前置状态**：场景 2 的 classic；记录当前 `sushi_round_ordering_enabled` 等值
- **操作过程**：在功能设置改「下单冷却」一秒后保存（或 API PATCH 仅 `orderCooldownSeconds`）
- **预期结果**：保存成功；寿司相关列与保存前一致
- **数据验证**：对比保存前后寿司列
- **异常恢复**：恢复冷却原值（如有改）
- **标签**：【已验证】见 UAT

### 场景 4：经典业态硬打 PATCH 带寿司字段，服务端不写入

- **前置状态**：classic；记下 `sushi_round_ordering_enabled`
- **操作过程**：`PATCH /api/restaurant/features` body 含翻转后的 `sushiRoundOrderingEnabled`
- **预期结果**：HTTP 成功；库内该列不变
- **数据验证**：SQL 核对
- **异常恢复**：无（未写入）
- **标签**：【已验证】见 UAT

### 场景 5：恢复寿司业态后卡片再现且可写

- **前置状态**：恢复 `buffet_service_mode = sushi`
- **操作过程**：刷新功能设置；可选 PATCH 改回/保持一轮次开关
- **预期结果**：卡片再现；PATCH 可写入
- **数据验证**：业态 sushi；写入生效
- **异常恢复**：保证测后仍为 sushi
- **标签**：【已验证】见 UAT

### 场景 6：回归 — 非功能设置路径不受影响

- **前置状态**：sushi 店
- **操作过程**：不改点餐/结账；仅确认设置页与 features API
- **预期结果**：无结账/开台改动
- **标签**：【已验证】（本次未改这些路径；API stack-health + features 范围）

## 4. 实际测试结果

| 场景 | 结果 |
|---|---|
| 场景 1 寿司店可见寿司卡（SSR `buffetServiceMode":"sushi"`） | 【已验证】pass |
| 场景 2 经典业态不传 sushi / SSR `buffetServiceMode":"classic"` | 【已验证】pass |
| 场景 3 classic 改下单冷却、寿司列不变 | 【已验证】pass |
| 场景 4 classic 硬 PATCH 寿司字段不写入 | 【已验证】pass（`sushi_round_ordering_enabled` 仍 true） |
| 场景 5 恢复 sushi 后可写 | 【已验证】pass |
| 场景 6 回归范围 | 【已验证】pass（未改结账/开台） |
| Chrome DevTools 点击 UI | 【未验证】主仓 `feat/topbar-name-yield-demo` 旁路未提交 WIP 触发 Cursor 浏览器门禁；改用带 cookie 的功能设置页 HTML/RSC props 断言 |

UAT base：`http://localhost:3007`（feature worktree + `MESA_NEXT_DIST_DIR=.next-uat`）。测后 `lucky-tea-mulcs62n` 业态已恢复 `sushi`。

## 5. 风险与待确认

- 本地店 Ops 改业态后未 check-in 前，显隐仍跟本机旧业态（既有机制，非本次引入）。
- 未单独起 on-prem 店机联调；云/本地读的都是本部署 `restaurants.buffet_service_mode`。
- 浏览器 MCP 本次被主仓旁路 WIP 门禁拦住；产品行为已用 API + SSR props 覆盖。
EOF