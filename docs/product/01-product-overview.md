# 产品总览

> **状态**：阶段 2 已填充（2026-06-30）  
> **读者**：产品、开发、AI 代理

## 用途

定义 Mesa 餐馆点餐系统的定位、目标用户、当前阶段边界。防止功能蔓延和 AI 乱加需求。

---

## 1. 产品定位

**Mesa**（`@mesa/web`）是面向**葡萄牙餐馆**的多租户 SaaS 点餐与结账系统，首期场景以**中餐自助餐 + 扫码点餐 + 前台分单结账**为主。

核心形态：

- 顾客扫桌码 → 多语言菜单 → 加菜下单
- 服务员看板 → 开台（自助餐人头）→ 协助点餐 / 换桌并台
- 后厨看板 → 出餐状态流转
- 顾客账单页 → 均摊 / 按菜 / 自定义分单 → 呼叫结账
- 前台 Dashboard → 确认收款、折扣、打印、关台
- 本地 **Windows 打印代理** → 后厨出品联与账单 ESC/POS 打印

数据与身份：Supabase Postgres + RLS 多租户隔离；桌位以 `table_id`（UUID）为稳定标识，纸面与界面展示用 `display_name`（如 `A-01`）。

平台侧另有 **`apps/ops`** 运营控制台（餐厅代建、打印设备运维、审计）。

---

## 2. 当前阶段目标

当前交付重点是 **「可运营的餐馆闭环」**，而非完整商业化平台：

| 目标 | 说明 |
|------|------|
| 多租户 SaaS | 每家餐厅独立 slug、菜单、桌位、员工、数据隔离 |
| 扫码点餐闭环 | 会话开台 → 加菜 → 厨房出餐 → 账单分单 → 结账收款 → 关台 |
| 自助餐开台 | 成人/儿童人头计价、改人数、开台优先于加菜 |
| 分单与结账 | 三种分单模式、多人逐笔收款、折扣与恢复点餐 |
| 打印代理 v1 | 配对、claim、出品联自动入队、账单类 `print_jobs`、Dashboard 打印助手 |
| 店主经营工具 | 数据概览、增值分析（7/30 天）、异常操作审计 |
| 员工账号与角色 | kitchen / waiter / cashier / frontdesk + 店主 owner |
| 功能开关 | 厨房看板侧栏、自动账单打印等可选模块 |
| Demo 模式 | `/demo` 无后端演示，用于销售体验 |

技术交付：Next.js 14 部署 Vercel；print-agent 通过 GitHub Release（`print-agent-v*`）分发 Windows 安装包。

---

## 3. 当前阶段不做什么

以下能力**不在当前产品承诺内**；未经明确立项不得实现：

| 排除项 | 说明 |
|--------|------|
| 在线支付 / Stripe 计费 | 结账为店内确认收款，无支付网关 |
| 全离线 / PWA 离线优先 | Web 依赖在线 Supabase；仅打印代理在本地执行 |
| Mac / Linux 打印代理 | 仅 Windows 安装包 |
| 58mm 纸宽模板 | 首期锁定 80mm |
| 单档出品联 UI 重打 | P2 待开发（见 `development-backlog.zh.md`） |
| 顾客端 App | 仅 H5 网页 |
| 库存 / 采购 / 成本核算 | 无进销存 |
| 外卖 / 配送 | 仅堂食桌码场景 |
| GDPR 合规套件 / 数据导出自助 | P3 中长期 |
| 自建 Postgres 生产替换 Supabase | 有迁移计划文档，未执行 |
| 本地私有化一键部署 | 有计划文档，非当前主路径 |
| Authenticode 代码签名 | 第一期不签 |
| 恢复 `table_number` 字段 | 已废弃，禁止回归 |

部分能力**代码或 schema 已有、产品未闭环**：如 `print_locale` 数据库字段已用于入队，Dashboard **尚无**三选一设置 UI；打印代理吊销 RLS **端到端验收**仍为 P0 硬门槛。

---

## 4. 核心用户

| 角色 | 入口 | 主要职责 |
|------|------|----------|
| **店主 / Owner** | `/auth/login` → `/dashboard` | 设置、菜单、桌位、经营分析、异常确认、员工管理 |
| **前台 / Frontdesk** | 员工登录 → Dashboard 子集 | 服务员看板嵌入、结账、订单、桌位、菜单查看 |
| **收银员 / Cashier** | 员工登录 → `/dashboard/checkout` | 仅结账台 |
| **服务员 / Waiter** | `/{slug}/staff/login` → `/{slug}/waiter` | 看板、开台、桌台详情、协助点餐、换桌并台、关台 |
| **后厨 / Kitchen** | `/{slug}/kitchen` | 订单出餐、退菜（void） |
| **顾客 / Customer** | `/{slug}/menu`、`/{slug}/bill` | 扫码点餐、分单、呼叫结账（无账号） |
| **平台运营 / Ops** | `apps/ops` | 餐厅代建、设备吊销、打印任务巡检 |

Dashboard 导航按角色裁剪，注册表见 `apps/web/src/lib/dashboard-feature-registry.ts`（owner / frontdesk / cashier）。

---

## 5. 系统解决什么问题

| 痛点 | Mesa 做法 |
|------|-----------|
| 纸质菜单难维护、多语言成本高 | Dashboard 菜品/分类 CRUD，菜单页 pt/en/zh 切换 |
| 口头点餐易错、后厨漏单 | 订单实时进厨房看板；加菜自动打出品联（有打印代理时） |
| 自助餐人头难统计 | 服务员开台录入成人/儿童数，计价规则可配置 |
| AA 制 / 按人结账复杂 | 账单页三种分单；结账台按人确认收款与台账 |
| 折扣与退菜难追溯 | 操作日志 + 异常操作队列供店主确认 |
| 多店数据混乱 | 租户 RLS + slug 隔离 |
| 热敏打印机难接浏览器 | 本地 print-agent 轮询 `print_jobs`，ESC/POS 出纸 |

---

## 相关文档

- 功能地图：[`02-feature-map.md`](./02-feature-map.md)
- 用户流程（阶段 3）：[`03-user-flows.md`](./03-user-flows.md)
- 待开发总览：[`../development-backlog.zh.md`](../development-backlog.zh.md)
- 平台运营：[`../platform-admin-plan.zh.md`](../platform-admin-plan.zh.md)
