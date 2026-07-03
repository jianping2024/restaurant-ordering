import fs from 'fs';
import path from 'path';

const ROOT = '/Users/chenjianping/Documents/restaurant-ordering';
const extract = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.understand-anything/tmp/ua-file-extract-results-1.json'), 'utf8')
);
const input = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.understand-anything/tmp/ua-file-analyzer-input-1.json'), 'utf8')
);

const neighborMap = {
  'apps/web/src/app/api/dashboard/menu/categories/route.ts': [
    { path: 'apps/web/src/lib/dashboard-menu-api.ts', symbols: ['menuApiError', 'readJsonBody', 'loadWritableMenuContext', 'loadWritableFrontdeskContext'] },
    { path: 'apps/web/src/lib/dashboard-menu-server.ts', symbols: ['createMenuCategory', 'updateMenuCategory', 'deleteMenuCategory', 'createMenuItem', 'moveMenuItemOrder', 'updateMenuItem', 'deleteMenuItem', 'batchSetMenuItemsAvailable', 'setMenuItemImage', 'createPrintStation', 'updatePrintStation', 'movePrintStationOrder', 'deletePrintStation', 'parseCategoryBody', 'parseCategoryParentId', 'parsePrintStationBody', 'parseMenuItemBody'] },
  ],
  'apps/web/src/app/api/dashboard/menu/items/[id]/image/route.ts': [
    { path: 'apps/web/src/lib/dashboard-menu-api.ts', symbols: ['menuApiError', 'readJsonBody', 'loadWritableMenuContext', 'loadWritableFrontdeskContext'] },
    { path: 'apps/web/src/lib/dashboard-menu-server.ts', symbols: ['setMenuItemImage', 'parseMenuItemBody'] },
  ],
  'apps/web/src/app/api/dashboard/menu/items/route.ts': [
    { path: 'apps/web/src/lib/dashboard-menu-api.ts', symbols: ['menuApiError', 'readJsonBody', 'loadWritableMenuContext', 'loadWritableFrontdeskContext'] },
    { path: 'apps/web/src/lib/dashboard-menu-server.ts', symbols: ['createMenuItem', 'moveMenuItemOrder', 'updateMenuItem', 'deleteMenuItem', 'batchSetMenuItemsAvailable', 'parseMenuItemBody'] },
  ],
  'apps/web/src/app/api/dashboard/menu/print-stations/route.ts': [
    { path: 'apps/web/src/lib/dashboard-menu-api.ts', symbols: ['menuApiError', 'readJsonBody', 'loadWritableMenuContext', 'loadWritableFrontdeskContext'] },
    { path: 'apps/web/src/lib/dashboard-menu-server.ts', symbols: ['createPrintStation', 'updatePrintStation', 'movePrintStationOrder', 'deletePrintStation', 'parsePrintStationBody'] },
  ],
};

