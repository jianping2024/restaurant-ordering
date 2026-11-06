# 口味分组 + 浇头（点单配置）业务场景

## 本次修改

- 库表：`menu_choice_groups` / `menu_choice_options`；菜品 `choice_bindings`、`topping_binding`
- 后台：菜单「口味分组」Tab；菜品编辑勾选口味与浇头（先选一个类别）
- 顾客：挂了配置的菜列表加号进详情；必选未完成不能加入；购物袋按配置分行；下单展开浇头为独立行，口味进主菜备注
- **寿司补丁（本轮）**：`SushiMenuPage` 与经典菜单同一套门禁：`dishNeedsOrderConfig` 列表分流 + 详情确认；免费用轮次提交走 `appendCartLinesFromCart`（浇头展开）

## 核心业务规则

1. 口味 ≠ 风味提示 ≠ 预选备注
2. 每组口味单选必选一；浇头可按 `required` 必选至少一种
3. 未挂配置：列表可直接加减
4. 购物袋：主菜 + 口味 + 浇头 + 备注全相同才叠份
5. 下单：主菜一行（备注含口味文案）+ 浇头各成行（数量 × 主菜份数）

## 详细测试场景

### 场景 1：后台建口味并挂到菜

- **前置**：店员已登录菜单页（Washoku · `luckytea@gmail.com`）
- **操作**：打开 Menu →「Grupos de escolha」
- **预期**：可见「辣度」分组与「不辣」「微辣」口味；说明文案指向菜品编辑勾选
- **数据验证**：本地库 Washoku 有 `menu_choice_*`；Takoyaki/Harumaki 的 `choice_bindings` 非空
- **结果**：【已验证】浏览器点击 Tab；SQL `lucky-tea-mulcs62n` with_choice=2

### 场景 2：未配置菜仍可列表加减

- **前置**：桌 90 顾客菜单；Copo de gelo 无 choice/topping
- **操作**：列表直接点「+ Adicionar」
- **预期**：出现数量步进器 / Ver carrinho；不打开口味详情
- **结果**：【已验证】点击后 qty=1，未出现 辣度 dialog

### 场景 3：已配置菜必须选完再加入

- **前置**：Takoyaki 挂了辣度
- **操作**：列表 + → 详情不选口味点「Adicionar ao carrinho」
- **预期**：提示未选完；购物袋无新行
- **再操作**：选「微辣」后加入
- **预期**：购物袋出现该行（备注/轮次预览含 `辣度:微辣`）
- **结果**：【已验证】未选时有警告；选后可加入

### 场景 4：浇头必选 / 可选

- **前置**：Harumaki 浇头 `required=true`；Takoyaki 浇头可选
- **操作**：Harumaki 不选浇头加入 → 拒绝；Takoyaki 不选浇头 → 可加入
- **结果**：【已验证】必选未选有警告；可选可不选

### 场景 5：不同配置分行；相同叠份

- **操作**：Takoyaki 选微辣、不辣各加 1；再重复微辣加 1
- **预期**：不同口味两行；相同配置 qty=2
- **结果**：【已验证】轮次预览两行不同备注；购物袋同一微辣 qty=2（ENTRADA 角标 2）

### 场景 6：下单展开

- **前置**：购物袋有 Harumaki（辣度:不辣）+ 浇头 Takoyaki×1；以及此前两行不同辣度 Takoyaki
- **操作**：Juntar → Enviar · 4 → Confirmar
- **预期**：轮次 4 行；主菜备注含口味；浇头行 note 空；Pedidos feitos 9（原 5+4）
- **数据验证**（`table_order_round_lines` 按 `added_at`）：
  - `1405 Harumaki` qty=1 note=`辣度:不辣`
  - `1402 Takoyaki` qty=1 note=``（浇头展开）
  - `1402` note=`辣度:不辣` / `辣度:微辣`
- **结果**：【已验证】UI「Ronda enviada」+ SQL 上述四行

### 场景 7：回归

- 无配置菜列表加减：【已验证】场景 2
- 寿司轮次菜单无配置路径可加减：【已验证】
- 经典 `MenuOrderingController` 同门禁：【已实现】主仓已合入；白云本机无挂 choice 的菜（with_choice=0），本轮未另开经典店全路径点击
- 后台 Tab 可见：【已验证】场景 1

## 清冗余（UAT 前）

- **Scanned:** `SushiMenuPage` / `MenuPage` choiceCatalog 传入；`dishNeedsOrderConfig`、`appendCartLinesFromCart`、`confirmConfiguredDetailAdd`
- **None found:** 寿司侧复用既有 sole helpers，无第二套口味判定或平行 expand；`rg` 调用点均指向同一符号

## 实际测试结果

| 项 | 结果 |
|---|---|
| Base | `http://localhost:3004`（worktree `fix/sushi-dish-order-config-gate` · `.next-uat-sushi-choice`） |
| 桌 | 90 `e296b9ac-…` |
| 点击 UAT | 场景 1–6 pass；7 经典无 seed 未另测店 |
| stack-health | ready（ops softMissing） |
| typecheck web | pass |

## 风险与待确认

- 购物袋抽屉对本配置行未单独展示「辣度:…」文案时，轮次预览与 DB note 仍正确（已用 SQL 核对）
- 白云未挂口味数据；经典控制器回归依赖代码同构 + 既有合入，非本轮二次店面点击
