# 本次改动业务场景测试报告：浇头 → 关联菜品（文案）

## 本次修改

- **内容：** 人对人可见名由「浇头」改为「关联菜品」；英 Related dishes、葡 Pratos associados。规则与 `topping_binding` 数据不变。
- **文件：** `messages.ts`（后台）、`menu-page-messages.ts` + `CustomerMenuItemDetailSheet`（顾客详情收进 messages）、`configuredDishDraftWarn` 提示、产品文档与 sole。
- **角色 / 页面：** 店主菜单编辑；顾客菜品详情（经典/寿司）。

## 核心业务规则

1. 【本次新增】对外统一叫「关联菜品」，不再出现「浇头」用户文案。
2. 【已实现】绑定仍为一类 + 子集 + 必选；下单仍拆独立行、原价。
3. 【已实现】顾客详情关联菜品标题 sole `MENU_PAGE_MESSAGES.itemDetailRelatedDishes*`。

## 详细测试场景

### 场景 1：后台菜品编辑显示「关联菜品」

- **前置状态：** 店主登录 Washoku；打开菜单 → 编辑已有菜（或任意菜）
- **操作过程：** 打开菜品编辑表单，看点单配置区
- **预期结果：** 区块标题为「关联菜品」/ Related dishes / Pratos associados（随界面语言）；无「浇头」「Toppings」「Coberturas」
- **数据验证：** 不改库；已有 `topping_binding` 仍可读
- **异常恢复：** 不适用

### 场景 2：顾客详情显示「关联菜品」

- **前置状态：** 某菜已挂 `topping_binding`；顾客打开该桌菜单
- **操作过程：** 点该菜进入详情
- **预期结果：** 区块标题为关联菜品对应语种文案；可选/必选提示正确
- **数据验证：** 可选可不选加入；必选未选有警告（文案含「关联菜品」）
- **异常恢复：** 关详情重开文案仍一致

### 场景 3：回归 — 规则未变

- **前置状态：** 同场景 2
- **操作过程：** 选关联菜加入购物袋 → 提交
- **预期结果：** 购物袋仍有关联行摘要；下单后关联菜独立成行
- **数据验证：** 与改名前一致（仅文案不同）
- **异常恢复：** 不适用

## 实际测试结果

- 场景 1：【已验证】Washoku 后台编辑 1405 Harumaki；葡语界面见「Pratos associados」/「Ativar pratos associados」；无 Coberturas
- 场景 2：【已验证】桌 90 顾客中文详情见「关联菜品」与「必选：至少选一种」；无「浇头」
- 场景 3：【部分验证】未选口味点加入 → 仍拦截（口味提示）；选完口味+关联后因本桌展示人数为 0，寿司免费额度挡住加入（与改名无关）；未再跑完整下单拆行
- Base：`http://localhost:3002`（feature worktree）

## 风险与待确认

- 历史 `docs/test-scenarios/*` 仍写「浇头」作历史记录，新产品文档以 `menu-choice-topping.zh.md` 为准。
- worktree 曾误装 Next 16，遗留 `node_modules.bad-next16/`（未纳入产品树；可删）。