// File summaries (zh)
const fileSummaries = {
  'apps/web/src/app/api/dashboard/menu/categories/route.ts': '仪表盘菜单分类 CRUD API 路由，校验权限后委托 server 层创建、更新与删除分类。',
  'apps/web/src/app/api/dashboard/menu/items/[id]/image/route.ts': '菜单菜品图片上传 API，接收 multipart 表单并调用 server 层写入存储与数据库。',
  'apps/web/src/app/api/dashboard/menu/items/route.ts': '仪表盘菜单菜品 CRUD 与批量上下架 API，支持排序移动与字段解析校验。',
  'apps/web/src/app/api/dashboard/menu/print-stations/route.ts': '打印档口（print station）管理 API，处理创建、更新排序与删除操作。',
  'apps/web/src/app/dashboard/menu/page.tsx': '仪表盘菜单管理页面，服务端加载菜单数据并渲染 MenuManager 客户端组件。',
  'apps/web/src/app/dashboard/tables/page.tsx': '前台桌台管理页面，加载桌台数据并挂载 TablesManager 组件。',
  'apps/web/src/components/dashboard/BuffetSettingsManager.tsx': '自助餐定价与规则总控组件，编排时段、日历、价格矩阵与各子面板的增删改交互。',
  'apps/web/src/components/dashboard/CloseTableSessionAction.tsx': '关闭桌台会话操作组件，含原因确认、审计标签与 API 响应解释。',
  'apps/web/src/components/dashboard/DashboardDatePicker.tsx': '仪表盘日期选择器，支持弹出日历、本地化月份标签与视口定位。',
  'apps/web/src/components/dashboard/DishSortOrderButtons.tsx': '菜品排序上下移动按钮组，触发相邻 sort_order 交换回调。',
  'apps/web/src/components/dashboard/MenuManager.tsx': '菜单管理主界面，涵盖分类树、菜品编辑、图片、VAT、打印档口绑定与批量操作。',
  'apps/web/src/components/dashboard/PrintStationsManager.tsx': '打印档口管理子模块，支持增删改、排序及与菜品/分类的绑定统计展示。',
  'apps/web/src/components/dashboard/StaffAccountsManager.tsx': '员工账号管理界面，创建/编辑员工登录名、角色与密码校验。',
  'apps/web/src/components/dashboard/TableGroupsManager.tsx': '桌台分组管理，维护分组名称、备注及桌台归属分配。',
  'apps/web/src/components/dashboard/TablesManager.tsx': '桌台管理主组件，含桌台列表、分组 Tab、批量添加与 Supabase 实时刷新。',
  'apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx': '自助餐日历例外面板，管理特定日期的 day_kind 覆盖与冲突检测。',
  'apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx': '周五/周末自助餐时段策略面板，配置起止时间与保存策略。',
  'apps/web/src/components/dashboard/buffet/BuffetPriceMatrix.tsx': '自助餐价格矩阵表格，按 day_kind 与规则展示各档位价格。',
  'apps/web/src/components/dashboard/buffet/BuffetPricePreview.tsx': '自助餐价格预览面板，模拟指定日期时间下的生效规则与价格。',
  'apps/web/src/components/dashboard/buffet/BuffetRulesToolbar.tsx': '自助餐规则工具栏，提供规则筛选、状态切换与新建入口。',
  'apps/web/src/components/dashboard/buffet/BuffetSettingsTabs.tsx': '自助餐设置 Tab 切换组件，在规则、时段、日历等视图间导航。',
  'apps/web/src/components/dashboard/buffet/BuffetTimeSlotsPanel.tsx': '自助餐时段面板，编辑各档位的起止时间与容纳人数。',
  'apps/web/src/components/dashboard/buffet/BuffetToolbarSelect.tsx': '自助餐工具栏下拉选择器，统一样式的原生 select 封装。',
  'apps/web/src/components/dashboard/buffet/SlotTimeHmField.tsx': '时段时分输入字段，封装 TimeHmInput 与标签布局。',
  'apps/web/src/components/dashboard/buffet/buffet-field-styles.ts': '自助餐表单字段 Tailwind 样式常量与分段按钮 class 生成函数。',
  'apps/web/src/components/dashboard/settings/SettingsPageHelp.tsx': '设置页帮助入口，Modal 展示各设置模块说明内容。',
  'apps/web/src/components/ui/Button.tsx': '通用按钮与链接按钮组件，提供 variant/size 样式与图标槽位。',
  'apps/web/src/components/ui/ConfirmModal.tsx': '确认对话框，基于 Modal 封装确定/取消双按钮流程。',
  'apps/web/src/components/ui/DecimalInput.tsx': '小数输入框，集成 number-input 规范化与格式化逻辑。',
  'apps/web/src/components/ui/Input.tsx': '基础文本输入组件，统一样式与 forwardRef 透传。',
  'apps/web/src/components/ui/IntegerInput.tsx': '非负整数输入框，限制步进与解析非法字符。',
  'apps/web/src/components/ui/Modal.tsx': '通用模态框，处理遮罩、ESC 关闭与标题/内容插槽。',
  'apps/web/src/components/ui/PromptModal.tsx': '带文本输入的提示模态框，用于轻量表单确认场景。',
};

