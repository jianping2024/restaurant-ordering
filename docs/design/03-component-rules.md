# 组件规则

> **状态**：阶段 4 已填充（2026-06-30）  
> **读者**：设计、前端开发、AI 代理

## 用途

统一交互组件的选择与样式约定。新 UI **优先扩展** `apps/web/src/components/ui/*`，勿在业务页内联一套新按钮/弹窗。

跨应用共用：`packages/ui` 目前仅 `PasswordInput`（登录/注册）。

---

## 1. 按钮（`Button` / `ButtonLink`）

**文件**：`components/ui/Button.tsx`

| variant | 何时使用 |
|---------|----------|
| `gold` | **默认主操作**：提交、保存、确认 |
| `outline` | 次要确认、取消旁的非破坏操作 |
| `ghost` | 工具栏、低优先级文字按钮 |
| `danger` | 删除、不可恢复操作（`ConfirmModal` 确认钮） |
| `soft` | 中性次要（筛选、辅助） |
| `close` | 关台等「高警示但非红底」操作 |

| size | 何时使用 |
|------|----------|
| `md` | 默认表单 |
| `sm` | Modal 内、紧凑工具栏 |
| `lg` | 落地页 CTA |
| `action` | **楼面/会话操作条**（保存人数、继续点餐、转台/并台等）；`text-[15px]`，与列表正文 `text-lg` 配套 |

**规则**

- 加载中用 `loading` prop，禁止双点
- 链接形态用 `ButtonLink`，保持与 button 同形
- 结账「收款」目前用自定义 `mesa-badge-success` 类 — **新收款类按钮应与此视觉一致**（绿底白字、旁显示金额）

---

## 2. 表单与输入

| 组件 | 用途 |
|------|------|
| `Input` | 通用文本；可选 `clearable` + `clearLabel` 一键清空 |
| `IntegerInput` / `DecimalInput` | 数量、折扣率等数字 |
| `PasswordInput`（`@mesa/ui`） | 密码、代重置密码 |

**规则**

- 标签 + 错误文案在表单项上方/下方，红色错误用 `text-red-500` 或 Toast
- 需要「有内容时一键清除」时用 `Input` 的 `clearable`（受控 `value` 仍由父组件唯一持有）；勿在业务页再手写一套清除钮。清空在 pointer 按下时执行并避免失焦吞手势（移动端），仍只走现有 `onChange('')`
- 金额输入展示用 **只读 `tabular-nums`** 为主，编辑折扣等少数场景用 `IntegerInput`
- 葡萄牙 NIF 展示用 `font-mono tabular-nums`（`formatPortugueseNif`）

---

## 3. 弹窗（`Modal`）

**文件**：`components/ui/Modal.tsx`

- 遮罩 `bg-black/70 backdrop-blur-sm`，点击关闭
- 内容 `bg-brand-card rounded-2xl`，标题 `font-heading text-brand-gold`
- 尺寸：`sm` 确认框 · `md` 默认 · `lg/xl` 复杂表单
- ESC 关闭；打开时 `body` 锁滚动

**规则**：业务内容放 `children`，不复制 Modal 壳。

---

## 4. 抽屉（`CartDrawer` 模式）

**参考**：`components/menu/CartDrawer.tsx`

- 底部滑出 `fixed`，z-index 低于 Modal（`z-30` vs `z-50`）
- 遮罩 `bg-black/60`
- 顶栏标题 + 关闭；底栏固定合计 + 主按钮

**何时用抽屉 vs Modal**

| 抽屉 | Modal |
|------|-------|
| 购物车、临时列表 | 确认、短表单 |
| 需浏览背后上下文 | 须打断流程的决策 |

---

## 5. 卡片

**通用类名**：`bg-brand-card border border-brand-border rounded-xl shadow-sm`

| 场景 | 变体 |
|------|------|
| 默认 Dashboard | 上式 |
| 服务员桌位 idle（可用） | `border-emerald-500/40 bg-emerald-500/10` |
| 用餐中（占用） | `border-rose-500/40 bg-rose-500/10` |
| 待结账 | `border-amber-500/55 bg-amber-500/12` |
| 结账待收款区 | `border-2 border-brand-gold/35 bg-brand-gold/5` |

