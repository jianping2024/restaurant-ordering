# 本次改动业务场景测试报告 — 素食标移到菜图角 + 通知入口移进页头

## 1. 本次修改

- **内容：**
  1. 列表菜卡「素食」由菜名旁文字胶囊改为菜图**左上角**叶子圆标；详情页 / 厨房详情改为「叶子 + 素食」胶囊；寿司「素食」筛选按钮的灰点换成同一片叶子（作图例）。三处原手写 `emerald-800` 合并为唯一 `VegetarianMark`，配色改用 status-success token（深浅主题都可读）。
  2. 卡片详情按钮 `aria-label` 带上「素食」（原胶囊文字被 aria-label 覆盖，读屏读不到）。
  3. 顾客菜单「通知」入口由右侧悬浮竖标（会盖住菜卡金色 +）改为页头喇叭圆标，位于语言/主题胶囊左侧；未读金点保留。
  4. 页头桌号胶囊改为可截断，长桌名不再把右侧按钮顶出屏幕。
- **文件：** `MenuItemCard.tsx`、`VegetarianMark.tsx`（新）、`customer-ordering-icons.tsx`、`CustomerMenuItemDetailSheet.tsx`、`KitchenMenuItemDetailModal.tsx`、`SushiRoundStickyBar.tsx`、`CustomerGuestOrderingNotice.tsx`、`CustomerOrderingHeader.tsx`、`MenuOrderingController.tsx`、`SushiMenuPage.tsx`、`menu-item-card-layout.ts/.test.ts`、`customer-menu-chrome-layout.ts/.test.ts`、`globals.css`、i18n 4 文件、`docs/agent-sole-index.zh.md`、`docs/product/menu-flavor-hints.zh.md`
- **角色 / 页面：** 顾客经典菜单、顾客寿司菜单、员工代点（共用 `MenuItemCard`，无通知）、厨房菜品详情弹窗
- **唯一写法：** 素食 = `VegetarianMark`（thumb / label）+ `VegetarianLeafIcon`；通知 = `CustomerOrderingHeader` `notice` 槽里的 `CustomerGuestOrderingNotice`

## 2. 核心业务规则

1. 【本次新增】素食标在每张卡同一位置（图左上角 5px），与菜名长短、语言无关，不被裁切，不占菜名宽度。
2. 【本次新增】菜名行只有菜名，仍最多 2 行省略。
3. 【本次新增】读屏读到「查看{菜名} (素食)详情」。
4. 【本次新增】通知入口不覆盖菜单列表；仅顾客经典 / 寿司页显示（演示、嵌入、员工代点不显示）；通知关闭时不显示入口。
5. 【已实现】点开通知后未读点消失（`markGuestOrderingNoticeSeen`），逻辑未改。
6. 【已实现】素食筛选逻辑（`customer-menu-dietary-filter`）未改，只换图标。

## 3. 详细测试场景

### 场景 1：寿司页素食菜列表（浅色）
- **前置：** Washoku Sushi（`lucky-tea-mulcs62n`）18 道素食菜，素食筛选开；桌 42 无会话；手机 375×812。
- **操作：** 顾客打开桌 42 菜单 → 点「素食」筛选。
- **预期：** 只剩素食菜；每张卡图左上角一个 22px 叶子圆标；菜名内无子元素。
- **数据验证：** DOM：4 张卡、4 个 `.mesa-veg-mark-thumb`，相对图片偏移均为 (5,5)，尺寸 22×22；`h3` 子元素 0。
- **标签：** 【已验证】

### 场景 2：深色主题对比度
- **操作：** 同页切到深色。
- **预期：** 深绿圆底 + 薄荷绿叶子，压在白底菜图上清晰。
- **数据验证：** 计算样式 bg `rgb(20,48,32)`、fg `rgb(167,243,208)`；截图确认。
- **标签：** 【已验证】

### 场景 3：读屏文案
- **数据验证：** 首卡详情按钮 `aria-label` = 「查看1401 毛豆 (素食)详情」。
- **标签：** 【已验证】

### 场景 4：顾客详情页素食胶囊
- **操作：** 点「1401 毛豆」打开详情。
- **预期：** 价格旁「叶子 + 素食」胶囊，深色下薄荷绿字。
- **数据验证：** 弹层内 `.mesa-badge-success` 文本「素食」、含 svg、color `rgb(167,243,208)`；截图确认。
- **标签：** 【已验证】

### 场景 5：寿司页通知入口（未读 → 已读）
- **前置：** 店主经 `PATCH /api/dashboard/guest-notice` 开启测试通知。
- **操作：** 顾客刷新菜单 → 看页头 → 点喇叭。
- **预期：** 页头「桌号 | 喇叭(金点) | 语言·主题」；弹框显示标题「UAT 通知」、正文「测试正文」；关闭后金点消失；列表右侧无悬浮竖标。
- **标签：** 【已验证】

### 场景 6：经典页通知入口 + 窄屏
- **前置：** 白云（`restaurant-mohnrib5`）开启测试通知；桌 VIP888 无会话。
- **操作：** 375px 与 320px 宽度各打开一次。
- **预期：** 喇叭在页头，全页只有 1 个通知按钮；页头无横向溢出。
- **数据验证：** 375：overflow 0，最右按钮 right=358；320：overflow 0，right=303，桌号胶囊 118px 未截断。
- **标签：** 【已验证】

### 场景 7：通知关闭时不显示入口
- **操作：** 店主把通知恢复为关闭 → 顾客刷新。
- **预期：** 页头只有桌号 + 语言·主题，无喇叭。
- **标签：** 【已验证】

### 场景 8：厨房菜品详情弹窗
- **预期：** 素食菜显示「叶子 + 素食」胶囊（替换原深底不可读的 emerald-800 文字）。
- **标签：** 【未验证】— 需厨房屏有待做单才能打开详情，本次只经 typecheck 确认挂载；样式与场景 4 同一组件。

### 场景 9：长桌名 / 外卖徽标挤压
- **预期：** 桌号胶囊 `min-w-0 truncate`，极长桌名截断为省略号，右侧按钮不出屏。
- **标签：** 【未验证】— 本地无超长桌名数据；320px 下普通桌名已验证不溢出。

### 场景 10：回归 — 契约单测
- **操作：** `node --import tsx --test src/lib/menu-item-card-layout.test.ts src/lib/customer-menu-chrome-layout.test.ts`
- **结果：** 13 pass / 0 fail。【已验证】

### 不适用维度
- 并发 / 操作顺序 / 状态转换 / 重复提交 / 历史数据：本次只改展示与入口位置，无写入路径、无数据结构变化（`is_vegetarian`、通知 JSON 未改）。

## 4. 实际测试结果

- typecheck（web）通过；lint 仅既有 warning，无新增。
- 单测 13/13 pass。
- 浏览器（:3002 worktree，375/320 手机宽度，深浅主题）场景 1–7 pass。
- 测试数据：两店通知已恢复为原值（`enabled:false`、空文案、`updated_at:null`，DB 查询确认）。

## 5. 风险与待确认

- 场景 8、9 未在浏览器跑；风险低（同组件 / 纯 CSS 截断）。
- 第一张浅色截图时菜图还没加载完（白框），之后的深色截图正常显示；叶子圆标在两种情况下都在原位。