const fileTags = {
  'apps/web/src/app/api/dashboard/menu/categories/route.ts': ['api-handler', 'dashboard', 'menu', 'crud'],
  'apps/web/src/app/api/dashboard/menu/items/[id]/image/route.ts': ['api-handler', 'menu', 'image-upload'],
  'apps/web/src/app/api/dashboard/menu/items/route.ts': ['api-handler', 'dashboard', 'menu', 'crud'],
  'apps/web/src/app/api/dashboard/menu/print-stations/route.ts': ['api-handler', 'printing', 'crud'],
  'apps/web/src/app/dashboard/menu/page.tsx': ['entry-point', 'dashboard', 'server-component'],
  'apps/web/src/app/dashboard/tables/page.tsx': ['entry-point', 'dashboard', 'server-component'],
  'apps/web/src/components/dashboard/BuffetSettingsManager.tsx': ['component', 'buffet', 'pricing', 'dashboard'],
  'apps/web/src/components/dashboard/CloseTableSessionAction.tsx': ['component', 'table-session', 'audit'],
  'apps/web/src/components/dashboard/DashboardDatePicker.tsx': ['component', 'date-picker', 'i18n'],
  'apps/web/src/components/dashboard/DishSortOrderButtons.tsx': ['component', 'sort-order', 'menu'],
  'apps/web/src/components/dashboard/MenuManager.tsx': ['component', 'menu-admin', 'dashboard'],
  'apps/web/src/components/dashboard/PrintStationsManager.tsx': ['component', 'printing', 'menu-admin'],
  'apps/web/src/components/dashboard/StaffAccountsManager.tsx': ['component', 'staff', 'auth'],
  'apps/web/src/components/dashboard/TableGroupsManager.tsx': ['component', 'tables', 'groups'],
  'apps/web/src/components/dashboard/TablesManager.tsx': ['component', 'tables', 'dashboard'],
  'apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx': ['component', 'buffet', 'calendar'],
  'apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx': ['component', 'buffet', 'policy'],
  'apps/web/src/components/dashboard/buffet/BuffetPriceMatrix.tsx': ['component', 'buffet', 'pricing'],
  'apps/web/src/components/dashboard/buffet/BuffetPricePreview.tsx': ['component', 'buffet', 'preview'],
  'apps/web/src/components/dashboard/buffet/BuffetRulesToolbar.tsx': ['component', 'buffet', 'toolbar'],
  'apps/web/src/components/dashboard/buffet/BuffetSettingsTabs.tsx': ['component', 'buffet', 'navigation'],
  'apps/web/src/components/dashboard/buffet/BuffetTimeSlotsPanel.tsx': ['component', 'buffet', 'time-slots'],
  'apps/web/src/components/dashboard/buffet/BuffetToolbarSelect.tsx': ['component', 'buffet', 'select'],
  'apps/web/src/components/dashboard/buffet/SlotTimeHmField.tsx': ['component', 'time-input', 'buffet'],
  'apps/web/src/components/dashboard/buffet/buffet-field-styles.ts': ['utility', 'tailwind', 'buffet'],
  'apps/web/src/components/dashboard/settings/SettingsPageHelp.tsx': ['component', 'help', 'settings'],
  'apps/web/src/components/ui/Button.tsx': ['component', 'ui-primitive', 'button'],
  'apps/web/src/components/ui/ConfirmModal.tsx': ['component', 'ui-primitive', 'modal'],
  'apps/web/src/components/ui/DecimalInput.tsx': ['component', 'ui-primitive', 'number-input'],
  'apps/web/src/components/ui/Input.tsx': ['component', 'ui-primitive', 'form'],
  'apps/web/src/components/ui/IntegerInput.tsx': ['component', 'ui-primitive', 'number-input'],
  'apps/web/src/components/ui/Modal.tsx': ['component', 'ui-primitive', 'modal'],
  'apps/web/src/components/ui/PromptModal.tsx': ['component', 'ui-primitive', 'modal'],
};

