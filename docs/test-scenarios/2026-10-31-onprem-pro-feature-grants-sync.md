# 本次改动业务场景测试报告：店机 Pro 功能包随云端落下

日期：2026-10-31  
分支：`feat/onprem-pro-feature-grants-sync`

## 1. 本次修改

- **内容：** Ops 云端勾的 Pro 功能包，在店机员工登录 / 进后台问云端时整表落到店机；首次认领同样带上。问云端失败或旧版云端不带该字段 → 店机授权不动。
- **文件：** `@mesa/shared` sole `replaceRestaurantProFeatureGrants` / `loadRestaurantProFeatureGrantKeys`；ops claim/check-in 返回 `featureKeys`；web `syncOnPremLicenseFromPlatform` + `applyOnPremClaim` 整表替换；建店/注册店机种子改走同一写入；文档 ADR-004 / sole 索引。
- **角色 / 页面：** 平台 Ops（勾功能包）；店机员工登录 / 进后台；店内「餐厅设置 → 功能」看是否仍锁 Pro。

## 2. 核心业务规则

1. 云端 Ops 是功能包商业真相；店机本地表是运行时判定来源。【本次新增】同步通道
2. 某功能可用 = 有效 Pro **并且** 本地授权表有该键。【已实现】
3. 写入授权表 **只有** `replaceRestaurantProFeatureGrants`（整表替换 + 菜单版本 bump）。【已实现】【本次收敛】
4. 问云端成功且响应含 `featureKeys` 数组 → 整表替换本地；字段缺失/非数组 → **不改**本地。【本次新增】
5. 问云端失败 → 不改本地功能包（与执照失败不乱清一致）。【本次新增】
6. 列表动图授权仍须有菜品动图父项（`sanitizePremiumKeyGrants`）。【已实现】

## 3. 详细测试场景

### 场景 1：sole 写入只有一份

- **前置：** 本分支 diff
- **操作：** 搜索 `replaceRestaurantProFeatureGrants` 定义与平行 `insert` 种子
- **预期：** 函数体只在 `packages/shared/src/pro-feature-grants.ts`；建店/Ops/店机同步均调用它；无 `proTrialFeatureGrantRows` / 无 ops 转发包装
- **数据验证：** `rg` 无第二套整表写入
- **异常恢复：** 不适用

### 场景 2：本地库整表替换往返（模拟店机落地）

- **前置：** 本机 Docker Supabase；任选一店（如白云）
- **操作：** `load` 当前授权 → `replace` 为含 `menu_dish_video`+`menu_dish_list_video` 的集合 → 再 `load` → 恢复原授权
- **预期：** 中间态含列表动图；恢复后与快照一致
- **数据验证：** `restaurant_pro_feature_grants` 行与 load 结果一致
- **异常恢复：** 脚本结束必须 restore

### 场景 3：云端勾了列表动图 → 店机问云端后可开开关

- **前置：** 店机库缺 `menu_dish_list_video`；云端同店已有该项；店机已装含本改动的包
- **操作：** Ops 确认已勾 → 店机员工重新登录或进后台 → 打开餐厅设置 → 功能
- **预期：** 「点餐列表动图」不再因缺授权灰掉「需开通 Pro」（仍受父开关约束）
- **数据验证：** 店机 `restaurant_pro_feature_grants` 出现 `menu_dish_list_video`
- **异常恢复：** 不适用

### 场景 4：云端去掉某项 → 下次登录店机去掉

- **前置：** 店机与云端都有列表动图授权
- **操作：** Ops 取消勾选并保存 → 店机重新登录/进后台
- **预期：** 店机授权表无该项；设置页再锁
- **数据验证：** 店机 grants 与云端一致
- **异常恢复：** 不适用

### 场景 5：问云端失败 / 旧版无 featureKeys → 本地授权保留

- **前置：** 店机本地已有若干授权
- **操作：** 模拟响应无 `featureKeys`（或同步失败）
- **预期：** 本地授权行不变
- **数据验证：** sync 前后 load 相同
- **异常恢复：** 店机仍可用上次授权

### 场景 6：回归 — 云店（非 on_prem）不受影响

- **前置：** 本地云模式店（如白云 / luckytea）
- **操作：** 员工登录 / 进后台（不走平台 check-in）
- **预期：** 登录与功能设置正常；无异常 5xx
- **数据验证：** 栈健康 + login ok
- **异常恢复：** 不适用

## 4. 实际测试结果

| 场景 | 结果 | 说明 |
|---|---|---|
| 1 sole 写入 | 【已验证】 | `function replaceRestaurantProFeatureGrants` 仅 shared 一处；ops 旧文件已删 |
| 2 本地整表替换往返 | 【已验证】 | `scripts/uat-pro-feature-grants-replace.mjs` 对白云 `restaurant-mohnrib5` 替换含列表动图后恢复，exit=0 |
| 3 Pirata 云端勾→店机登录 | 【未验证】 | 店机包尚未含本改动；需升级后复验 |
| 4 云端去掉后店机同步去掉 | 【未验证】 | 同场景 3，依赖店机升级 |
| 5 无 featureKeys / 失败保留 | 【未验证】 | 代码门闩：`Array.isArray(featureKeys)` 才 replace；未单独打失败桩 |
| 6 云店登录回归 | 【已验证】 | `MESA_UAT_BASE=http://localhost:3004` stack-health + luckytea owner login pass |

## 5. 风险与待确认

- 店机未升级到含本改动的包前，云端勾选仍不会落到店机。
- 场景 5 建议在店机升级后用断网/旧平台响应抽测一次。
