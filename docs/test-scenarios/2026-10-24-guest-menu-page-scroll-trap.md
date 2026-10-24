# 本次改动业务场景测试报告 — 有店招点餐页菜品区可竖滑

日期：2026-10-24  
分支：`fix/guest-menu-page-scroll-trap`  
UAT 基址：`http://127.0.0.1:3003`（功能分支，非 `:3000`）

## 1. 本次修改

- **内容：** page-scroll 右侧目录去掉 `overflow-x-hidden`，避免 CSS 把 `overflow-y` 算成 `auto`、把竖滑拦在「自己滚不动」的假滚动层上。竖滚与横裁只留在外层店招滚动容器。
- **文件：** `customer-menu-chrome-layout.ts` / `.test.ts`、`docs/agent-sole-index.zh.md`
- **角色 / 页面：** 顾客点餐页（有店招 → 整页滚动）
- **流程：** 在菜品列表上竖滑 → 外层 `scrollTop` 变化

## 2. 核心业务规则

1. 【本次新增】有店招时，菜品区竖滑必须带动 `[data-mesa-storefront-menu-scroll]`，目录不得成为竖向滚动容器。
2. 【已实现】无店招 pane 模式：右侧目录仍用 `overflow-x-hidden overflow-y-auto`（独立滚）。
3. 【已实现】page-scroll 目录 sole token：`customerMenuCatalogPanePageScrollClass`（无任何 `overflow-*`）。

## 3. 详细测试场景

### 场景 1：有店招 — 菜品区竖滑带动外层

- **前置状态：** 白云 `restaurant-mohnrib5` 桌 A-03 客人菜单；存在 `[data-mesa-storefront-menu-scroll]`
- **操作过程：** 量目录 computed overflow；从菜品区坐标沿祖先找滚动容器并滚动
- **预期结果：** `catalogTrap=false`；目录无 `overflow-x-hidden`；滚动归属 storefront；`scrollTop` 增加
- **数据验证：** 无服务端写入
- **异常恢复：** 刷新后仍可滑

### 场景 2：有店招 — 店招区 / 外层仍可滑

- **前置状态：** 同页
- **操作过程：** 直接设置外层 `scrollTop=400`
- **预期结果：** `directOk=true`
- **数据验证：** 无服务端写入

### 场景 3：开/关已点抽屉后仍可滑

- **前置状态：** 同页；底部「Ver pedidos」
- **操作过程：** 点「Ver pedidos」→ 确认 lock 生效 → 点 ✕ 关闭 → 再从菜品区竖滑
- **预期结果：** 关闭后 html/body/storefront 无残留 inline `overflow:hidden`；菜品区仍带动外层
- **数据验证：** 无服务端写入

### 场景 4：回归 — pane 模式目录仍可独立滚

- **前置状态：** pane token 未改
- **操作过程：** 单测断言 `customerMenuCatalogPaneClass` 仍含 overflow
- **预期结果：** pass
- **数据验证：** 单测 【已验证】；无店招 UI 【未验证】（本次不改 pane）

### 场景 5：回归 — 客人菜单 HTTP 可达

- **前置状态：** 本地栈健康
- **操作过程：** `GET` 客人菜单页
- **预期结果：** HTTP 200

## 4. 实际测试结果

| 项 | 结果 | 标签 |
|---|---|---|
| 清冗余（唯一 page-scroll 目录 overflow 写法） | scan.md + `gate.sh scan` pass | 【已验证】 |
| chrome-layout 单测 6 例 | pass | 【已验证】 |
| `mesa-local-uat` stack-health（ops soft） | ready=true | 【已验证】 |
| owner login baiyun | pass | 【已验证】 |
| 场景 1 菜品区竖滑 | catalogTrap=false；storefront 0→280 | 【已验证】 |
| 场景 2 外层可滑 | directOk scrollTop≥300 | 【已验证】 |
| 场景 3 关已点后竖滑 | 关后 overflow 清空；0→250 | 【已验证】 |
| 场景 4 pane 单测 | pass | 【已验证】；UI 【未验证】 |
| 场景 5 菜单 HTTP | 200 | 【已验证】 |

## 5. 风险与待确认

- 横溢裁切改由外层 storefront 负责；宽内容不应再依赖目录自身的 `overflow-x-hidden`。
- 店机 Pirata 需升包后才消除现场不能滑。
