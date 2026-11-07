# 本次改动业务场景测试报告：关联菜品 → 加料（文案）

## 本次修改

- **内容：** 人对人可见名由「关联菜品」改为「加料」；英 Add-ons、葡 Extras。规则与 `topping_binding` 数据不变。
- **文件：** `messages.ts`（后台）、`menu-page-messages.ts` + 顾客详情键值、`configuredDishDraftWarn` 提示、组件/类型注释、产品文档与 sole。
- **角色 / 页面：** 店主菜单编辑；顾客菜品详情与购物袋摘要（经典/寿司）。

## 核心业务规则

1. 【本次新增】对外统一叫「加料」，不再出现「关联菜品」用户文案（zh/en/pt）。
2. 【已实现】绑定仍为一类 + 子集 + 必选；下单仍拆独立行、原价。
3. 【已实现】顾客详情加料标题 sole `MENU_PAGE_MESSAGES.itemDetailRelatedDishes*`（键名保留，字符串已换）。

## 详细测试场景

### 场景 1：后台菜品编辑显示「加料」

- **前置状态：** 店主登录 Washoku；打开菜单 → 编辑 1405
- **操作过程：** 打开菜品编辑表单，看点单配置区；切换 zh / en / pt
- **预期结果：** 区块标题为「加料」/ Add-ons / Extras；启用/添加/类别等派生文案同步；无「关联菜品」「Related dishes」「Pratos associados」
- **数据验证：** 不改库；已有 `topping_binding` 仍可读
- **异常恢复：** 不适用

### 场景 2：顾客详情显示「加料」

- **前置状态：** 1405 已挂 `topping_binding`；桌 90 已开台
- **操作过程：** 顾客打开菜单 → 点 1405 进详情；切换界面语言
- **预期结果：** 区块标题为加料对应语种文案；可选/必选提示正确
- **数据验证：** 必选提示含「加料」/ Add-on / Extra 语义
- **异常恢复：** 关详情重开文案仍一致

### 场景 3：购物袋只读摘要 + 回归规则未变

- **前置状态：** 同场景 2
- **操作过程：** 选加料后尝试加入购物袋
- **预期结果：** 摘要仍展示已选加料行（名/份/价）；行为与改名前一致
- **数据验证：** 仅文案不同
- **异常恢复：** 不适用

## 实际测试结果

- Base：`http://localhost:3002`（worktree `feat/topping-copy-addons`，`MESA_NEXT_DIST_DIR=.next-uat`，`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`）
- 场景 1：【已验证】后台 zh/en/pt 均见新词；无旧「关联菜品 / Related dishes / Pratos associados」
- 场景 2：【已验证】顾客详情 zh「加料」、en「Add-ons」、pt「Extras」
- 场景 3：【部分验证】本桌展示人数为 0，寿司免费额度挡住加入（与改名无关）；购物袋摘要组件无旧称呼标题字符串

## 风险与待确认

- 历史 `docs/test-scenarios/2026-11-06-related-dishes-rename.md` 仍写「关联菜品」作历史记录；新产品文档以 `menu-choice-topping.zh.md` 为准。
- 消息键名仍含 `RelatedDishes` / `itemTopping`（按任务不改结构）。
