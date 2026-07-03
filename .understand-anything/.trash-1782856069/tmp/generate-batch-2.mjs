import { readFileSync, writeFileSync } from 'fs';

const PROJECT = '/Users/chenjianping/Documents/restaurant-ordering';
const extract = JSON.parse(readFileSync(`${PROJECT}/.understand-anything/tmp/ua-file-extract-results-2.json`, 'utf8'));
const batchImportData = JSON.parse(readFileSync(`${PROJECT}/.understand-anything/tmp/ua-file-analyzer-input-2.json`, 'utf8')).batchImportData;

const fileSummaries = {
  'apps/web/src/components/ui/ReasonConfirmDialog.tsx': { summary: '可复用的原因确认对话框，支持作废、未结账关台等异常操作场景，集成预设原因列表与详情校验。', tags: ['component', 'validation', 'dialog', 'audit'], complexity: 'moderate' },
  'apps/web/src/components/ui/TimeHmInput.tsx': { summary: '时:分格式输入组件，用于自助餐时段等场景，封装数字格式化与失焦规范化逻辑。', tags: ['component', 'time-input', 'buffet', 'form'], complexity: 'moderate' },
  'apps/web/src/components/ui/Toast.tsx': { summary: '全局 Toast 通知系统，提供 showToast API 与 ToastContainer 挂载点，供各页面展示操作反馈。', tags: ['component', 'notification', 'singleton', 'ui'], complexity: 'moderate' },
  'apps/web/src/components/waiter/waiter-table-detail-ui.test.ts': { summary: '服务员桌台详情 UI 辅助函数的单元测试，验证布局类名与按钮样式约定。', tags: ['test', 'waiter', 'ui'], complexity: 'simple' },
  'apps/web/src/components/waiter/waiter-table-detail-ui.tsx': { summary: '服务员桌台详情页的 UI 原语：卡片、主次按钮、自助餐条带等，统一视觉与间距规范。', tags: ['component', 'waiter', 'layout', 'ui'], complexity: 'moderate' },
  'apps/web/src/components/waiter/waiter-ui.ts': { summary: '服务员界面共享样式常量与 Tailwind 类名集合，供桌台详情等组件复用。', tags: ['utility', 'waiter', 'styling'], complexity: 'simple' },
  'apps/web/src/lib/buffet-pricing-admin.ts': { summary: '自助餐定价规则管理工具库，处理日期类型判定、时段转换、规则重叠检测与里斯本时区换算。', tags: ['service', 'buffet', 'pricing', 'utility'], complexity: 'complex' },
  'apps/web/src/lib/dashboard-menu-api.ts': { summary: '仪表盘菜单 API 路由的共享辅助：错误封装、JSON 解析与可写权限上下文加载。', tags: ['api-handler', 'dashboard', 'menu'], complexity: 'simple' },
  'apps/web/src/lib/dashboard-menu-client.ts': { summary: '菜单管理前端 API 客户端，封装分类、菜品、打印站点的 CRUD 与排序请求及错误映射。', tags: ['service', 'dashboard', 'menu', 'client'], complexity: 'complex' },
  'apps/web/src/lib/dashboard-menu-server.ts': { summary: '菜单管理服务端核心逻辑，实现分类/菜品/打印站点的数据库操作、图片上传与排序持久化。', tags: ['service', 'dashboard', 'menu', 'data-model'], complexity: 'complex' },
  'apps/web/src/lib/dashboard-menu.test.ts': { summary: '仪表盘菜单客户端与服务端逻辑的集成测试，覆盖分类与菜品 CRUD 流程。', tags: ['test', 'dashboard', 'menu'], complexity: 'moderate' },
  'apps/web/src/lib/dashboard-menu.ts': { summary: '仪表盘菜单页数据加载器，按权限拉取分类、菜品与打印站点列表供 SSR 渲染。', tags: ['service', 'dashboard', 'menu', 'data-loader'], complexity: 'moderate' },
  'apps/web/src/lib/dashboard-table-groups-client.ts': { summary: '桌台分组管理的前端 API 客户端，处理分组 CRUD、排序与错误消息映射。', tags: ['service', 'dashboard', 'tables', 'client'], complexity: 'moderate' },
  'apps/web/src/lib/menu-admin.ts': { summary: '菜单管理 UI 辅助函数：分类标签、搜索过滤、子树收集与打印小票编码预览。', tags: ['utility', 'menu', 'dashboard'], complexity: 'moderate' },
  'apps/web/src/lib/menu-code-uniqueness.ts': { summary: '菜单分类与菜品编码唯一性校验，检测同级重复并识别 Postgres 唯一约束冲突。', tags: ['validation', 'menu', 'utility'], complexity: 'simple' },
  'apps/web/src/lib/menu-image.ts': { summary: '菜品图片上传工具：MIME 校验、压缩、Storage 路径生成与删除。', tags: ['utility', 'menu', 'storage', 'image'], complexity: 'moderate' },
  'apps/web/src/lib/menu-item-order.test.ts': { summary: '菜品排序作用域与显示比较逻辑的单元测试。', tags: ['test', 'menu', 'sort-order'], complexity: 'simple' },
  'apps/web/src/lib/menu-item-order.ts': { summary: '菜品排序作用域与可见项重排判断，结合 sort_order 实现分类内排序。', tags: ['utility', 'menu', 'sort-order'], complexity: 'simple' },
  'apps/web/src/lib/menu-manager-tab-preference.test.ts': { summary: '菜单管理器 Tab 偏好 localStorage 读写行为的单元测试。', tags: ['test', 'menu', 'preference'], complexity: 'simple' },
  'apps/web/src/lib/menu-manager-tab-preference.ts': { summary: '菜单管理器 Tab 偏好持久化，通过 localStorage 与 URL 查询参数同步当前标签页。', tags: ['utility', 'menu', 'preference'], complexity: 'simple' },
  'apps/web/src/lib/menu-print-label.test.ts': { summary: '菜单打印标签格式化函数的单元测试，覆盖编码路径与小票行标签。', tags: ['test', 'menu', 'printing'], complexity: 'simple' },
  'apps/web/src/lib/menu-print-label.ts': { summary: '菜单打印标签格式化：菜品编码规范化、分类路径、小票行标签与厨房票头。', tags: ['utility', 'menu', 'printing'], complexity: 'moderate' },
  'apps/web/src/lib/menu-vat-rate.test.ts': { summary: '菜品增值税率解析与规范化函数的单元测试。', tags: ['test', 'menu', 'vat'], complexity: 'simple' },
  'apps/web/src/lib/menu-vat-rate.ts': { summary: '菜品增值税率常量与解析工具，校验并规范化允许的税率选项。', tags: ['utility', 'menu', 'vat'], complexity: 'simple' },
  'apps/web/src/lib/number-input.test.ts': { summary: '数字与时:分输入格式化/解析函数的单元测试。', tags: ['test', 'utility', 'validation'], complexity: 'simple' },
  'apps/web/src/lib/number-input.ts': { summary: '通用数字输入工具：时:分格式化、非负整数与小数输入的规范化与解析。', tags: ['utility', 'validation', 'form'], complexity: 'moderate' },
  'apps/web/src/lib/print-station-admin.ts': { summary: '打印站点管理辅助：显示名称获取与绑定计数。', tags: ['utility', 'printing', 'dashboard'], complexity: 'simple' },
  'apps/web/src/lib/print-station-resolve.ts': { summary: '解析菜品有效打印站点 ID，处理默认站点与分类继承逻辑。', tags: ['utility', 'printing', 'menu'], complexity: 'simple' },
  'apps/web/src/lib/sort-order-persist.ts': { summary: '菜单菜品 sort_order 相邻交换的数据库持久化，批量更新两条记录。', tags: ['utility', 'sort-order', 'database'], complexity: 'moderate' },
  'apps/web/src/lib/sort-order.test.ts': { summary: 'sort_order 比较、交换与相邻步骤算法的单元测试。', tags: ['test', 'sort-order', 'utility'], complexity: 'moderate' },
  'apps/web/src/lib/sort-order.ts': { summary: '通用 sort_order 工具：比较、排序、相邻交换步骤计算与应用。', tags: ['utility', 'sort-order', 'algorithm'], complexity: 'moderate' },
  'apps/web/src/lib/tables-manager-tab-preference.ts': { summary: '桌台管理器 Tab 偏好持久化，通过 localStorage 保存当前标签页状态。', tags: ['utility', 'tables', 'preference'], complexity: 'simple' },
};

