#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const ROOT = '/Users/chenjianping/Documents/restaurant-ordering';
const extract = JSON.parse(readFileSync(join(ROOT, '.understand-anything/tmp/ua-file-extract-results-5.json'), 'utf8'));
const batchImportData = JSON.parse(readFileSync(join(ROOT, '.understand-anything/tmp/ua-file-analyzer-input-5.json'), 'utf8')).batchImportData;

const FILE_META = {
  'apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts': {
    summary: '店主仪表盘 PATCH API，用于更新单条异常操作记录的状态并触发审计。',
    tags: ['api-handler', 'dashboard', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/dashboard/abnormal-operations/route.ts': {
    summary: '店主仪表盘 GET API，按筛选条件分页列出异常操作记录。',
    tags: ['api-handler', 'dashboard', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/dashboard/close-table-session/route.ts': {
    summary: '仪表盘手动关台 API，校验操作者身份后关闭指定桌台会话。',
    tags: ['api-handler', 'dashboard', 'table-session'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts': {
    summary: '结账流程 POST API，对指定账单分单应用折扣并校验支付授权。',
    tags: ['api-handler', 'checkout', 'discount'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts': {
    summary: '厨房员工 PATCH API，支持订单项作废/数量调整并写入审计日志。',
    tags: ['api-handler', 'kitchen', 'order-void'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts': {
    summary: '服务员 PATCH API，在会话守卫下修改订单项并记录作废审计。',
    tags: ['api-handler', 'waiter', 'order-void'],
    complexity: 'moderate',
  },
  'apps/web/src/components/dashboard/AbnormalOperationsManager.tsx': {
    summary: '店主仪表盘异常操作管理 UI，提供筛选、列表、详情与状态变更交互。',
    tags: ['component', 'dashboard', 'abnormal-operations'],
    complexity: 'complex',
    languageNotes: '大型 React 客户端组件，组合 Modal、Toast 与 i18n。',
  },
  'apps/web/src/lib/abnormal-operations-rate-limit.ts': {
    summary: '异常操作列表与 PATCH 请求的内存级速率限制封装。',
    tags: ['utility', 'rate-limit', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations.test.ts': {
    summary: '异常操作领域逻辑单元测试，覆盖日期范围解析与风险等级计算。',
    tags: ['test', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/abnormal-operations.ts': {
    summary: '异常操作模块 barrel 文件，重导出查询、类型与日历工具。',
    tags: ['barrel', 'abnormal-operations', 'entry-point'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/client-api.ts': {
    summary: '异常操作仪表盘客户端 fetch 封装，含列表查询与 PATCH 请求。',
    tags: ['service', 'client-api', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/abnormal-operations/list-patch-merge.test.ts': {
    summary: '列表 PATCH 合并逻辑的单元测试，验证行级状态更新合并行为。',
    tags: ['test', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/abnormal-operations/list-patch-merge.ts': {
    summary: '将 PATCH 响应合并回异常操作列表数据的纯函数工具。',
    tags: ['utility', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/load-owner-context.ts': {
    summary: '加载店主异常操作 API 所需的 Supabase 客户端与审计操作者上下文。',
    tags: ['service', 'auth', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts': {
    summary: '异常操作核心查询与状态机：列表、统计、风险分级及 PATCH 持久化。',
    tags: ['service', 'data-model', 'abnormal-operations'],
    complexity: 'complex',
  },
  'apps/web/src/lib/abnormal-operations/parse-list-query.test.ts': {
    summary: '列表查询参数解析器的单元测试。',
    tags: ['test', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/parse-list-query.ts': {
    summary: '将 HTTP 查询字符串解析为异常操作列表筛选条件。',
    tags: ['utility', 'validation', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.test.ts': {
    summary: '带审计的异常操作 PATCH 服务单元测试，使用 mock Supabase。',
    tags: ['test', 'abnormal-operations', 'audit'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts': {
    summary: '封装异常操作状态更新并在变更时写入店主审计事件。',
    tags: ['service', 'audit', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/abnormal-operations/reason-display.ts': {
    summary: '异常操作原因文案与桌台链接的 i18n 展示辅助函数。',
    tags: ['utility', 'i18n', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/abnormal-operations/types.ts': {
    summary: '异常操作领域 TypeScript 类型定义：状态、风险等级与列表 DTO。',
    tags: ['type-definition', 'abnormal-operations'],
    complexity: 'simple',
  },
  'apps/web/src/lib/audit/abnormal-operation.repository.ts': {
    summary: '向 abnormal_operations 表插入审计触发的异常操作行。',
    tags: ['repository', 'audit', 'database'],
    complexity: 'simple',
  },
  'apps/web/src/lib/audit/audit.service.test.ts': {
    summary: '审计服务 recordAudit 的单元测试，覆盖事件注册与持久化路径。',
    tags: ['test', 'audit'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/audit/audit.service.ts': {
    summary: '统一审计入口：解析事件定义、写入操作日志并可选创建异常操作记录。',
    tags: ['service', 'audit', 'singleton'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/audit/builders/abnormal-owner-action.test.ts': {
    summary: '店主异常操作审计 payload 构建器的单元测试。',
    tags: ['test', 'audit'],
    complexity: 'simple',
  },
  'apps/web/src/lib/audit/builders/abnormal-owner-action.ts': {
    summary: '定义店主确认/忽略/备注异常操作三类审计事件的 payload 构建器。',
    tags: ['factory', 'audit', 'abnormal-operations'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/audit/builders/discount-applied.test.ts': {
    summary: '折扣应用审计事件构建器的单元测试。',
    tags: ['test', 'audit'],
    complexity: 'simple',
  },
  'apps/web/src/lib/audit/builders/discount-applied.ts': {
    summary: '折扣应用审计事件定义，含金额计算与异常操作风险分级。',
    tags: ['factory', 'audit', 'discount'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/audit/builders/item-deleted.ts': {
    summary: '订单项删除审计事件定义，关联作废原因与行金额风险等级。',
    tags: ['factory', 'audit', 'order-void'],
    complexity: 'moderate',
  },
  'apps/web/src/lib/audit/builders/item-qty-decremented.ts': {
    summary: '订单项数量递减审计事件定义，记录调整原因与金额影响。',
    tags: ['factory', 'audit', 'order-void'],
    complexity: 'moderate',
  },
};

const FN_META = {
  'apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH': {
    summary: '校验店主上下文与速率限制后 PATCH 异常操作状态并返回更新行。',
    tags: ['api-handler', 'patch'],
  },
  'apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET': {
    summary: '解析列表查询参数并返回异常操作分页结果。',
    tags: ['api-handler', 'get'],
  },
  'apps/web/src/app/api/dashboard/close-table-session/route.ts:POST': {
    summary: '解析桌台 ID 与确认信息后执行手动关台并映射 UI 响应。',
    tags: ['api-handler', 'table-session'],
  },
  'apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts:POST': {
    summary: '校验账单分单与折扣参数，授权后调用 applyBillSplitDiscount。',
    tags: ['api-handler', 'checkout'],
  },
  'apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH': {
    summary: '厨房员工认证后批量 PATCH 订单项并触发作废审计。',
    tags: ['api-handler', 'kitchen'],
  },
  'apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH': {
    summary: '服务员认证与会话守卫后 PATCH 订单项并记录审计。',
    tags: ['api-handler', 'waiter'],
  },
  'apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:detectDatePreset': {
    summary: '根据起止日期检测当前日期预设（今日/近7天/近30天等）。',
    tags: ['utility', 'date'],
  },
  'apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager': {
    summary: '异常操作管理主组件：筛选栏、数据表格、详情 Modal 与 PATCH 交互。',
    tags: ['component', 'dashboard'],
  },
  'apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsListRateLimitCheck': {
    summary: '对异常操作列表 GET 请求执行内存速率限制检查。',
    tags: ['rate-limit', 'utility'],
  },
  'apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsPatchRateLimitCheck': {
    summary: '对异常操作 PATCH 请求执行内存速率限制检查。',
    tags: ['rate-limit', 'utility'],
  },
  'apps/web/src/lib/abnormal-operations/client-api.ts:toQuery': {
    summary: '将列表筛选对象序列化为 URL 查询参数字符串。',
    tags: ['utility', 'serialization'],
  },
  'apps/web/src/lib/abnormal-operations/client-api.ts:fetchAbnormalOperations': {
    summary: '调用仪表盘 API 获取异常操作列表 JSON。',
    tags: ['client-api', 'fetch'],
  },
  'apps/web/src/lib/abnormal-operations/client-api.ts:patchAbnormalOperationClient': {
    summary: '客户端 PATCH 单条异常操作并解析响应或错误。',
    tags: ['client-api', 'patch'],
  },
  'apps/web/src/lib/abnormal-operations/list-patch-merge.ts:mergePatchedAbnormalOperationRow': {
    summary: '用 PATCH 返回的行替换列表中对应 id 的条目。',
    tags: ['utility', 'immutable-update'],
  },
  'apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext': {
    summary: '加载店主仪表盘访问权限、Supabase admin 客户端与审计 actor。',
    tags: ['auth', 'context-loader'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:riskLevelForVoidedItem': {
    summary: '根据作废行金额计算异常操作风险等级。',
    tags: ['business-rule', 'risk'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:riskLevelForDiscountRate': {
    summary: '根据折扣比例计算异常操作风险等级。',
    tags: ['business-rule', 'risk'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:parseAbnormalOperationsDateRange': {
    summary: '解析并校验异常操作查询的里斯本时区日期范围。',
    tags: ['validation', 'date'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:compareAbnormalOperations': {
    summary: '异常操作列表排序比较器（时间、风险等）。',
    tags: ['utility', 'sorting'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:computeStats': {
    summary: '聚合列表结果计算待处理/已确认等统计计数。',
    tags: ['aggregation', 'stats'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:listAbnormalOperations': {
    summary: '按筛选条件查询 abnormal_operations 并附带统计与分页。',
    tags: ['query', 'database'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:getAbnormalOperationById': {
    summary: '按 ID 获取单条异常操作记录。',
    tags: ['query', 'database'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:canTransitionAbnormalStatus': {
    summary: '校验异常操作状态流转是否合法。',
    tags: ['validation', 'state-machine'],
  },
  'apps/web/src/lib/abnormal-operations/owner-query.ts:patchAbnormalOperation': {
    summary: '持久化异常操作状态/备注更新到数据库。',
    tags: ['mutation', 'database'],
  },
  'apps/web/src/lib/abnormal-operations/parse-list-query.ts:parseAbnormalOperationsListQuery': {
    summary: '从 URLSearchParams 解析列表 API 的筛选与分页参数。',
    tags: ['validation', 'parsing'],
  },
  'apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:auditContext': {
    summary: '从 PATCH 输入构建店主审计 actor 与事件上下文。',
    tags: ['audit', 'context'],
  },
  'apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit': {
    summary: '执行 PATCH 并按状态变更类型写入对应审计事件。',
    tags: ['service', 'audit'],
  },
  'apps/web/src/lib/abnormal-operations/reason-display.ts:abnormalOperationReasonLabel': {
    summary: '返回异常操作原因 code 的本地化标签。',
    tags: ['i18n', 'display'],
  },
  'apps/web/src/lib/abnormal-operations/reason-display.ts:formatAbnormalOperationReasonText': {
    summary: '格式化原因标签与详情文本供 UI 展示。',
    tags: ['i18n', 'display'],
  },
  'apps/web/src/lib/abnormal-operations/reason-display.ts:abnormalOperationTableHref': {
    summary: '根据桌台 display_name 生成员工端桌台链接。',
    tags: ['routing', 'display'],
  },
  'apps/web/src/lib/audit/abnormal-operation.repository.ts:insertAbnormalOperationRow': {
    summary: '向 abnormal_operations 表插入由审计触发的异常操作行。',
    tags: ['repository', 'database'],
  },
  'apps/web/src/lib/audit/audit.service.ts:recordAudit': {
    summary: '查找事件定义、构建 payload、写 operation_log 并可选创建异常操作。',
    tags: ['service', 'audit', 'entry-point'],
  },
  'apps/web/src/lib/audit/builders/abnormal-owner-action.ts:buildPayload': {
    summary: '构建店主异常操作相关审计事件的 JSON payload。',
    tags: ['factory', 'audit'],
  },
  'apps/web/src/lib/audit/builders/discount-applied.ts:computeDiscountAmounts': {
    summary: '计算折扣前后金额供审计与风险分级使用。',
    tags: ['utility', 'money'],
  },
};

const SIGNIFICANT = new Set(Object.keys(FN_META));

const TESTED_BY = {
  'apps/web/src/lib/abnormal-operations.ts': ['apps/web/src/lib/abnormal-operations.test.ts'],
  'apps/web/src/lib/abnormal-operations/list-patch-merge.ts': ['apps/web/src/lib/abnormal-operations/list-patch-merge.test.ts'],
  'apps/web/src/lib/abnormal-operations/parse-list-query.ts': ['apps/web/src/lib/abnormal-operations/parse-list-query.test.ts'],
  'apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts': ['apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.test.ts'],
  'apps/web/src/lib/audit/audit.service.ts': ['apps/web/src/lib/audit/audit.service.test.ts'],
  'apps/web/src/lib/audit/builders/abnormal-owner-action.ts': ['apps/web/src/lib/audit/builders/abnormal-owner-action.test.ts'],
  'apps/web/src/lib/audit/builders/discount-applied.ts': ['apps/web/src/lib/audit/builders/discount-applied.test.ts'],
};

const CALLS = [
  ['apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH', 'function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH', 'function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsPatchRateLimitCheck'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH', 'function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET', 'function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET', 'function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsListRateLimitCheck'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET', 'function:apps/web/src/lib/abnormal-operations/parse-list-query.ts:parseAbnormalOperationsListQuery'],
  ['apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET', 'function:apps/web/src/lib/abnormal-operations/owner-query.ts:listAbnormalOperations'],
  ['apps/web/src/app/api/dashboard/close-table-session/route.ts:POST', 'function:apps/web/src/lib/table-session/load-close-table-actor.ts:loadCloseTableSessionActor'],
  ['apps/web/src/app/api/dashboard/close-table-session/route.ts:POST', 'function:apps/web/src/lib/table-session/close-table-session.service.ts:closeTableSessionManual'],
  ['apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts:POST', 'function:apps/web/src/lib/checkout-confirm-payment-auth.ts:authorizeCheckoutConfirmPayment'],
  ['apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts:POST', 'function:apps/web/src/lib/checkout-discount/apply-bill-split-discount.ts:applyBillSplitDiscount'],
  ['apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH', 'function:apps/web/src/lib/order-item-void/patch-order-items.service.ts:patchOrderItemsWithVoidAudit'],
  ['apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH', 'function:apps/web/src/lib/order-item-void/patch-order-items.service.ts:patchOrderItemsWithVoidAudit'],
  ['apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager', 'function:apps/web/src/lib/abnormal-operations/client-api.ts:fetchAbnormalOperations'],
  ['apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager', 'function:apps/web/src/lib/abnormal-operations/client-api.ts:patchAbnormalOperationClient'],
  ['apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit', 'function:apps/web/src/lib/abnormal-operations/owner-query.ts:patchAbnormalOperation'],
  ['apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit', 'function:apps/web/src/lib/audit/audit.service.ts:recordAudit'],
  ['apps/web/src/lib/audit/audit.service.ts:recordAudit', 'function:apps/web/src/lib/audit/abnormal-operation.repository.ts:insertAbnormalOperationRow'],
  ['apps/web/src/lib/audit/builders/item-deleted.ts:build', 'function:apps/web/src/lib/abnormal-operations/owner-query.ts:riskLevelForVoidedItem'],
];

const EXPORTED_FNS = new Set();
for (const r of extract.results) {
  for (const e of r.exports || []) {
    if ((r.functions || []).some((f) => f.name === e.name)) EXPORTED_FNS.add(`${r.path}:${e.name}`);
  }
}

const nodes = [];
const edges = [];

for (const r of extract.results) {
  const meta = FILE_META[r.path];
  const name = r.path.split('/').pop();
  nodes.push({
    id: `file:${r.path}`,
    type: 'file',
    name,
    filePath: r.path,
    summary: meta.summary,
    tags: meta.tags,
    complexity: meta.complexity,
    ...(meta.languageNotes ? { languageNotes: meta.languageNotes } : {}),
  });

  for (const imp of batchImportData[r.path] || []) {
    edges.push({ source: `file:${r.path}`, target: `file:${imp}`, type: 'imports', direction: 'forward', weight: 0.7 });
  }

  for (const f of r.functions || []) {
    const key = `${r.path}:${f.name}`;
    if (!SIGNIFICANT.has(key)) continue;
    const fm = FN_META[key];
    const lines = f.endLine - f.startLine + 1;
    nodes.push({
      id: `function:${r.path}:${f.name}`,
      type: 'function',
      name: f.name,
      filePath: r.path,
      lineRange: [f.startLine, f.endLine],
      summary: fm.summary,
      tags: fm.tags,
      complexity: lines > 50 ? 'complex' : lines > 20 ? 'moderate' : 'simple',
    });
    edges.push({ source: `file:${r.path}`, target: `function:${r.path}:${f.name}`, type: 'contains', direction: 'forward', weight: 1.0 });
    if (EXPORTED_FNS.has(key)) {
      edges.push({ source: `file:${r.path}`, target: `function:${r.path}:${f.name}`, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

for (const [src, tgt] of CALLS) {
  edges.push({ source: `function:${src}`, target: tgt, type: 'calls', direction: 'forward', weight: 0.8 });
}

for (const [prod, tests] of Object.entries(TESTED_BY)) {
  for (const t of tests) {
    edges.push({ source: `file:${prod}`, target: `file:${t}`, type: 'tested_by', direction: 'forward', weight: 0.5 });
  }
}

// split
const files = extract.results.map((r) => r.path).sort();
const parts = 2;
const chunkSize = Math.ceil(files.length / parts);
const outDir = join(ROOT, '.understand-anything/intermediate');
mkdirSync(outDir, { recursive: true });

let totalNodes = 0;
let totalEdges = 0;

for (let p = 0; p < parts; p++) {
  const partFiles = new Set(files.slice(p * chunkSize, (p + 1) * chunkSize));
  const partNodes = nodes.filter((n) => partFiles.has(n.filePath));
  const partNodeIds = new Set(partNodes.map((n) => n.id));
  const partEdges = edges.filter((e) => partNodeIds.has(e.source));
  const outPath = join(outDir, `batch-5-part-${p + 1}.json`);
  writeFileSync(outPath, JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2));
  totalNodes += partNodes.length;
  totalEdges += partEdges.length;
  console.log(`part-${p + 1}: nodes=${partNodes.length} edges=${partEdges.length}`);
}

const importCount = edges.filter((e) => e.type === 'imports').length;
const expectedImports = Object.values(batchImportData).reduce((s, a) => s + a.length, 0);
console.log(`total nodes=${totalNodes} total edges=${totalEdges} imports=${importCount} expected=${expectedImports}`);
