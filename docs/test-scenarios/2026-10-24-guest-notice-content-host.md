# 本次改动业务场景测试报告：顾客通知挂在内容区

日期：2026-10-24  
分支：`fix/guest-notice-content-region-anchor`  
UAT 基址：`http://127.0.0.1:3002`（feature，非 :3000）

## 1. 本次修改

- **内容**：顾客点餐页右侧「通知」与左侧同伴浮标，挂在「菜单内容区」顶边（桌号栏、人数/轮次条、暂不可点提示之下），不再用整屏固定高度估算。
- **文件**：`customer-menu-chrome-layout.ts`（+test）、`CustomerMenuPeerFloats.tsx`、`MenuOrderingController.tsx`、`SushiMenuPage.tsx`、`docs/agent-sole-index.zh.md`
- **角色 / 页面**：顾客扫码点餐（经典 + 寿司）

## 2. 核心业务规则

1. 【本次新增】通知条顶边 = 内容区顶边；不得盖住桌号栏或第二行（本桌人数 / 素食·过敏源）。
2. 【已实现】通知仅在已启用且有可展示文案时出现；购物车/已点/介绍/详情打开时隐藏入口。
3. 【已实现】同伴浮标与通知共用同一内容区锚定。
4. 【本次新增】唯一写法：`customerMenuContentHostClass` + `absolute inset-x-0 top-0`（通知 / peer float）。

## 3. 详细测试场景

### 场景 1：寿司 + 店招 + 过敏源 — 通知不挡芯片

- **前置状态**：Washoku `lucky-tea-mulcs62n`；临时启用顾客通知；桌 A-02 开台；390×844
- **操作过程**：打开菜单；量「通知」与「Alérgenos」的 getBoundingClientRect
- **预期结果**：通知 top ≥ 过敏源 bottom；纵向不重叠；可点开通知
- **数据验证**：无写业务单；测后关闭通知
- **异常恢复**：刷新后仍在内容区顶

### 场景 2：经典点餐 + 人数条

- **前置状态**：经典路径与寿司共用同一内容区 host
- **操作过程**：代码核对 `MenuOrderingController` 包裹方式与寿司一致
- **预期结果**：同一挂法，不挡第二行
- **数据验证**：无
- **异常恢复**：无

### 场景 3：打开购物车时通知隐藏

- **前置状态**：场景 1 通知可见
- **操作过程**：点购物车；再关闭
- **预期结果**：打开时入口消失；关闭后恢复
- **数据验证**：无
- **异常恢复**：关闭后可再点通知

### 场景 4：回归 — 菜单可滚、分类可点

- **前置状态**：场景 1
- **操作过程**：页面加载后可见分类与菜品列表
- **预期结果**：菜单正常
- **数据验证**：无
- **异常恢复**：无

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 寿司+过敏源不挡 | 【已验证】 | **pass** — notice top=97，allergen bottom=86，overlapY=false；弹窗标题「Aviso UAT」 |
| 2 经典人数条 | 【未验证】实机；【已验证】同 host 代码 | 经典实机 skip（本租户寿司）；代码 `MenuOrderingController` 与寿司同 `customerMenuContentHostClass` |
| 3 购物车隐藏 | 【已验证】 | **pass** — hiddenInCart=true，restoredAfterCartClose=true |
| 4 菜单回归 | 【已验证】 | **pass** — 分类/菜品可见 |
| API stack-health + guest-notice | 【已验证】 | **pass**（`gate.sh uat-evidence`） |
| layout 单测 | 【已验证】 | **pass**（5 tests） |

## 5. 风险与待确认

- 测中曾误开到 :3003（其他会话 web）；最终断言均在 :3002 本分支。
- 本地曾临时打开通知文案，已 PATCH `enabled:false` 清回。