const fnSummaries = {
  'ReasonConfirmDialog': '渲染带原因选择与可选详情的确认模态框，提交前校验必填项。',
  'TimeHmInput': '带标签的时:分输入框，输入时自动格式化并在失焦时规范化。',
  'Toast': '单条 Toast 消息展示组件，支持类型与自动消失。',
  'showToast': '全局触发 Toast 通知的 imperative API。',
  'ToastContainer': '挂载所有活跃 Toast 的容器组件，通常放在根布局。',
  'buffetStripSectionClass': '生成自助餐信息条带的 Tailwind 类名。',
  'WaiterDetailCard': '服务员详情页卡片容器组件。',
  'WaiterTablePrimaryButton': '服务员桌台详情主操作按钮。',
  'WaiterTablePrimaryLink': '服务员桌台详情主操作链接样式。',
  'WaiterTableSecondaryButton': '服务员桌台详情次要操作按钮。',
  'getDayKindForDate': '根据日期判定自助餐日历日类型（工作日/周末/节假日等）。',
  'getDayKindForDateTime': '结合日期时间与规则列表判定日类型。',
  'dbTimeToHm': '将数据库 TIME 格式转换为 HH:mm 显示字符串。',
  'hmToDbTime': '将 HH:mm 字符串转换为数据库 TIME 格式。',
  'ruleCoversDate': '判断定价规则是否覆盖指定日期。',
  'hasActiveRuleForDayKind': '检查某日历日类型是否存在生效规则。',
  'datesInRangeInclusive': '生成含首尾的日期范围 ISO 列表。',
  'rangesOverlap': '判断两个日期区间是否重叠。',
  'findOverlappingRules': '查找与给定区间重叠的定价规则。',
  'getRuleStatus': '根据起止日期计算规则当前状态（未生效/生效中/已过期）。',
  'lisbonWallTimeToUtcIso': '将里斯本墙钟时间转换为 UTC ISO 字符串。',
  'todayIsoLocal': '返回本地时区今日 ISO 日期字符串。',
  'nowTimeHmLocal': '返回本地当前时间的 HH:mm 字符串。',
  'menuApiError': '构造菜单 API 标准错误响应对象。',
  'loadWritableMenuContext': '加载具备菜单写权限的仪表盘上下文。',
  'request': '封装 fetch 请求并处理 JSON 响应与错误。',
  'mapMenuCategoryApiError': '将分类 API 错误码映射为用户可读消息。',
  'mapMenuItemApiError': '将菜品 API 错误码映射为用户可读消息。',
  'createMenuCategoryClient': '客户端创建菜单分类 API 调用。',
  'updateMenuCategoryClient': '客户端更新菜单分类 API 调用。',
  'deleteMenuCategoryClient': '客户端删除菜单分类 API 调用。',
  'createMenuItemClient': '客户端创建菜品 API 调用。',
  'updateMenuItemClient': '客户端更新菜品 API 调用。',
  'deleteMenuItemClient': '客户端删除菜品 API 调用。',
  'batchSetMenuItemsAvailableClient': '客户端批量设置菜品上下架状态。',
  'moveMenuItemOrderClient': '客户端移动菜品排序位置。',
  'setMenuItemImageClient': '客户端上传菜品图片。',
  'createPrintStationClient': '客户端创建打印站点。',
  'updatePrintStationClient': '客户端更新打印站点。',
  'movePrintStationOrderClient': '客户端移动打印站点排序。',
  'deletePrintStationClient': '客户端删除打印站点。',
  'loadActiveCategories': '从数据库加载餐厅活跃菜单分类列表。',
  'loadMenuItems': '从数据库加载餐厅菜品列表。',
  'getCategoryById': '按 ID 查询单个菜单分类。',
  'createMenuCategory': '服务端创建菜单分类并处理编码唯一性。',
  'updateMenuCategory': '服务端更新菜单分类属性。',
  'deleteMenuCategory': '服务端删除菜单分类并处理子分类与菜品。',
  'validateMenuItemInput': '校验菜品创建/更新输入字段。',
  'buildMenuItemPayload': '将校验后的输入构建为数据库写入载荷。',
  'createMenuItem': '服务端创建菜品记录。',
  'moveMenuItemOrder': '服务端交换相邻菜品 sort_order。',
  'updateMenuItem': '服务端更新菜品属性。',
  'deleteMenuItem': '服务端删除菜品记录。',
  'batchSetMenuItemsAvailable': '服务端批量更新菜品可用状态。',
  'setMenuItemImage': '服务端处理菜品图片上传至 Storage。',
  'createPrintStation': '服务端创建打印站点记录。',
  'updatePrintStation': '服务端更新打印站点配置。',
  'movePrintStationOrder': '服务端交换相邻打印站点排序。',
  'deletePrintStation': '服务端删除打印站点。',
  'parseCategoryBody': '解析分类 API 请求体字段。',
  'parseCategoryParentId': '解析分类父级 ID 参数。',
  'parsePrintStationBody': '解析打印站点 API 请求体。',
  'parseMenuItemBody': '解析菜品 API 请求体字段。',
  'loadDashboardMenu': 'SSR 加载菜单页所需的分类、菜品与打印站点数据。',
  'createTableGroupClient': '客户端创建桌台分组。',
  'updateTableGroupClient': '客户端更新桌台分组。',
  'moveTableGroupOrderClient': '客户端移动桌台分组排序。',
  'deleteTableGroupClient': '客户端删除桌台分组。',
  'mapTableGroupApiError': '将桌台分组 API 错误映射为用户消息。',
  'getMenuCategoryLabel': '获取分类在当前语言下的显示标签。',
  'getMenuItemDisplayName': '获取菜品在当前语言下的显示名称。',
  'categoryTicketCodePreview': '预览分类在厨房小票上的编码路径。',
  'collectCategorySubtreeIds': '收集分类及其所有后代 ID。',
  'categoryHasDescendants': '判断分类是否有子分类。',
  'sortCategoryIdsLeavesFirst': '将分类 ID 按叶子优先顺序排序。',
  'itemMatchesSearch': '判断菜品是否匹配搜索关键词。',
  'menuCodeKey': '生成分类/菜品编码的唯一性比较键。',
  'siblingCategoryHasDuplicateCode': '检测同级分类编码是否重复。',
  'menuItemHasDuplicateCode': '检测菜品编码是否在餐厅内重复。',
  'isPostgresUniqueViolation': '判断错误是否为 Postgres 唯一约束冲突。',
  'extensionForImageMime': '根据 MIME 类型返回图片文件扩展名。',
  'menuImageObjectPath': '生成菜品图片在 Storage 中的对象路径。',
  'validateMenuImageFile': '校验上传图片的文件大小与类型。',
  'compressMenuImageForUpload': '压缩图片至允许大小后返回 Blob。',
  'pathFromMenuImagePublicUrl': '从公开 URL 提取 Storage 对象路径。',
  'removeMenuImageFromStorage': '从 Storage 删除菜品图片对象。',
  'menuItemSortScope': '计算菜品排序的作用域键（分类 ID）。',
  'canReorderVisibleMenuItems': '判断当前可见菜品列表是否可重排。',
  'compareMenuItemsForDisplay': '比较两个菜品的显示排序顺序。',
  'menuItemSiblingsInScope': '获取同作用域内的兄弟菜品列表。',
  'menuManagerTabStorageKey': '生成菜单管理器 Tab 的 localStorage 键名。',
  'isMenuManagerTab': '判断字符串是否为有效的菜单管理器 Tab。',
  'loadSavedMenuManagerTab': '从 localStorage 读取保存的 Tab 偏好。',
  'saveMenuManagerTab': '将当前 Tab 保存至 localStorage。',
  'menuManagerTabQuery': '生成 Tab 对应的 URL 查询参数字符串。',
  'menuManagerPath': '生成带 Tab 查询参数的菜单管理路径。',
  'normalizeMenuItemCode': '规范化菜品编码（去空格、大写等）。',
  'categoryCodePathFromLeaf': '从叶子分类向上构建编码路径。',
  'formatMenuPrintDisplayName': '格式化菜品在打印输出中的显示名。',
  'orderItemBaseName': '提取订单项的基础名称（不含备注）。',
  'orderItemReceiptLineLabel': '生成订单项在小票行上的完整标签。',
  'topLevelCategoryId': '查找菜品所属顶级分类 ID。',
  'formatTopCategoryTicketHeader': '格式化厨房票顶部类目标题行。',
  'parseMenuVatRate': '解析并校验菜品增值税率输入。',
  'normalizeMenuVatRate': '将税率规范化为允许值或默认值。',
  'isAllowedMenuVatRate': '判断税率是否在允许列表中。',
  'formatHmDigitsWhileTyping': '输入过程中实时格式化时:分数字。',
  'normalizeHmFromDigits': '从纯数字字符串规范化为 HH:mm。',
  'normalizeHmInput': '规范化时:分输入值，处理不完整输入。',
  'parseNonNegativeInt': '解析非负整数字符串。',
  'normalizeDecimalInput': '规范化小数输入字符串。',
  'parseDecimalInput': '解析小数字符串为数值。',
  'formatDecimalInputValue': '格式化小数为输入框显示值。',
  'getPrintStationDisplayName': '获取打印站点在当前语言下的显示名。',
  'countPrintStationBindings': '统计打印站点绑定的分类/菜品数量。',
  'resolveEffectivePrintStationId': '解析菜品最终生效的打印站点 ID。',
  'persistMenuItemSortOrderSwap': '将相邻菜品 sort_order 交换持久化到数据库。',
  'nextSortOrder': '计算新记录的下一个 sort_order 值。',
  'compareSortOrder': '比较两个 sort_order 值。',
  'compareSortOrderThenCreatedAt': '先比 sort_order 再比创建时间。',
  'sortBySortOrderThenCreatedAt': '按 sort_order 与创建时间排序数组。',
  'swapAdjacentSortOrders': '交换相邻两项的 sort_order 值。',
  'adjacentSortOrderSwapSteps': '计算将项移到目标位置所需的相邻交换步骤。',
  'applyAdjacentSortOrderSwap': '按步骤依次应用相邻 sort_order 交换。',
  'tablesManagerTabStorageKey': '生成桌台管理器 Tab 的 localStorage 键名。',
  'isTablesManagerTab': '判断字符串是否为有效桌台管理器 Tab。',
  'parseTablesManagerTab': '解析并校验桌台管理器 Tab 值。',
  'loadSavedTablesManagerTab': '从 localStorage 读取桌台管理器 Tab 偏好。',
  'saveTablesManagerTab': '保存桌台管理器 Tab 至 localStorage。',
  'tablesManagerPath': '生成带 Tab 参数的桌台管理路径。',
};

