import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const ROOT = '/Users/chenjianping/Documents/restaurant-ordering';
const extract = JSON.parse(
  readFileSync(join(ROOT, '.understand-anything/tmp/ua-file-extract-results-7.json'), 'utf8')
);
const input = JSON.parse(
  readFileSync(join(ROOT, '.understand-anything/tmp/ua-file-analyzer-input-7.json'), 'utf8')
);
const batchImportData = input.batchImportData;

const FILE_META = {
  'apps/web/src/app/[slug]/bill/page.tsx': {
    summary: '顾客账单路由页（Server Component），加载餐厅门禁、桌台会话与菜单编码后渲染 BillPage。',
    tags: ['entry-point', 'server-component', 'customer', 'billing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/[slug]/menu/page.tsx': {
    summary: '顾客菜单路由页，校验维护状态与会话上下文后渲染 MenuPage，并导出 generateMetadata。',
    tags: ['entry-point', 'server-component', 'customer', 'menu'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/checkout/request/route.ts': {
    summary: '结账请求 API（POST），解析分账人员与葡萄牙 NIF 后委托 checkout-request-server 提交结账。',
    tags: ['api-handler', 'checkout', 'payment'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/customer/bill/route.ts': {
    summary: '顾客账单 API（GET），基于会话上下文返回当前桌台订单与分账状态。',
    tags: ['api-handler', 'customer', 'billing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/customer/session/route.ts': {
    summary: '顾客会话 API（GET），返回桌台会话、订单列表及顾客侧上下文快照。',
    tags: ['api-handler', 'customer', 'session'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/restaurants/[slug]/orders/append/route.ts': {
    summary: '追加订单 API（POST），校验购物车、地理围栏、速率限制后写入订单并确保开台会话。',
    tags: ['api-handler', 'ordering', 'validation'],
    complexity: 'complex',
  },
  'apps/web/src/app/api/restaurants/[slug]/staff/waiter/buffet/route.ts': {
    summary: '服务员自助餐开台 API（POST），鉴权后规划并应用 buffet 开台写入与桌台会话更新。',
    tags: ['api-handler', 'waiter', 'buffet'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/station-tickets/auto/route.ts': {
    summary: '档口小票自动入队 API（POST），校验入队令牌与速率限制后触发 station-ticket 入队。',
    tags: ['api-handler', 'kitchen', 'printing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/dashboard/page.tsx': {
    summary: '店主仪表盘入口 Server 页，加载访问权限与概览数据后渲染 DashboardPageClient。',
    tags: ['entry-point', 'dashboard', 'owner'],
    complexity: 'simple',
  },
  'apps/web/src/app/demo/menu/page.tsx': {
    summary: '演示菜单页，使用 demo-data 静态餐厅与桌台数据展示 MenuPage 组件。',
    tags: ['entry-point', 'demo', 'menu'],
    complexity: 'simple',
  },
  'apps/web/src/components/dashboard/DashboardPageClient.tsx': {
    summary: '仪表盘客户端主界面，展示今日 KPI、热销榜、反馈洞察、待处理结账与最近订单。',
    tags: ['component', 'dashboard', 'analytics'],
    complexity: 'complex',
  },
  'apps/web/src/components/dashboard/DashboardTopSellingPanel.tsx': {
    summary: '仪表盘热销菜品面板，以条形单元格可视化销量并复用 ValueAnalyticsTopTable。',
    tags: ['component', 'dashboard', 'analytics'],
    complexity: 'moderate',
  },
  'apps/web/src/components/dashboard/FeedbackInsightsPanel.tsx': {
    summary: '顾客反馈洞察面板，汇总评分分布、常见标签与近期评论摘要。',
    tags: ['component', 'dashboard', 'feedback'],
    complexity: 'moderate',
  },
  'apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx': {
    summary: '可复用的热销排行表格组件，展示菜品名称、销量与收入列。',
    tags: ['component', 'analytics', 'table'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/BillPage.tsx': {
    summary: '顾客结账核心客户端组件，整合账单同步、按人/按菜分账、NIF 校验、结账请求与收据打印。',
    tags: ['component', 'customer', 'checkout', 'billing'],
    complexity: 'complex',
  },
  'apps/web/src/components/menu/BuffetDishAllocator.tsx': {
    summary: '自助餐按人头分账行编辑器，管理消费人姓名与人数分配并检测超额分配。',
    tags: ['component', 'bill-split', 'buffet'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/ByItemConsumerRowRemoveButton.tsx': {
    summary: '按菜分账消费行的删除按钮，含无障碍 trash 图标。',
    tags: ['component', 'bill-split', 'ui'],
    complexity: 'simple',
  },
  'apps/web/src/components/menu/ByItemDishAllocator.tsx': {
    summary: '按菜品分账分配器，支持普通菜品行与自助餐行（MenuByItemDishAllocator）两种展示。',
    tags: ['component', 'bill-split', 'menu'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/ByItemQtyInput.tsx': {
    summary: '按菜分账数量输入控件，封装份数校验与格式化逻辑。',
    tags: ['component', 'bill-split', 'form'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/ByItemSplitSection.tsx': {
    summary: '账单页按菜分账区块，汇总订单行并嵌入 ByItemDishAllocator。',
    tags: ['component', 'bill-split', 'billing'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/CartDrawer.tsx': {
    summary: '菜单购物车侧滑抽屉，编辑 line 数量/备注、展示合计并提交追加订单。',
    tags: ['component', 'cart', 'ordering'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/CartQtyStepper.tsx': {
    summary: '购物车数量步进器，基于 IntegerInput 增减菜品份数。',
    tags: ['component', 'cart', 'form'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/ConsumerNameCombobox.test.ts': {
    summary: 'ConsumerNameCombobox 与 consumer-name-roster 逻辑的单元测试。',
    tags: ['test', 'bill-split', 'consumer-name'],
    complexity: 'simple',
  },
  'apps/web/src/components/menu/ConsumerNameCombobox.tsx': {
    summary: '消费人名下拉补全输入框，结合活跃名册提供建议与键盘导航。',
    tags: ['component', 'bill-split', 'combobox'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/MenuItemCard.tsx': {
    summary: '单个菜品卡片 UI，展示价格、描述与 CartQtyStepper 加购控件。',
    tags: ['component', 'menu', 'card'],
    complexity: 'moderate',
  },
  'apps/web/src/components/menu/MenuPage.tsx': {
    summary: '顾客点餐主客户端页面，分类浏览菜单、管理购物车、地理门禁校验与下单提交。',
    tags: ['component', 'customer', 'menu', 'ordering'],
    complexity: 'complex',
  },
  'apps/web/src/components/waiter/WaiterOrderQtyMinus.tsx': {
    summary: '服务员端订单项减量按钮，用于调整已点菜品数量。',
    tags: ['component', 'waiter', 'ordering'],
    complexity: 'simple',
  },
};

const FN_META = {
  BillRoute: { summary: '账单路由默认导出，服务端加载数据并渲染 BillPage 或维护页。', tags: ['server-component', 'routing'] },
  CustomerMenuPage: { summary: '顾客菜单页主体，加载会话后渲染 MenuPage。', tags: ['server-component', 'routing'] },
  generateMetadata: { summary: '为顾客菜单页生成 SEO metadata。', tags: ['seo', 'metadata'] },
  parsePersons: { summary: '解析结账请求体中的分账人员列表与金额分配。', tags: ['validation', 'checkout'] },
  parseResult: { summary: '将结账服务结果映射为 API 响应 JSON。', tags: ['serialization', 'checkout'] },
  POST: { summary: '处理 HTTP POST 请求的路由处理器。', tags: ['api-handler'] },
  GET: { summary: '处理 HTTP GET 请求的路由处理器。', tags: ['api-handler'] },
  DashboardPage: { summary: '仪表盘 Server 页，鉴权并传递概览数据给客户端。', tags: ['server-component', 'dashboard'] },
  DemoMenuPage: { summary: '演示菜单页组件，注入 demo 餐厅与桌台 props。', tags: ['demo', 'menu'] },
  DashboardPageClient: { summary: '仪表盘交互 UI，渲染 KPI 卡片、热销、反馈与订单列表。', tags: ['component', 'dashboard'] },
  quantityBarCell: { summary: '渲染热销菜品销量条形图单元格。', tags: ['visualization', 'utility'] },
  DashboardTopSellingPanel: { summary: '热销面板容器，组合条形单元格与排行表格。', tags: ['component', 'analytics'] },
  FeedbackInsightsPanel: { summary: '展示反馈评分、标签云与样例评论。', tags: ['component', 'feedback'] },
  ValueAnalyticsTopTable: { summary: '渲染热销菜品表格行与列头。', tags: ['component', 'table'] },
  BillPage: { summary: '结账页状态机：账单轮询、分账编辑、结账与支付确认全流程。', tags: ['component', 'checkout'] },
  isRowBuffetOverAllocated: { summary: '检测自助餐分账行人数是否超过桌台总人数。', tags: ['validation', 'buffet'] },
  BuffetDishAllocator: { summary: '自助餐分账 UI，编辑每行消费人与 headcount。', tags: ['component', 'buffet'] },
  TrashIcon: { summary: '内联 SVG 垃圾桶图标。', tags: ['ui', 'icon'] },
  ByItemConsumerRowRemoveButton: { summary: '删除按菜分账消费行的按钮组件。', tags: ['component', 'bill-split'] },
  ByItemDishAllocator: { summary: '单菜品分账分配器，渲染多消费人数量行。', tags: ['component', 'bill-split'] },
  MenuByItemDishAllocator: { summary: '菜单场景下的按菜分账分配器变体，含菜品列表布局。', tags: ['component', 'bill-split'] },
  ByItemQtyInput: { summary: '份数输入框，联动 bill-split-by-item 校验规则。', tags: ['component', 'form'] },
  ByItemSplitSection: { summary: '按菜分账区块，构建订单行并协调分配器状态。', tags: ['component', 'bill-split'] },
  CartDrawer: { summary: '购物车抽屉 UI，管理 line items 并触发下单。', tags: ['component', 'cart'] },
  CartQtyStepper: { summary: '菜品加购数量步进控件。', tags: ['component', 'cart'] },
  ConsumerNameCombobox: { summary: '消费人名输入与下拉建议组合框。', tags: ['component', 'combobox'] },
  MenuItemCard: { summary: '菜单单项卡片，含图片、价格与加购步进器。', tags: ['component', 'menu'] },
  MenuPage: { summary: '点餐主页：分类 tabs、菜品网格、购物车与提交订单。', tags: ['component', 'menu'] },
  WaiterOrderQtyMinus: { summary: '服务员减量按钮，触发父级 onDecrease 回调。', tags: ['component', 'waiter'] },
};

function isSignificant(r, fn) {
  const lines = fn.endLine - fn.startLine + 1;
  const exported = (r.exports || []).some((e) => e.name === fn.name);
  return lines >= 10 || exported;
}

function fnComplexity(r, fn) {
  const lines = fn.endLine - fn.startLine + 1;
  if (lines > 200) return 'complex';
  if (lines > 50) return 'moderate';
  return 'simple';
}

function fileComplexity(r) {
  const ne = r.nonEmptyLines ?? r.totalLines;
  if (ne > 200 || r.totalLines > 500) return 'complex';
  if (ne > 50 || r.totalLines > 100) return 'moderate';
  return 'simple';
}

const nodes = [];
const edges = [];

for (const r of extract.results) {
  const path = r.path;
  const meta = FILE_META[path] || {
    summary: `源码文件 ${path}。`,
    tags: ['utility'],
    complexity: fileComplexity(r),
  };
  nodes.push({
    id: `file:${path}`,
    type: 'file',
    name: path.split('/').pop(),
    filePath: path,
    summary: meta.summary,
    tags: meta.tags,
    complexity: meta.complexity || fileComplexity(r),
  });

  const imports = batchImportData[path] || [];
  for (const imp of imports) {
    edges.push({
      source: `file:${path}`,
      target: `file:${imp}`,
      type: 'imports',
      direction: 'forward',
      weight: 0.7,
    });
  }

  for (const fn of r.functions || []) {
    if (!isSignificant(r, fn)) continue;
    const fm = FN_META[fn.name] || {
      summary: `函数 ${fn.name}，位于 ${path}。`,
      tags: ['utility'],
    };
    const fid = `function:${path}:${fn.name}`;
    nodes.push({
      id: fid,
      type: 'function',
      name: fn.name,
      filePath: path,
      lineRange: [fn.startLine, fn.endLine],
      summary: fm.summary,
      tags: fm.tags,
      complexity: fnComplexity(r, fn),
    });
    edges.push({ source: `file:${path}`, target: fid, type: 'contains', direction: 'forward', weight: 1.0 });
    if ((r.exports || []).some((e) => e.name === fn.name)) {
      edges.push({ source: `file:${path}`, target: fid, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

// Intra-batch depends_on
const intraDeps = [
  ['apps/web/src/app/[slug]/bill/page.tsx', 'apps/web/src/components/menu/BillPage.tsx'],
  ['apps/web/src/app/[slug]/menu/page.tsx', 'apps/web/src/components/menu/MenuPage.tsx'],
  ['apps/web/src/app/dashboard/page.tsx', 'apps/web/src/components/dashboard/DashboardPageClient.tsx'],
  ['apps/web/src/app/demo/menu/page.tsx', 'apps/web/src/components/menu/MenuPage.tsx'],
  ['apps/web/src/components/dashboard/DashboardPageClient.tsx', 'apps/web/src/components/dashboard/DashboardTopSellingPanel.tsx'],
  ['apps/web/src/components/dashboard/DashboardPageClient.tsx', 'apps/web/src/components/dashboard/FeedbackInsightsPanel.tsx'],
  ['apps/web/src/components/dashboard/DashboardTopSellingPanel.tsx', 'apps/web/src/components/dashboard/ValueAnalyticsTopTable.tsx'],
  ['apps/web/src/components/menu/BillPage.tsx', 'apps/web/src/components/menu/ByItemSplitSection.tsx'],
  ['apps/web/src/components/menu/ByItemSplitSection.tsx', 'apps/web/src/components/menu/ByItemDishAllocator.tsx'],
  ['apps/web/src/components/menu/ByItemDishAllocator.tsx', 'apps/web/src/components/menu/BuffetDishAllocator.tsx'],
  ['apps/web/src/components/menu/ByItemDishAllocator.tsx', 'apps/web/src/components/menu/ByItemQtyInput.tsx'],
  ['apps/web/src/components/menu/ByItemDishAllocator.tsx', 'apps/web/src/components/menu/ConsumerNameCombobox.tsx'],
  ['apps/web/src/components/menu/BuffetDishAllocator.tsx', 'apps/web/src/components/menu/ConsumerNameCombobox.tsx'],
  ['apps/web/src/components/menu/BuffetDishAllocator.tsx', 'apps/web/src/components/menu/ByItemConsumerRowRemoveButton.tsx'],
  ['apps/web/src/components/menu/MenuPage.tsx', 'apps/web/src/components/menu/CartDrawer.tsx'],
  ['apps/web/src/components/menu/MenuPage.tsx', 'apps/web/src/components/menu/MenuItemCard.tsx'],
  ['apps/web/src/components/menu/MenuItemCard.tsx', 'apps/web/src/components/menu/CartQtyStepper.tsx'],
  ['apps/web/src/components/menu/CartDrawer.tsx', 'apps/web/src/components/menu/CartQtyStepper.tsx'],
];
for (const [src, tgt] of intraDeps) {
  edges.push({ source: `file:${src}`, target: `file:${tgt}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
}

// tested_by
edges.push({
  source: 'file:apps/web/src/components/menu/ConsumerNameCombobox.tsx',
  target: 'file:apps/web/src/components/menu/ConsumerNameCombobox.test.ts',
  type: 'tested_by',
  direction: 'forward',
  weight: 0.5,
});

// Cross-batch calls (high confidence)
const calls = [
  ['function:apps/web/src/app/api/restaurants/[slug]/checkout/request/route.ts:POST', 'function:apps/web/src/lib/checkout-request-server.ts:submitCheckoutRequestForTable'],
  ['function:apps/web/src/app/api/restaurants/[slug]/orders/append/route.ts:POST', 'function:apps/web/src/lib/resolve-append-cart-items.ts:resolveAppendCartItems'],
  ['function:apps/web/src/app/api/restaurants/[slug]/orders/append/route.ts:POST', 'function:apps/web/src/lib/table-session-open.ts:ensureOpenTableSession'],
  ['function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/buffet/route.ts:POST', 'function:apps/web/src/lib/buffet-open-table.ts:planBuffetOpenWrites'],
  ['function:apps/web/src/app/api/restaurants/[slug]/station-tickets/auto/route.ts:POST', 'function:apps/web/src/lib/station-ticket-enqueue.ts:enqueueStationTicketsForOrder'],
  ['function:apps/web/src/app/[slug]/bill/page.tsx:BillRoute', 'function:apps/web/src/lib/customer-session-context.ts:loadCustomerRestaurantGate'],
  ['function:apps/web/src/components/menu/MenuPage.tsx:MenuPage', 'function:apps/web/src/lib/auto-enqueue-station-tickets.ts:autoEnqueueStationTicketsAfterSubmit'],
];
for (const [src, tgt] of calls) {
  edges.push({ source: src, target: tgt, type: 'calls', direction: 'forward', weight: 0.8 });
}

// Verify import count
let expectedImports = 0;
for (const p of Object.keys(batchImportData)) expectedImports += batchImportData[p].length;
const actualImports = edges.filter((e) => e.type === 'imports').length;
if (actualImports !== expectedImports) {
  console.error(`Import mismatch: expected ${expectedImports}, got ${actualImports}`);
  process.exit(1);
}

const outDir = join(ROOT, '.understand-anything/intermediate');
mkdirSync(outDir, { recursive: true });

const nodeCount = nodes.length;
const edgeCount = edges.length;
const parts = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));

if (parts <= 1) {
  writeFileSync(join(outDir, 'batch-7.json'), JSON.stringify({ nodes, edges }, null, 2));
  console.log(JSON.stringify({ parts: 1, nodes: nodeCount, edges: edgeCount, imports: actualImports }));
} else {
  const files = [...extract.results].map((r) => r.path).sort();
  const chunk = Math.ceil(files.length / parts);
  for (let p = 0; p < parts; p++) {
    const partFiles = new Set(files.slice(p * chunk, (p + 1) * chunk));
    const partNodes = nodes.filter((n) => !n.filePath || partFiles.has(n.filePath));
    const partNodeIds = new Set(partNodes.map((n) => n.id));
    const partEdges = edges.filter((e) => partNodeIds.has(e.source));
    writeFileSync(
      join(outDir, `batch-7-part-${p + 1}.json`),
      JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)
    );
    console.log(`part ${p + 1}: nodes=${partNodes.length} edges=${partEdges.length}`);
  }
  console.log(JSON.stringify({ parts, nodes: nodeCount, edges: edgeCount, imports: actualImports }));
}
