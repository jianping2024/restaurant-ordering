#!/usr/bin/env python3
"""Generate batch-4 knowledge graph from extraction results."""
import json
import math
from pathlib import Path

ROOT = Path("/Users/chenjianping/Documents/restaurant-ordering")
EXTRACT = ROOT / ".understand-anything/tmp/ua-file-extract-results-4.json"
INPUT = ROOT / ".understand-anything/tmp/ua-file-analyzer-input-4.json"
OUT_DIR = ROOT / ".understand-anything/intermediate"

FILE_META = {
    "apps/web/src/app/auth/login/page.tsx": {
        "summary": "餐厅老板邮箱密码登录页，处理 Supabase 认证、错误提示与注册入口跳转。",
        "tags": ["entry-point", "component", "authentication", "dashboard"],
        "complexity": "moderate",
    },
    "apps/web/src/app/auth/register/page.tsx": {
        "summary": "注册关闭提示页，告知用户注册功能已关闭并引导至登录。",
        "tags": ["component", "authentication", "landing"],
        "complexity": "simple",
    },
    "apps/web/src/app/auth/staff/change-password/page.tsx": {
        "summary": "员工强制改密页，校验新密码规则并通过 Supabase 更新员工账号密码。",
        "tags": ["component", "authentication", "staff"],
        "complexity": "moderate",
    },
    "apps/web/src/app/auth/staff/login/page.tsx": {
        "summary": "全局员工登录路由页，仅渲染 StaffLoginForm 组件。",
        "tags": ["entry-point", "component", "staff", "authentication"],
        "complexity": "simple",
    },
    "apps/web/src/app/dashboard/settings/layout.tsx": {
        "summary": "仪表盘设置区布局包装器，将子路由包裹在 DashboardSettingsShell 中。",
        "tags": ["entry-point", "layout", "dashboard"],
        "complexity": "simple",
    },
    "apps/web/src/app/dashboard/tables/page.tsx": {
        "summary": "前台桌台管理服务端页面，加载桌台数据并渲染 TablesManager。",
        "tags": ["entry-point", "component", "dashboard", "tables"],
        "complexity": "simple",
    },
    "apps/web/src/app/dashboard/value-analytics/page.tsx": {
        "summary": "价值分析服务端入口，校验仪表盘访问权限后渲染分析客户端组件。",
        "tags": ["entry-point", "component", "analytics", "dashboard"],
        "complexity": "simple",
    },
    "apps/web/src/app/layout.tsx": {
        "summary": "Next.js 根布局，注入主题/语言 Provider、Toast 容器与全局样式。",
        "tags": ["entry-point", "layout", "i18n", "theme"],
        "complexity": "moderate",
    },
    "apps/web/src/app/page.tsx": {
        "summary": "产品落地页，展示 MesaGo 功能亮点并提供登录与语言切换入口。",
        "tags": ["entry-point", "component", "landing", "marketing"],
        "complexity": "moderate",
    },
    "apps/web/src/components/customer/RestaurantMaintenancePage.tsx": {
        "summary": "顾客端维护模式页面，在餐厅暂停服务时展示维护提示。",
        "tags": ["component", "customer", "maintenance"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/BuffetSettingsManager.tsx": {
        "summary": "自助餐定价与规则综合管理器，协调时段、日历、价格矩阵与周五周末策略的 CRUD。",
        "tags": ["component", "dashboard", "buffet", "pricing"],
        "complexity": "complex",
        "languageNotes": "大型客户端状态机，集中编排多个自助餐子面板与 API 客户端调用。",
    },
    "apps/web/src/components/dashboard/CloseTableSessionAction.tsx": {
        "summary": "关台操作按钮组件，处理确认弹窗、异常原因选择与关台 API 响应解析。",
        "tags": ["component", "dashboard", "table-session", "checkout"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/DashboardAccessError.tsx": {
        "summary": "仪表盘权限不足错误页，提供重新登录与登出确认流程。",
        "tags": ["component", "dashboard", "authentication", "error-handling"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/DashboardDatePicker.tsx": {
        "summary": "仪表盘日期选择器，支持 ISO 日期解析、弹出层定位与本地化格式。",
        "tags": ["component", "utility", "date", "dashboard"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/DashboardSettingsShell.tsx": {
        "summary": "设置区外壳布局，渲染设置导航标签与宽屏布局切换。",
        "tags": ["component", "layout", "dashboard", "settings"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/FeatureFlagsManager.tsx": {
        "summary": "餐厅功能开关管理器，编辑并保存各功能位与数值型配置。",
        "tags": ["component", "dashboard", "settings", "feature-flags"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx": {
        "summary": "打印代理凭证到期提醒横幅，按设备数量展示续期提示。",
        "tags": ["component", "dashboard", "printing", "alert"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/PrintAgentDevicesPanel.tsx": {
        "summary": "打印代理设备列表面板，展示在线状态并支持解绑与续期操作。",
        "tags": ["component", "dashboard", "printing", "devices"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/PrintAgentSchedulePanel.tsx": {
        "summary": "打印代理云端调度配置面板，编辑轮询间隔与营业时间窗口。",
        "tags": ["component", "dashboard", "printing", "configuration"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/PrintStationsManager.tsx": {
        "summary": "厨房打印站管理器，支持创建、排序、绑定菜品与删除打印站。",
        "tags": ["component", "dashboard", "printing", "menu"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/ReceiptBillPrinterPanel.tsx": {
        "summary": "结账单默认打印机设置面板，加载并保存账单打印路由配置。",
        "tags": ["component", "dashboard", "printing", "checkout"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/ReceiptPrinterSelect.tsx": {
        "summary": "小票打印机下拉选择器，异步拉取可用打印站并格式化展示名称。",
        "tags": ["component", "dashboard", "printing", "form"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/RestaurantOnboarding.tsx": {
        "summary": "新餐厅入驻向导，收集餐厅名称并生成 slug 完成初始创建。",
        "tags": ["component", "dashboard", "onboarding", "form"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/SettingsForm.tsx": {
        "summary": "餐厅基础设置表单，编辑名称、联系方式、地理点单半径等运营参数。",
        "tags": ["component", "dashboard", "settings", "form"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/StaffAccountsManager.tsx": {
        "summary": "员工账号管理器，支持创建、编辑角色、重置密码与停用员工。",
        "tags": ["component", "dashboard", "staff", "crud"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/TableGroupsManager.tsx": {
        "summary": "桌台分组管理器，维护分组名称、排序与桌台归属分配。",
        "tags": ["component", "dashboard", "tables", "crud"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/TablesManager.tsx": {
        "summary": "桌台综合管理器，涵盖桌台 CRUD、二维码导出、分组与自助餐标签页。",
        "tags": ["component", "dashboard", "tables", "qr-code"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx": {
        "summary": "价值分析客户端页面，展示 KPI、趋势图与畅销榜并支持日期筛选。",
        "tags": ["component", "dashboard", "analytics", "chart"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx": {
        "summary": "价值分析畅销榜表格，以可配置列渲染菜品/分类排行数据。",
        "tags": ["component", "dashboard", "analytics", "table"],
        "complexity": "simple",
    },
    "apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx": {
        "summary": "价值分析趋势折线图，将营收与客户趋势数据转换为 Recharts 序列。",
        "tags": ["component", "dashboard", "analytics", "chart"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx": {
        "summary": "自助餐日历例外面板，管理特定日期的价格覆盖与节假日规则。",
        "tags": ["component", "dashboard", "buffet", "calendar"],
        "complexity": "moderate",
    },
    "apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx": {
        "summary": "自助餐周五周末策略面板，配置周末加价时段与启用状态。",
        "tags": ["component", "dashboard", "buffet", "pricing"],
        "complexity": "moderate",
    },
}

FUNC_META = {
    ("apps/web/src/app/auth/login/page.tsx", "LoginPage"): {
        "summary": "客户端登录表单，调用 Supabase signInWithPassword 并处理重定向。",
        "tags": ["component", "authentication", "form"],
        "complexity": "moderate",
    },
    ("apps/web/src/app/auth/register/page.tsx", "RegisterClosedPage"): {
        "summary": "静态注册关闭说明页组件。",
        "tags": ["component", "authentication"],
        "complexity": "simple",
    },
    ("apps/web/src/app/auth/staff/change-password/page.tsx", "StaffChangePasswordPage"): {
        "summary": "员工改密表单，校验密码强度并调用 Supabase updateUser。",
        "tags": ["component", "staff", "authentication"],
        "complexity": "moderate",
    },
    ("apps/web/src/app/auth/staff/login/page.tsx", "GlobalStaffLoginPage"): {
        "summary": "全局员工登录页路由组件。",
        "tags": ["entry-point", "staff"],
        "complexity": "simple",
    },
    ("apps/web/src/app/dashboard/settings/layout.tsx", "SettingsLayout"): {
        "summary": "设置子路由布局，委托 DashboardSettingsShell 渲染。",
        "tags": ["layout", "settings"],
        "complexity": "simple",
    },
    ("apps/web/src/app/dashboard/tables/page.tsx", "TablesPage"): {
        "summary": "服务端桌台页，解析标签偏好并加载前台桌台上下文。",
        "tags": ["entry-point", "tables", "server-component"],
        "complexity": "simple",
    },
    ("apps/web/src/app/dashboard/value-analytics/page.tsx", "ValueAnalyticsPage"): {
        "summary": "服务端价值分析页，校验 owner 权限后挂载客户端分析组件。",
        "tags": ["entry-point", "analytics", "server-component"],
        "complexity": "simple",
    },
    ("apps/web/src/app/layout.tsx", "RootLayout"): {
        "summary": "根 HTML 布局，读取服务端语言并包裹全局 Provider。",
        "tags": ["layout", "i18n", "theme"],
        "complexity": "moderate",
    },
    ("apps/web/src/app/page.tsx", "LandingPage"): {
        "summary": "营销落地页主组件，渲染功能列表与 CTA 按钮。",
        "tags": ["component", "landing", "marketing"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/customer/RestaurantMaintenancePage.tsx", "RestaurantMaintenancePage"): {
        "summary": "维护模式提示 UI，展示本地化维护文案。",
        "tags": ["component", "customer", "maintenance"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/BuffetSettingsManager.tsx", "buildRuleDraft"): {
        "summary": "根据今日日期构建新自助餐定价规则草稿对象。",
        "tags": ["utility", "buffet", "pricing"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/BuffetSettingsManager.tsx", "ruleToDraft"): {
        "summary": "将数据库规则记录转换为可编辑草稿格式。",
        "tags": ["utility", "buffet", "serialization"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/BuffetSettingsManager.tsx", "BuffetSettingsManager"): {
        "summary": "自助餐设置主组件，编排规则/时段/日历子面板与保存逻辑。",
        "tags": ["component", "buffet", "crud"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/CloseTableSessionAction.tsx", "CloseTableSessionAction"): {
        "summary": "关台按钮与确认流程，集成异常原因选择与 API 响应解释。",
        "tags": ["component", "table-session", "checkout"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/DashboardAccessError.tsx", "DashboardAccessError"): {
        "summary": "权限错误 UI，触发登出确认或页面刷新。",
        "tags": ["component", "error-handling", "authentication"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/DashboardDatePicker.tsx", "computePopupCoords"): {
        "summary": "根据锚点元素计算日期弹出层的视口坐标。",
        "tags": ["utility", "date", "layout"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/DashboardDatePicker.tsx", "DashboardDatePicker"): {
        "summary": "可复用日期选择输入与日历弹出组件。",
        "tags": ["component", "date", "form"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/DashboardSettingsShell.tsx", "DashboardSettingsShell"): {
        "summary": "设置页导航外壳，高亮当前标签并切换宽屏布局。",
        "tags": ["component", "layout", "settings"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/FeatureFlagsManager.tsx", "FeatureFlagsManager"): {
        "summary": "功能开关编辑表单，批量保存餐厅特性配置。",
        "tags": ["component", "settings", "feature-flags"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx", "PrintAgentCredentialExpiryAlert"): {
        "summary": "凭证到期警告条，格式化到期日期与剩余天数。",
        "tags": ["component", "printing", "alert"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/PrintAgentDevicesPanel.tsx", "PrintAgentDevicesPanel"): {
        "summary": "打印代理设备管理面板，处理解绑与续期 API 调用。",
        "tags": ["component", "printing", "devices"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/PrintAgentSchedulePanel.tsx", "PrintAgentSchedulePanel"): {
        "summary": "云端调度配置主面板，校验并提交 print-agent 云配置。",
        "tags": ["component", "printing", "configuration"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/PrintAgentSchedulePanel.tsx", "PollIntervalField"): {
        "summary": "轮询间隔输入子组件，封装整数校验与单位展示。",
        "tags": ["component", "form", "printing"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/PrintStationsManager.tsx", "PrintStationsManager"): {
        "summary": "打印站 CRUD 与排序管理主组件。",
        "tags": ["component", "printing", "crud"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/ReceiptBillPrinterPanel.tsx", "ReceiptBillPrinterPanel"): {
        "summary": "账单默认打印机配置面板，读写路由快照。",
        "tags": ["component", "printing", "checkout"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ReceiptPrinterSelect.tsx", "ReceiptPrinterSelect"): {
        "summary": "异步打印机下拉选择，调用 fetchReceiptPrinters 加载选项。",
        "tags": ["component", "printing", "form"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/RestaurantOnboarding.tsx", "RestaurantOnboarding"): {
        "summary": "入驻向导主组件，提交餐厅创建请求并跳转仪表盘。",
        "tags": ["component", "onboarding", "form"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/SettingsForm.tsx", "SettingsForm"): {
        "summary": "餐厅运营参数编辑表单，含地理围栏与联系方式字段。",
        "tags": ["component", "settings", "form"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/StaffAccountsManager.tsx", "errorMessage"): {
        "summary": "将 API 错误响应映射为本地化错误文案。",
        "tags": ["utility", "staff", "error-handling"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/StaffAccountsManager.tsx", "StaffAccountsManager"): {
        "summary": "员工账号 CRUD 主组件，管理角色与密码策略。",
        "tags": ["component", "staff", "crud"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/TableGroupsManager.tsx", "TableGroupsManager"): {
        "summary": "桌台分组 CRUD 与桌台分配主组件。",
        "tags": ["component", "tables", "crud"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/TablesManager.tsx", "requestDashboardTables"): {
        "summary": "向仪表盘 API 发起桌台列表刷新请求。",
        "tags": ["utility", "tables", "api"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/TablesManager.tsx", "TablesManager"): {
        "summary": "桌台管理主界面，整合分组、二维码与自助餐标签。",
        "tags": ["component", "tables", "qr-code"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx", "LoadingSkeleton"): {
        "summary": "价值分析页 KPI 区域加载骨架屏。",
        "tags": ["component", "analytics", "loading"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx", "ValueAnalyticsKpiGrid"): {
        "summary": "渲染营收、客单等 KPI 指标网格。",
        "tags": ["component", "analytics", "kpi"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx", "ValueAnalyticsPageClient"): {
        "summary": "价值分析客户端主页面，协调筛选、图表与排行榜。",
        "tags": ["component", "analytics", "dashboard"],
        "complexity": "complex",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx", "ValueAnalyticsTopTable"): {
        "summary": "通用排行表格，按列配置渲染分析数据行。",
        "tags": ["component", "analytics", "table"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx", "buildTrendChartPoints"): {
        "summary": "将趋势行数据映射为 Recharts 折线图数据点。",
        "tags": ["utility", "analytics", "chart"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx", "renderTrendTooltip"): {
        "summary": "自定义趋势图 tooltip 渲染函数。",
        "tags": ["utility", "analytics", "chart"],
        "complexity": "simple",
    },
    ("apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx", "ValueAnalyticsTrendChart"): {
        "summary": "营收/客流趋势双轴折线图组件。",
        "tags": ["component", "analytics", "chart"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx", "BuffetCalendarPanel"): {
        "summary": "自助餐日历例外管理面板，支持单日与区间添加。",
        "tags": ["component", "buffet", "calendar"],
        "complexity": "moderate",
    },
    ("apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx", "BuffetFridayWeekendPanel"): {
        "summary": "周五周末加价策略编辑面板。",
        "tags": ["component", "buffet", "pricing"],
        "complexity": "moderate",
    },
}

# Cross-batch call targets: (source_path, caller, callee) -> target node id
CALL_EDGES = [
    ("apps/web/src/app/auth/login/page.tsx", "LoginPage", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/app/auth/login/page.tsx", "LoginPage", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/app/auth/register/page.tsx", "RegisterClosedPage", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/app/auth/register/page.tsx", "RegisterClosedPage", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/app/auth/staff/change-password/page.tsx", "StaffChangePasswordPage", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/app/auth/staff/change-password/page.tsx", "StaffChangePasswordPage", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/app/dashboard/tables/page.tsx", "TablesPage", "parseTablesManagerTab", "function:apps/web/src/lib/tables-manager-tab-preference.ts:parseTablesManagerTab"),
    ("apps/web/src/app/dashboard/tables/page.tsx", "TablesPage", "loadFrontdeskDashboardTables", "function:apps/web/src/lib/dashboard-tables.ts:loadFrontdeskDashboardTables"),
    ("apps/web/src/app/dashboard/value-analytics/page.tsx", "ValueAnalyticsPage", "loadDashboardAccess", "function:apps/web/src/lib/dashboard-access.ts:loadDashboardAccess"),
    ("apps/web/src/app/layout.tsx", "RootLayout", "getServerLanguage", "function:apps/web/src/lib/i18n.server.ts:getServerLanguage"),
    ("apps/web/src/app/page.tsx", "LandingPage", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/app/page.tsx", "LandingPage", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/customer/RestaurantMaintenancePage.tsx", "RestaurantMaintenancePage", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/components/customer/RestaurantMaintenancePage.tsx", "RestaurantMaintenancePage", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/dashboard/CloseTableSessionAction.tsx", "CloseTableSessionAction", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/components/dashboard/CloseTableSessionAction.tsx", "CloseTableSessionAction", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/dashboard/CloseTableSessionAction.tsx", "CloseTableSessionAction", "abnormalReasonOptions", "function:apps/web/src/lib/audit/reason-labels.ts:abnormalReasonOptions"),
    ("apps/web/src/components/dashboard/DashboardAccessError.tsx", "DashboardAccessError", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/components/dashboard/DashboardAccessError.tsx", "DashboardAccessError", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/dashboard/DashboardAccessError.tsx", "DashboardAccessError", "useSignOutConfirmState", "function:apps/web/src/lib/auth/sign-out-confirm.tsx:useSignOutConfirmState"),
    ("apps/web/src/components/dashboard/DashboardAccessError.tsx", "DashboardAccessError", "dashboardSignOutAndRedirect", "function:apps/web/src/lib/auth/sign-out-client.ts:dashboardSignOutAndRedirect"),
    ("apps/web/src/components/dashboard/DashboardSettingsShell.tsx", "DashboardSettingsShell", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/components/dashboard/DashboardSettingsShell.tsx", "DashboardSettingsShell", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/dashboard/DashboardSettingsShell.tsx", "DashboardSettingsShell", "getActiveSettingsNavItem", "function:apps/web/src/lib/settings-nav.ts:getActiveSettingsNavItem"),
    ("apps/web/src/components/dashboard/DashboardSettingsShell.tsx", "DashboardSettingsShell", "isSettingsWideLayout", "function:apps/web/src/lib/settings-nav.ts:isSettingsWideLayout"),
    ("apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx", "PrintAgentCredentialExpiryAlert", "useLanguage", "function:apps/web/src/components/providers/LanguageProvider.tsx:useLanguage"),
    ("apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx", "PrintAgentCredentialExpiryAlert", "getMessages", "function:apps/web/src/lib/i18n/messages.ts:getMessages"),
    ("apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx", "PrintAgentCredentialExpiryAlert", "daysUntilValidUntil", "function:apps/web/src/lib/print-agent-credential-expiry.ts:daysUntilValidUntil"),
    ("apps/web/src/components/dashboard/PrintAgentCredentialExpiryAlert.tsx", "PrintAgentCredentialExpiryAlert", "formatValidUntilDate", "function:apps/web/src/lib/print-agent-credential-expiry.ts:formatValidUntilDate"),
    ("apps/web/src/components/dashboard/ReceiptPrinterSelect.tsx", "ReceiptPrinterSelect", "fetchReceiptPrinters", "function:apps/web/src/lib/fetch-receipt-printers.ts:fetchReceiptPrinters"),
    ("apps/web/src/components/dashboard/SettingsForm.tsx", "SettingsForm", "normalizeOrderRadiusMeters", "function:apps/web/src/lib/order-radius.ts:normalizeOrderRadiusMeters"),
    ("apps/web/src/components/dashboard/TableGroupsManager.tsx", "TableGroupsManager", "sortTableGroups", "function:apps/web/src/lib/restaurant-table-groups.ts:sortTableGroups"),
    ("apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx", "BuffetFridayWeekendPanel", "dbTimeToHm", "function:apps/web/src/lib/buffet-pricing-admin.ts:dbTimeToHm"),
    ("apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx", "BuffetFridayWeekendPanel", "hmToDbTime", "function:apps/web/src/lib/buffet-pricing-admin.ts:hmToDbTime"),
    ("apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx", "buildTrendChartPoints", "formatDateLabel", "function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:formatDateLabel"),
]

DEPENDS_ON = [
    ("file:apps/web/src/app/auth/staff/login/page.tsx", "file:apps/web/src/components/staff/StaffLoginForm.tsx"),
    ("file:apps/web/src/app/dashboard/settings/layout.tsx", "file:apps/web/src/components/dashboard/DashboardSettingsShell.tsx"),
    ("file:apps/web/src/app/dashboard/tables/page.tsx", "file:apps/web/src/components/dashboard/TablesManager.tsx"),
    ("file:apps/web/src/app/dashboard/value-analytics/page.tsx", "file:apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx"),
    ("file:apps/web/src/components/dashboard/ReceiptBillPrinterPanel.tsx", "file:apps/web/src/components/dashboard/ReceiptPrinterSelect.tsx"),
    ("file:apps/web/src/components/dashboard/TablesManager.tsx", "file:apps/web/src/components/dashboard/TableGroupsManager.tsx"),
    ("file:apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx", "file:apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx"),
    ("file:apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx", "file:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx"),
    ("file:apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx", "file:apps/web/src/components/dashboard/DashboardDatePicker.tsx"),
    ("file:apps/web/src/components/dashboard/BuffetSettingsManager.tsx", "file:apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx"),
    ("file:apps/web/src/components/dashboard/BuffetSettingsManager.tsx", "file:apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx"),
]

INTERNAL_CALLS = [
    ("function:apps/web/src/app/dashboard/settings/layout.tsx:SettingsLayout", "function:apps/web/src/components/dashboard/DashboardSettingsShell.tsx:DashboardSettingsShell"),
    ("function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:buildTrendChartPoints", "function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:formatDateLabel"),
    ("function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:ValueAnalyticsTrendChart", "function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:buildTrendChartPoints"),
    ("function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:ValueAnalyticsTrendChart", "function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:renderTrendTooltip"),
    ("function:apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx:ValueAnalyticsPageClient", "function:apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx:ValueAnalyticsTopTable"),
    ("function:apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx:ValueAnalyticsPageClient", "function:apps/web/src/components/dashboard/ValueAnalyticsTrendChart.tsx:ValueAnalyticsTrendChart"),
    ("function:apps/web/src/components/dashboard/BuffetSettingsManager.tsx:BuffetSettingsManager", "function:apps/web/src/components/dashboard/BuffetSettingsManager.tsx:buildRuleDraft"),
    ("function:apps/web/src/components/dashboard/BuffetSettingsManager.tsx:BuffetSettingsManager", "function:apps/web/src/components/dashboard/BuffetSettingsManager.tsx:ruleToDraft"),
]


def is_significant(fn, exports):
    lines = fn["endLine"] - fn["startLine"] + 1
    exported = any(e["name"] == fn["name"] for e in exports)
    return lines >= 10 or exported


def build_graph():
    with open(EXTRACT) as f:
        extract = json.load(f)
    with open(INPUT) as f:
        inp = json.load(f)
    batch_import = inp["batchImportData"]

    nodes = []
    edges = []
    node_ids = set()

    for r in extract["results"]:
        path = r["path"]
        meta = FILE_META[path]
        file_id = f"file:{path}"
        node = {
            "id": file_id,
            "type": "file",
            "name": Path(path).name,
            "filePath": path,
            "summary": meta["summary"],
            "tags": meta["tags"],
            "complexity": meta["complexity"],
        }
        if "languageNotes" in meta:
            node["languageNotes"] = meta["languageNotes"]
        nodes.append(node)
        node_ids.add(file_id)

        exports = r.get("exports", [])
        exported_names = {e["name"] for e in exports if e["name"] != "metadata"}

        for fn in r.get("functions", []):
            if not is_significant(fn, exports):
                continue
            key = (path, fn["name"])
            fmeta = FUNC_META.get(key, {
                "summary": f"{fn['name']} 函数。",
                "tags": ["utility"],
                "complexity": "simple",
            })
            fid = f"function:{path}:{fn['name']}"
            fnode = {
                "id": fid,
                "type": "function",
                "name": fn["name"],
                "filePath": path,
                "lineRange": [fn["startLine"], fn["endLine"]],
                "summary": fmeta["summary"],
                "tags": fmeta["tags"],
                "complexity": fmeta["complexity"],
            }
            nodes.append(fnode)
            node_ids.add(fid)
            edges.append({"source": file_id, "target": fid, "type": "contains", "direction": "forward", "weight": 1.0})
            if fn["name"] in exported_names:
                edges.append({"source": file_id, "target": fid, "type": "exports", "direction": "forward", "weight": 0.8})

        for imp in batch_import.get(path, []):
            edges.append({
                "source": file_id,
                "target": f"file:{imp}",
                "type": "imports",
                "direction": "forward",
                "weight": 0.7,
            })

    for path, caller, callee, target in CALL_EDGES:
        src = f"function:{path}:{caller}"
        if src in node_ids:
            edges.append({"source": src, "target": target, "type": "calls", "direction": "forward", "weight": 0.8})

    for src, tgt in DEPENDS_ON:
        edges.append({"source": src, "target": tgt, "type": "depends_on", "direction": "forward", "weight": 0.6})

    for src, tgt in INTERNAL_CALLS:
        if src in node_ids and tgt in node_ids:
            edges.append({"source": src, "target": tgt, "type": "calls", "direction": "forward", "weight": 0.8})

    return nodes, edges


def split_and_write(nodes, edges):
    node_count = len(nodes)
    edge_count = len(edges)

    if node_count <= 60 and edge_count <= 120:
        out = OUT_DIR / "batch-4.json"
        with open(out, "w") as f:
            json.dump({"nodes": nodes, "edges": edges}, f, ensure_ascii=False, indent=2)
        return [(out, node_count, edge_count)]

    files = sorted({n["filePath"] for n in nodes if "filePath" in n and n["type"] == "file"})
    parts = math.ceil(max(node_count / 60, edge_count / 120))
    chunk = math.ceil(len(files) / parts)
    file_chunks = [files[i:i + chunk] for i in range(0, len(files), chunk)]

    written = []
    node_by_id = {n["id"]: n for n in nodes}
    file_set_chunks = [set(c) for c in file_chunks]

    for i, fchunk in enumerate(file_set_chunks, 1):
        part_nodes = [n for n in nodes if n.get("filePath") in fchunk]
        part_node_ids = {n["id"] for n in part_nodes}
        part_edges = [e for e in edges if e["source"] in part_node_ids]
        out = OUT_DIR / f"batch-4-part-{i}.json"
        with open(out, "w") as f:
            json.dump({"nodes": part_nodes, "edges": part_edges}, f, ensure_ascii=False, indent=2)
        written.append((out, len(part_nodes), len(part_edges)))

    return written


def main():
    nodes, edges = build_graph()
    import_count = sum(1 for e in edges if e["type"] == "imports")
    expected = sum(len(v) for v in json.load(open(INPUT))["batchImportData"].values())
    assert import_count == expected, f"import mismatch: {import_count} vs {expected}"

    results = split_and_write(nodes, edges)
    total_n = len(nodes)
    total_e = len(edges)
    for out, n, e in results:
        print(f"Wrote {out} nodes={n} edges={e}")
    print(f"TOTAL nodes={total_n} edges={total_e} import_edges={import_count}")


if __name__ == "__main__":
    main()