const testTargets = {
  'apps/web/src/components/waiter/waiter-table-detail-ui.test.ts': 'apps/web/src/components/waiter/waiter-table-detail-ui.tsx',
  'apps/web/src/lib/dashboard-menu.test.ts': ['apps/web/src/lib/dashboard-menu-client.ts', 'apps/web/src/lib/dashboard-menu-server.ts'],
  'apps/web/src/lib/menu-item-order.test.ts': 'apps/web/src/lib/menu-item-order.ts',
  'apps/web/src/lib/menu-manager-tab-preference.test.ts': 'apps/web/src/lib/menu-manager-tab-preference.ts',
  'apps/web/src/lib/menu-print-label.test.ts': 'apps/web/src/lib/menu-print-label.ts',
  'apps/web/src/lib/menu-vat-rate.test.ts': 'apps/web/src/lib/menu-vat-rate.ts',
  'apps/web/src/lib/number-input.test.ts': 'apps/web/src/lib/number-input.ts',
  'apps/web/src/lib/sort-order.test.ts': 'apps/web/src/lib/sort-order.ts',
};

const callEdges = [
  ['apps/web/src/components/ui/ReasonConfirmDialog.tsx', 'ReasonConfirmDialog', 'function:apps/web/src/lib/audit/reasons.ts:requiresAbnormalReasonDetail'],
  ['apps/web/src/components/ui/TimeHmInput.tsx', 'TimeHmInput', 'function:apps/web/src/lib/number-input.ts:normalizeHmInput'],
  ['apps/web/src/components/ui/TimeHmInput.tsx', 'TimeHmInput', 'function:apps/web/src/lib/number-input.ts:formatHmDigitsWhileTyping'],
  ['apps/web/src/lib/buffet-pricing-admin.ts', 'hmToDbTime', 'function:apps/web/src/lib/number-input.ts:normalizeHmInput'],
  ['apps/web/src/lib/dashboard-menu-server.ts', 'moveMenuItemOrder', 'function:apps/web/src/lib/sort-order-persist.ts:persistMenuItemSortOrderSwap'],
  ['apps/web/src/lib/dashboard-menu-server.ts', 'movePrintStationOrder', 'function:apps/web/src/lib/sort-order.ts:applyAdjacentSortOrderSwap'],
  ['apps/web/src/lib/dashboard-menu-server.ts', 'createMenuItem', 'function:apps/web/src/lib/menu-code-uniqueness.ts:menuItemHasDuplicateCode'],
  ['apps/web/src/lib/dashboard-menu-server.ts', 'setMenuItemImage', 'function:apps/web/src/lib/menu-image.ts:compressMenuImageForUpload'],
  ['apps/web/src/lib/menu-item-order.ts', 'compareMenuItemsForDisplay', 'function:apps/web/src/lib/sort-order.ts:compareSortOrderThenCreatedAt'],
  ['apps/web/src/lib/sort-order-persist.ts', 'persistMenuItemSortOrderSwap', 'function:apps/web/src/lib/sort-order.ts:swapAdjacentSortOrders'],
];