**规则**：状态用 **边框+浅底**，勿仅靠文字颜色。

---

## 6. 表格

**允许场景**：`OrdersHistoryManager`、`ValueAnalyticsTopTable`、`MenuManager` 宽屏段落

**规则**

- 顾客/服务员/结账主路径 **禁止** 宽表
- 表头 `text-brand-text-muted text-sm`；数字列右对齐 `tabular-nums`
- 手机：改卡片列表或 `overflow-x-auto` 整块横滑

---

## 7. 筛选条件

| 页面 | 模式 |
|------|------|
| 服务员看板 | 顶部 chip：`all` / `checkout` / `dining` / `idle` |
| 订单历史 | DayPicker + react-select 桌位 |
| 经营分析 | 7d / 30d segmented control |
| 异常操作 | 日期 + 类型 + 状态下拉 |

**规则**：筛选变更即时生效或显式「应用」；窄屏筛选器纵向排列，全宽可点。

---

## 8. 状态标签

| 类型 | 实现 |
|------|------|
| 分单模式 / 轻量标签 | `text-[11px] px-2 py-0.5 rounded-full bg-brand-border/50` |
| 待结账 / 警告 | `mesa-badge-warning` |
| 收款按钮 | `mesa-badge-success` |
| 菜品下架 | `unavailableBadge` 文案（MenuManager） |
| 看板 badge | 状态色底 + 白字（`STATUS_STYLES`） |

**待整理**：订单状态 badge 分散在 `DashboardPageClient` 等 — 新代码应抽取复用，但阶段 4 不强制重构。

---

## 9. 错误提示

| 方式 | 何时 |
|------|------|
| `showToast`（`Toast.tsx`） | 操作失败/成功反馈 |
| 表单项下 inline 错误 | 表单校验 |
| `DashboardAccessError` | 无权限整页 |
| `externalError` on ReasonConfirmDialog | 退菜等原因校验 |

**规则**：API 错误映射 i18n 键，不直接暴露 `error.code` 给用户。

---

## 10. 确认提示

| 组件 | 场景 |
|------|------|
| `ConfirmModal` | 是/否，无原因下拉 |
| `ReasonConfirmDialog` | 须选原因 + 可选详情（折扣、关台、退菜） |
| `PromptModal` | 单字段输入（少用） |

**规则**

- 取消在左/下，确认在右/上（手机 `flex-col-reverse` 确认靠上）
- 危险操作用 `variant="danger"`
- 禁止 `window.confirm` / `window.prompt`

---

## 11. 数量输入

| 组件 | 场景 |
|------|------|
| `CartQtyStepper` | 购物车加减 |
| `ByItemQtyInput` | 按菜分单份额 |
| `IntegerInput` | 自助餐成人/儿童、折扣率 |

**规则**

- 加减按钮触控区域 ≥ 44px 意图（padding 充足）
- 减到 0 触发 void 流程而非静默删除

---

## 12. 金额显示

**统一约定**

```text
货币符号 + 两位小数 + tabular-nums
示例：€{amount.toFixed(2)}
```

| 层级 | 样式 |
|------|------|
| 当前应收（最重要） | `text-brand-gold font-semibold text-base` 或更大 |
| 摘要待收 | `SettlementBar` 内 `font-semibold text-brand-gold` |
| 已收/消费 | `text-brand-text` 或 `text-brand-text-muted` |
| 弱化台账 | `text-[12px] text-brand-text-muted` |

**规则**

- **最大字号 = 当前要收的钱**，不是消费总额
- 多人分账时副行展示「应付总额 · 已收」避免误解

---

## 组件选择速查

```text
主操作？ → Button gold / mesa-badge-success
破坏性？ → ConfirmModal danger / ReasonConfirmDialog
遮罩表单？ → Modal
侧边清单？ → Drawer 模式
金额？ → tabular-nums + €x.xx
状态？ → 卡片边框色 + 小圆角 badge
反馈？ → Toast
```

---

## 相关文档

- [`01-design-principles.md`](./01-design-principles.md)
- [`04-mobile-rules.md`](./04-mobile-rules.md)
