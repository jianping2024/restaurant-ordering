# 本次改动业务场景测试报告：围栏高精度定位 + 默认 500 米

分支：`fix/geo-high-accuracy-fence-500m`  
UAT 基址：`http://localhost:3005`（feature · `MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容：** 店主取锚点与顾客围栏共用 sole `getBrowserPositionForGeoFence`（先高精度，失败再粗定位）；未设半径默认 **500 米**（库列 default 同步；已有店不改写）。
- **文件：** `browser-geolocation.ts`、`customer-geo-order.ts`、`SettingsForm.tsx`、`order-radius.ts`、迁移 `20261106133000_order_radius_default_500m.sql`、文档/seed/baseline。
- **角色 / 页面：** 店主设置「资料」；顾客进页/下单围栏（代码路径对齐，localhost 常 bypass）。

## 2. 核心业务规则

1. 围栏相关浏览器定位只有一套：高精度优先 → 粗定位。
2. `order_radius_meters` 未设/非法归一为 500；已有行保持原值。
3. 坐标仍是 WGS84 经纬度；本轮不按 `coords.accuracy` 拦人。

## 3. 详细测试场景

### 场景 1：设置页可见定位与半径

- **前置：** 店主 `luckytea@gmail.com` 登录 Washoku。
- **操作：** 打开 `/dashboard/settings`，滚到「Localizacao e raio」。
- **预期：** 有「Usar localizacao atual」；半径可编辑（本店现有值 50）。
- **标签：** 【已验证】pass

### 场景 2：无效半径 API 拒绝

- **前置：** 同上 jar。
- **操作：** `PATCH /api/restaurant/settings` `order_radius_meters=5`。
- **预期：** 400 `order_radius_invalid`。
- **标签：** 【已验证】pass

### 场景 3：合法半径可保存

- **操作：** `PATCH` `order_radius_meters=50` + `geo_order_restriction_enabled=false`。
- **预期：** 200 ok；库中仍为 50。
- **标签：** 【已验证】pass

### 场景 4：库默认 500（新行）

- **操作：** 查 `information_schema` 列 default。
- **预期：** `500`。
- **标签：** 【已验证】pass

### 场景 5：顾客粗定位路径已移除

- **操作：** 代码检索；unit `customer-geo-order` / `order-radius`。
- **预期：** 仅 `getBrowserPositionForGeoFence`；默认常量 500。
- **标签：** 【已验证】pass

### 场景 6：真机高精度填坐标 / 店内围栏

- **说明：** 自动化浏览器无稳定 GPS；点击定位后 lat/lng 仍空（权限/环境限制）。
- **标签：** 【未验证】需真机

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health / login / PATCH 半径 | pass（`MESA_UAT_BASE=http://localhost:3005`） |
| 设置页 UI 点定位按钮 | pass（按钮可点；坐标写入【未验证】） |
| 单元测试 | pass |
| 真机 GPS | 未验证 |

## 5. 风险与待确认

- 室内高精度可能更慢或失败 → 已保留粗定位退路。
- 已有店半径不会自动改成 500，需店主自行改。