const nodes = [];
const edges = [];

function fileId(p) { return `file:${p}`; }
function fnId(p, n) { return `function:${p}:${n}`; }

function isSignificant(r, f) {
  const lines = f.endLine - f.startLine + 1;
  const exported = (r.exports || []).some(e => e.name === f.name);
  return lines >= 10 || exported;
}

for (const r of extract.results) {
  const meta = fileSummaries[r.path];
  const fileNode = {
    id: fileId(r.path),
    type: 'file',
    name: r.path.split('/').pop(),
    filePath: r.path,
    summary: meta.summary,
    tags: meta.tags,
    complexity: meta.complexity,
  };
  const langNotes = {
    'apps/web/src/lib/dashboard-menu-server.ts': '服务端菜单 CRUD 集中于此，通过 Supabase service role 操作并协调图片 Storage 与 sort_order 持久化。',
    'apps/web/src/lib/buffet-pricing-admin.ts': '大量使用 Europe/Lisbon 时区进行墙钟与 UTC 转换，适配葡萄牙自助餐定价场景。',
    'apps/web/src/components/ui/Toast.tsx': '采用模块级状态 + 订阅模式实现全局 Toast，无需 React Context。',
  };
  if (langNotes[r.path]) fileNode.languageNotes = langNotes[r.path];
  nodes.push(fileNode);

  for (const imp of (batchImportData[r.path] || [])) {
    edges.push({ source: fileId(r.path), target: fileId(imp), type: 'imports', direction: 'forward', weight: 0.7 });
  }

  const fns = r.functions || [];
  for (const f of fns) {
    if (!isSignificant(r, f)) continue;
    const lines = f.endLine - f.startLine + 1;
    const isComponent = r.path.includes('/components/') && !r.path.includes('.test.');
    const isTest = r.path.includes('.test.');
    const fnTags = isTest ? ['test'] : isComponent
      ? (f.name.match(/^(show|Toast)/) ? ['component', 'notification'] : ['component', 'ui'])
      : (f.name.includes('Client') ? ['service', 'client'] : f.name.includes('parse') || f.name.includes('validate') ? ['validation', 'utility'] : ['utility']);
    nodes.push({
      id: fnId(r.path, f.name),
      type: 'function',
      name: f.name,
      filePath: r.path,
      lineRange: [f.startLine, f.endLine],
      summary: fnSummaries[f.name] || `${f.name} 函数`,
      tags: fnTags,
      complexity: lines > 50 ? 'complex' : lines > 20 ? 'moderate' : 'simple',
    });
    edges.push({ source: fileId(r.path), target: fnId(r.path, f.name), type: 'contains', direction: 'forward', weight: 1.0 });
    const exported = (r.exports || []).some(e => e.name === f.name);
    if (exported) {
      edges.push({ source: fileId(r.path), target: fnId(r.path, f.name), type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

for (const [testPath, targets] of Object.entries(testTargets)) {
  const list = Array.isArray(targets) ? targets : [targets];
  for (const t of list) {
    edges.push({ source: fileId(t), target: fileId(testPath), type: 'tested_by', direction: 'forward', weight: 0.5 });
  }
}

for (const [src, fn, tgt] of callEdges) {
  edges.push({ source: fnId(src, fn), target: tgt, type: 'calls', direction: 'forward', weight: 0.8 });
}

// Split by file path alphabetically
const files = extract.results.map(r => r.path).sort();
const nodeCount = nodes.length;
const edgeCount = edges.length;
const parts = Math.max(Math.ceil(nodeCount / 60), Math.ceil(edgeCount / 120));
const chunkSize = Math.ceil(files.length / parts);

const outDir = `${PROJECT}/.understand-anything/intermediate`;
let totalNodes = 0, totalEdges = 0;

for (let pi = 0; pi < parts; pi++) {
  const chunkFiles = new Set(files.slice(pi * chunkSize, (pi + 1) * chunkSize));
  const chunkNodeIds = new Set(nodes.filter(n => !n.filePath || chunkFiles.has(n.filePath)).map(n => n.id));
  const partNodes = nodes.filter(n => chunkNodeIds.has(n.id));
  const partEdges = edges.filter(e => chunkNodeIds.has(e.source));
  totalNodes += partNodes.length;
  totalEdges += partEdges.length;
  const fname = parts === 1 ? 'batch-2.json' : `batch-2-part-${pi + 1}.json`;
  writeFileSync(`${outDir}/${fname}`, JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2));
  console.log(`${fname}: nodes=${partNodes.length} edges=${partEdges.length} files=${chunkFiles.size}`);
}

const importCount = edges.filter(e => e.type === 'imports').length;
const expectedImports = Object.values(batchImportData).reduce((s, a) => s + a.length, 0);
console.log(`TOTAL: nodes=${totalNodes} edges=${totalEdges} imports=${importCount} expectedImports=${expectedImports}`);
