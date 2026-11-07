# 本次改动业务场景测试报告 · 员工点餐菜品搜索开关

日期：2026-11-07  
分支：`feat/staff-menu-dish-search-flag`  
UAT 基址：`http://localhost:3002`（`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容：** 功能设置新增 `staff_menu_dish_search_enabled`（默认关）。仅员工代点/继续点餐且开关开时显示搜索框；客人扫码/寿司客人页永不显示。
- **文件：** `packages/shared/restaurant-features`、`messages`、`MenuOrderingController`、`SushiMenuPage`、sole 索引、本场景文档。
- **角色：** 店主（功能设置）、员工代点、客人扫码。

## 2. 核心业务规则

1. 开关默认关；未配置等同关。
2. 客人路径（含寿司客人页）永不挂载搜索。
3. 员工代点：`staffAssisted && staff_menu_dish_search_enabled` 才挂载。
4. 开关唯一登记在 `RESTAURANT_FEATURE_DEFINITIONS`（ordering 模块）。

## 3. 详细测试场景

### 场景 1：客人无搜索（开关开时）

- **前置：** 白云 A-01 开台；功能设置已打开「员工点餐菜品搜索」。
- **操作：** 客人打开 `…/menu?table_id=A-01`（无 `from=waiter`）。
- **预期：** 无「搜编码或菜名」搜索框。
- **数据验证：** DOM `role=searchbox` 数量为 0。

### 场景 2：开关关 · 员工代点无搜索

- **前置：** 功能设置关闭该开关并保存；库中 `staff_menu_dish_search_enabled=false`。
- **操作：** 员工打开 `…/menu?table_id=…&from=waiter&return=…`。
- **预期：** 有「Voltar à mesa」，无搜索框。

### 场景 3：开关开 · 员工代点可搜

- **前置：** 功能设置打开该开关并保存；库中为 `true`。
- **操作：** 代点菜单输入 `115`，点选「115 Caipirinha」。
- **预期：** 有搜索框；出现建议；点选后定位（搜索框清空、列表仍可浏览）。

### 场景 4：回归 · 功能设置页

- **操作：** 打开 `/dashboard/settings/features` → Pedidos。
- **预期：** 可见「Pesquisa de pratos (staff)」及说明「Desligado por defeito」；勾选/取消后 Guardar 写入成功。

## 4. 实际测试结果

| 场景 | 结果 | 证据 |
|---|---|---|
| 1 客人无搜索 | 【已验证】pass | 客人菜单 snapshot 无 searchbox；`querySelectorAll('[role=searchbox]')===0` |
| 2 开关关员工无搜索 | 【已验证】pass | 关开关后 DB=`false`；代点页有 Voltar à mesa、无 searchbox |
| 3 开关开员工可搜 | 【已验证】pass | 开开关后 DB=`true`；代点页有 searchbox；输入 115 出现 Caipirinha 建议并可点选 |
| 4 功能设置页 | 【已验证】pass | Pedidos 模块可见开关；Guardar 后 DB 与勾选一致 |

清冗余：已从 `SushiMenuPage` 移除客人搜索挂载；员工侧唯一挂载在 `MenuOrderingController` 且受开关约束。无平行 SearchInput。

测后白云开关已关回 `false`（默认态）。

## 5. 风险与待确认

- 本机若已注册 `mesa-pwa-shell-sw`，旧 chunk 可能让客户端读到不含新 key 的 `RESTAURANT_FEATURE_DEFINITIONS`，表现为 SSR 有搜索、水合后消失。UAT 时注销 SW + 清 cache 后正常。非产品逻辑缺陷。
- 无新增写库路径；仅 UI 挂载条件。
