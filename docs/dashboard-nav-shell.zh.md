# Dashboard 侧边栏壳层（`/dashboard/*`）

> 组件：`DashboardShell`、`DashboardNav`、`DashboardNavFooter`  
> 常量：`dashboard-nav-layout.ts`  
> 权限与导航项：`dashboard-feature-registry.ts`（本功能不修改）

## 1. 业务角色

Dashboard 侧边栏是楼面/收银/老板进入后台后的**全局导航壳**，在所有 `/dashboard/*` 页面共享：

| 角色 | 典型任务 | 侧边栏价值 |
|------|----------|------------|
| **frontdesk** | 楼面看板、结账、订单 | 高频切换；结账 badge 实时提醒 |
| **cashier** | 仅结账 | 收起后可让出更多双栏空间 |
| **owner** | 数据、设置 | 导航项较少，展开态信息更清晰 |

收起（Icon Rail）**仅桌面 `lg+`**；手机/平板仍用 drawer，避免窄屏 rail 误触。

## 2. 布局与状态

| 状态 | 宽度 | 主内容 `margin-left` |
|------|------|----------------------|
| 展开（默认） | `16rem` (`w-64`) | `lg:ml-64` |
| 收起 | `4.5rem` | `lg:ml-[4.5rem]` |

- 状态由 `DashboardShell` 统一管理，写入 `localStorage` 键 `mesa:dashboard-nav-collapsed`（`1` = 收起）。
- SSR / 首屏 hydration 默认**展开**，客户端 mount 后读取偏好，避免 mismatch。
- 侧边栏 `fixed`，主内容 margin 与宽度同步 `transition`（`prefers-reduced-motion` 时关闭动画）。

## 3. 收起态 UI 规则

| 区域 | 展开 | 收起 |
|------|------|------|
| Logo | 完整 `ProductLogo` + 餐厅名 | `ProductLogo variant="mark"`（M 字标） |
| 导航项 | 图标 + 文案 + badge | 图标居中；文案 `sr-only`；`aria-label`；hover tooltip |
| 结账 badge | 右侧 pill | 图标右上角角标 |
| Active | 背景 pill | pill + 左侧 gold 竖条 |
| Footer | 横排：主题 / 语言 / 退出 | 竖排图标；语言菜单向右弹出 |
| Toggle | Header 右侧 chevron | 同位置，`aria-expanded` |

## 4. 不受影响的功能

- 路由、`navItemsForRole`、middleware 权限
- 结账 Realtime badge 订阅逻辑
- 退出确认、主题、语言切换行为
- onboarding / access_error 布局（无侧边栏）
- 各 dashboard 页面业务组件

## 5. 回归清单

**桌面 `lg+`**

- [ ] 展开/收起后 main 不被遮挡
- [ ] 各 nav 链接路由与 active 态正确
- [ ] frontdesk/cashier 结账 badge 实时更新且收起可见
- [ ] 退出 / 主题 / 语言（展开与收起各测）
- [ ] 刷新后记住收起偏好

**移动 `< lg`**

- [ ] 顶栏 ☰ drawer 与改前一致
- [ ] 无 rail 模式

**特殊**

- [ ] onboarding、access_error 仍无 sidebar