const fnSummaries = {
  'POST@apps/web/src/app/api/dashboard/menu/categories/route.ts': '创建菜单分类，解析请求体并调用 createMenuCategory。',
  'PATCH@apps/web/src/app/api/dashboard/menu/categories/route.ts': '更新已有分类字段与父级关系。',
  'DELETE@apps/web/src/app/api/dashboard/menu/categories/route.ts': '删除分类，处理子树与占用校验错误。',
  'POST@apps/web/src/app/api/dashboard/menu/items/[id]/image/route.ts': '上传并关联菜品图片到指定菜单项。',
  'POST@apps/web/src/app/api/dashboard/menu/items/route.ts': '创建新菜单菜品记录。',
  'PATCH@apps/web/src/app/api/dashboard/menu/items/route.ts': '更新菜品、批量上下架或移动排序。',
  'DELETE@apps/web/src/app/api/dashboard/menu/items/route.ts': '删除单个菜单菜品。',
  'POST@apps/web/src/app/api/dashboard/menu/print-stations/route.ts': '创建打印档口记录。',
  'PATCH@apps/web/src/app/api/dashboard/menu/print-stations/route.ts': '更新档口或调整排序位置。',
  'DELETE@apps/web/src/app/api/dashboard/menu/print-stations/route.ts': '删除打印档口。',
  'MenuPage@apps/web/src/app/dashboard/menu/page.tsx': '服务端页面组件，加载菜单数据并传递初始 Tab 偏好。',
  'TablesPage@apps/web/src/app/dashboard/tables/page.tsx': '服务端桌台页，加载前台桌台列表与分组数据。',
  'buildRuleDraft@apps/web/src/components/dashboard/BuffetSettingsManager.tsx': '将数据库规则行转换为可编辑草稿对象。',
  'ruleToDraft@apps/web/src/components/dashboard/BuffetSettingsManager.tsx': '规则实体到表单单据的字段映射。',
  'BuffetSettingsManager@apps/web/src/components/dashboard/BuffetSettingsManager.tsx': '自助餐设置主组件，协调 CRUD 客户端调用与各子面板状态。',
  'CloseTableSessionAction@apps/web/src/components/dashboard/CloseTableSessionAction.tsx': '发起关闭桌台会话请求并处理确认与 Toast 反馈。',
  'computePopupCoords@apps/web/src/components/dashboard/DashboardDatePicker.tsx': '根据触发元素与视口计算日历弹出坐标。',
  'DashboardDatePicker@apps/web/src/components/dashboard/DashboardDatePicker.tsx': '可访问的日期选择 UI，管理打开状态与选中值。',
  'DishSortOrderButtons@apps/web/src/components/dashboard/DishSortOrderButtons.tsx': '渲染上移/下移按钮并禁用边界项。',
  'MenuManager@apps/web/src/components/dashboard/MenuManager.tsx': '菜单管理核心逻辑，处理分类树、菜品表单与 API 客户端调用。',
  'PrintStationsManager@apps/web/src/components/dashboard/PrintStationsManager.tsx': '档口列表 CRUD 与排序 UI。',
  'errorMessage@apps/web/src/components/dashboard/StaffAccountsManager.tsx': '将 API/校验错误映射为本地化提示文案。',
  'StaffAccountsManager@apps/web/src/components/dashboard/StaffAccountsManager.tsx': '员工账号列表与创建/编辑模态流程。',
  'TableGroupsManager@apps/web/src/components/dashboard/TableGroupsManager.tsx': '分组 CRUD 与桌台多选分配界面。',
  'requestDashboardTables@apps/web/src/components/dashboard/TablesManager.tsx': '通过 Supabase 拉取最新桌台与分组数据。',
  'TablesManager@apps/web/src/components/dashboard/TablesManager.tsx': '桌台管理 Tab 容器，整合列表、分组与批量操作。',
  'BuffetCalendarPanel@apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx': '日历例外增删与日期范围冲突提示。',
  'BuffetFridayWeekendPanel@apps/web/src/components/dashboard/buffet/BuffetFridayWeekendPanel.tsx': '周五周末策略表单与保存回调。',
  'pickBestRule@apps/web/src/components/dashboard/buffet/BuffetPriceMatrix.tsx': '在给定 day_kind 下选取优先级最高的生效规则。',
  'BuffetPriceMatrix@apps/web/src/components/dashboard/buffet/BuffetPriceMatrix.tsx': '渲染价格矩阵表格与单元格编辑。',
  'BuffetPricePreview@apps/web/src/components/dashboard/buffet/BuffetPricePreview.tsx': '模拟指定日期时间的自助餐生效价格与规则详情。',
  'BuffetRulesToolbar@apps/web/src/components/dashboard/buffet/BuffetRulesToolbar.tsx': '规则筛选、激活切换与新建按钮区。',
  'BuffetSettingsTabs@apps/web/src/components/dashboard/buffet/BuffetSettingsTabs.tsx': '自助餐设置各子 Tab 的导航条。',
  'BuffetTimeSlotsPanel@apps/web/src/components/dashboard/buffet/BuffetTimeSlotsPanel.tsx': '时段行编辑网格与增删时段。',
  'BuffetToolbarSelect@apps/web/src/components/dashboard/buffet/BuffetToolbarSelect.tsx': '带 chip 样式的工具栏下拉选择。',
  'SlotTimeHmField@apps/web/src/components/dashboard/buffet/SlotTimeHmField.tsx': 'labeled 时分字段，桥接 TimeHmInput。',
  'buffetSegmentBtnClass@apps/web/src/components/dashboard/buffet/buffet-field-styles.ts': '生成分段切换按钮的 Tailwind class 字符串。',
  'HelpIcon@apps/web/src/components/dashboard/settings/SettingsPageHelp.tsx': '渲染帮助问号图标按钮。',
  'SettingsPageHelp@apps/web/src/components/dashboard/settings/SettingsPageHelp.tsx': '打开帮助 Modal 并注入页面说明子内容。',
  'buttonClasses@apps/web/src/components/ui/Button.tsx': '根据 variant/size 组合按钮 Tailwind 类名。',
  'ButtonLink@apps/web/src/components/ui/Button.tsx': '样式与 Button 一致的 Next.js Link 封装。',
  'ConfirmModal@apps/web/src/components/ui/ConfirmModal.tsx': '展示确认文案并回调 onConfirm/onCancel。',
  'DecimalInput@apps/web/src/components/ui/DecimalInput.tsx': '受控小数输入，失焦时规范化数值。',
  'IntegerInput@apps/web/src/components/ui/IntegerInput.tsx': '受控整数输入，过滤非数字字符。',
  'Modal@apps/web/src/components/ui/Modal.tsx': '模态层渲染、焦点陷阱与关闭处理。',
  'PromptModal@apps/web/src/components/ui/PromptModal.tsx': '带单行输入的确认对话框。',
};

