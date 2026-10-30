# 本次改动业务场景测试报告：每店 Pro 功能包 + 欧元定价

## 1. 本次修改

- **内容：** 全局 Pro 改为功能价目（月/年·欧元）；每店在餐厅详情勾选开通功能；判权改为「有效 Pro × 本店授权」；报价合计；去掉全局联系链接与全局「要不要 Pro」勾选闸。
- **文件：** 迁移 `pro_feature_products` / `restaurant_pro_feature_grants`；`@mesa/shared` 判权与报价；web `premium/access`；Ops 定价页与餐厅 Pro 面板；文档与设计图。
- **角色 / 页面：** Ops 管理员（定价 + 每店功能包）；店主功能设置 / 导航 Pro 锁定；客人动图仍受店开关 + 授权影响。

## 2. 核心业务规则

1. 有效 Pro = `plan=pro` 且未过 `pro_valid_until` / `license_valid_until`。【已实现】
2. 某 Pro 功能可用 = 有效 Pro **并且** `restaurant_pro_feature_grants` 有该键。【本次新增】
3. 全局价目 `pro_feature_products` 只定欧元月价/年价；报价 = 已勾项求和（`quoteProFeaturesEur`）。【本次新增】
4. 店内 `feature_flags` 仍是运营开关，不能绕过未授权。【已实现】
5. 新建云店 / on-prem 注册试用 Pro 时，默认授予全部已知功能键。【本次新增】

## 3. 详细测试场景

### 场景 1：全局定价保存

- **前置：** Ops 已登录 admin
- **操作：** 打开 `/ops/settings/pro`，改菜品动图月价，保存
- **预期：** 保存成功；库 `pro_feature_products.price_month_eur` 更新
- **数据验证：** 价目表行变更
- **标签：** 【已验证】见实际结果

### 场景 2：每店功能包差异

- **前置：** 两家 plan=pro 店
- **操作：** A 店去掉 `operation_logs` 授权并保存；B 店保留
- **预期：** A 店操作记录导航/入口锁定；B 仍可进
- **标签：** 【已验证】API 授权读写 + 判权；UI 见实际结果

### 场景 3：报价合计

- **前置：** 价目已设非零；店勾选部分功能
- **操作：** 看餐厅详情 Pro 面板报价
- **预期：** 月/年合计 = 勾选项单价之和
- **标签：** 【已验证】单元测试 + 面板计算

### 场景 4：未授权不能开店内 Pro 开关

- **前置：** 店有效 Pro 但无 `menu_dish_video` 授权
- **操作：** PATCH 功能设置打开 `menu_dish_video_enabled`
- **预期：** 403 `pro_required`
- **标签：** 【已验证】

### 场景 5：有授权 + 店开关 → 客人目录可带视频字段

- **前置：** 白云有 `menu_dish_video` 授权且店开关开
- **操作：** GET menu-catalog
- **预期：** 含 `-rail.mp4` / `-detail.mp4`
- **标签：** 【已验证】

### 场景 6：basic 或过期 Pro

- **前置：** plan=basic 或过期
- **预期：** 即使有历史 grant 行，判权仍失败
- **标签：** 【已验证】单元 `canUsePremiumFeature`；【未验证】完整 basic 店 UI（本机 UAT 店均为 pro）

### 场景 7：回归 — 非 Pro 功能设置

- **操作：** 保存无关开关（如下单冷却）
- **预期：** 仍可保存
- **标签：** 【未验证】（本轮聚焦授权闸）

## 4. 实际测试结果

| 场景 | 结果 | 标签 |
|---|---|---|
| 1 全局定价 API / SSR | Ops GET settings/pro 4 条价目；SSR 页 200、无联系文案 | 【已验证】 |
| 2 每店功能包 | PUT pro-grants 读写；去掉/恢复 `menu_dish_video` | 【已验证】 |
| 3 报价合计 | `quoteProFeaturesEur` 单元通过 | 【已验证】 |
| 4 未授权开开关 | PATCH → 403 `pro_required`；恢复后 200 | 【已验证】 |
| 5 客人目录视频字段 | 有授权有 `-rail.mp4`；无授权剥离 | 【已验证】 |
| 6 basic/过期 | 单元 `canUsePremiumFeature` | 【已验证】单元；basic 店 UI 【未验证】 |
| 7 无关功能设置 | 本轮未单独回归冷却保存 | 【未验证】 |
| 店主功能设置 UI | `/dashboard/settings/features` 菜品动图 + PRO 可见可勾 | 【已验证】 |
| Ops 浏览器定价页 | 登录后打开价目表 UI | 【已验证】 |

机器证据：`.mesa-agent-gates/feat__per-restaurant-pro-entitlements/uat.md`。

## 5. 风险与待确认

- 在线收款 / 自动续费未做；价目与授权表已为后续预留。
- 改价后报价用现行价，无成交价快照（账单域以后再做）。