function complexity(nonEmpty, fnCount) {
  if (nonEmpty > 200 || fnCount > 2) return 'complex';
  if (nonEmpty > 50) return 'moderate';
  return 'simple';
}

function isSignificant(fn, exports, filePath) {
  const lines = fn.endLine - fn.startLine + 1;
  const exported = exports.some((e) => e.name === fn.name);
  if (exported) return lines >= 10 || fn.name.match(/^(POST|PATCH|DELETE|GET)$/);
  return lines >= 10;
}

const nodes = [];
const edges = [];
const fnNodeIds = new Set();
const filePaths = extract.results.map((r) => r.path).sort();

// Manual supplement for forwardRef component missed by tree-sitter
const manualFns = {
  'apps/web/src/components/dashboard/buffet/BuffetPricePreview.tsx': [
    { name: 'BuffetPricePreview', startLine: 47, endLine: 250, exported: true },
  ],
};

for (const r of extract.results) {
  const fp = r.path;
  const name = path.basename(fp);
  nodes.push({
    id: `file:${fp}`,
    type: 'file',
    name,
    filePath: fp,
    summary: fileSummaries[fp],
    tags: fileTags[fp],
    complexity: complexity(r.nonEmptyLines, r.functions?.length || 0),
  });

  const exports = r.exports || [];
  const fns = [...(r.functions || []), ...(manualFns[fp] || [])];

  for (const fn of fns) {
    if (!isSignificant(fn, exports, fp) && !(manualFns[fp]?.some((m) => m.name === fn.name))) continue;
    const id = `function:${fp}:${fn.name}`;
    fnNodeIds.add(id);
    const key = `${fn.name}@${fp}`;
    nodes.push({
      id,
      type: 'function',
      name: fn.name,
      filePath: fp,
      lineRange: [fn.startLine, fn.endLine],
      summary: fnSummaries[key] || `${fn.name} 函数实现。`,
      tags: fp.includes('/api/')
        ? ['api-handler', 'route-handler', 'dashboard']
        : fp.includes('/ui/')
          ? ['component', 'ui-primitive', 'form']
          : fp.includes('/buffet/')
            ? ['component', 'buffet', 'dashboard']
            : ['component', 'dashboard', 'react'],
      complexity: fn.endLine - fn.startLine + 1 > 100 ? 'complex' : fn.endLine - fn.startLine + 1 > 30 ? 'moderate' : 'simple',
    });
    edges.push({ source: `file:${fp}`, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exports.some((e) => e.name === fn.name)) {
      edges.push({ source: `file:${fp}`, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

// Import edges (all)
for (const [fp, imports] of Object.entries(input.batchImportData)) {
  for (const imp of imports) {
    edges.push({ source: `file:${fp}`, target: `file:${imp}`, type: 'imports', direction: 'forward', weight: 0.7 });
  }
}

// Build symbol lookup for calls
const batchFnByName = new Map();
for (const r of extract.results) {
  for (const fn of r.functions || []) {
    batchFnByName.set(`${r.path}:${fn.name}`, `function:${r.path}:${fn.name}`);
  }
}
for (const [fp, fns] of Object.entries(manualFns)) {
  for (const fn of fns) batchFnByName.set(`${fp}:${fn.name}`, `function:${fp}:${fn.name}`);
}

const neighborSymbolToTarget = new Map();
for (const [fp, neighbors] of Object.entries(neighborMap)) {
  for (const n of neighbors) {
    for (const sym of n.symbols) {
      neighborSymbolToTarget.set(`${fp}:${sym}`, `function:${n.path}:${sym}`);
    }
  }
}

// Full neighbor map from prompt for all files
const fullNeighborMap = JSON.parse(fs.readFileSync(path.join(ROOT, '.understand-anything/tmp/batch-prompts/batch-1.txt'), 'utf8').split('Cross-batch neighbors:')[1].split('Files:')[0].replace('```json', '').replace('```', '').trim());
for (const [fp, neighbors] of Object.entries(fullNeighborMap)) {
  for (const n of neighbors) {
    for (const sym of n.symbols) {
      neighborSymbolToTarget.set(`${fp}:${sym}`, `function:${n.path}:${sym}`);
    }
  }
}

const callEdgeKeys = new Set();
for (const r of extract.results) {
  const fp = r.path;
  for (const cg of r.callGraph || []) {
    const callerId = `function:${fp}:${cg.caller}`;
    if (!fnNodeIds.has(callerId)) continue;
    let target = batchFnByName.get(`${fp}:${cg.callee}`);
    if (!target) target = neighborSymbolToTarget.get(`${fp}:${cg.callee}`);
    if (!target) continue;
    const key = `${callerId}->${target}`;
    if (callEdgeKeys.has(key)) continue;
    callEdgeKeys.add(key);
    edges.push({ source: callerId, target, type: 'calls', direction: 'forward', weight: 0.8 });
  }
}

// depends_on for pages -> managers
edges.push({ source: 'file:apps/web/src/app/dashboard/menu/page.tsx', target: 'file:apps/web/src/components/dashboard/MenuManager.tsx', type: 'depends_on', direction: 'forward', weight: 0.6 });
edges.push({ source: 'file:apps/web/src/app/dashboard/tables/page.tsx', target: 'file:apps/web/src/components/dashboard/TablesManager.tsx', type: 'depends_on', direction: 'forward', weight: 0.6 });
edges.push({ source: 'file:apps/web/src/components/dashboard/BuffetSettingsManager.tsx', target: 'file:apps/web/src/components/dashboard/buffet/BuffetCalendarPanel.tsx', type: 'depends_on', direction: 'forward', weight: 0.6 });
edges.push({ source: 'file:apps/web/src/components/dashboard/MenuManager.tsx', target: 'file:apps/web/src/components/dashboard/PrintStationsManager.tsx', type: 'depends_on', direction: 'forward', weight: 0.6 });
edges.push({ source: 'file:apps/web/src/components/dashboard/TablesManager.tsx', target: 'file:apps/web/src/components/dashboard/TableGroupsManager.tsx', type: 'depends_on', direction: 'forward', weight: 0.6 });

const nodeCount = nodes.length;
const edgeCount = edges.length;
const parts = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
const outDir = path.join(ROOT, '.understand-anything/intermediate');

if (parts <= 1) {
  fs.writeFileSync(path.join(outDir, 'batch-1.json'), JSON.stringify({ nodes, edges }, null, 0));
  console.log(JSON.stringify({ parts: 1, nodes: nodeCount, edges: edgeCount, importEdges: Object.values(input.batchImportData).flat().length }));
} else {
  const chunkSize = Math.ceil(filePaths.length / parts);
  let totalN = 0, totalE = 0;
  for (let p = 0; p < parts; p++) {
    const chunkFiles = new Set(filePaths.slice(p * chunkSize, (p + 1) * chunkSize));
    const chunkNodeIds = new Set(nodes.filter((n) => !n.filePath || chunkFiles.has(n.filePath)).map((n) => n.id));
    const chunkNodes = nodes.filter((n) => chunkNodeIds.has(n.id));
    const chunkEdges = edges.filter((e) => chunkNodeIds.has(e.source));
    totalN += chunkNodes.length;
    totalE += chunkEdges.length;
    fs.writeFileSync(path.join(outDir, `batch-1-part-${p + 1}.json`), JSON.stringify({ nodes: chunkNodes, edges: chunkEdges }, null, 0));
  }
  console.log(JSON.stringify({ parts, nodes: totalN, edges: totalE, importEdges: Object.values(input.batchImportData).flat().length }));
}
