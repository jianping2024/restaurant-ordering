#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = '/Users/chenjianping/Documents/restaurant-ordering';
const extractPath = path.join(ROOT, '.understand-anything/tmp/ua-file-extract-results-12.json');
const inputPath = path.join(ROOT, '.understand-anything/tmp/ua-file-analyzer-input-12.json');
const outDir = path.join(ROOT, '.understand-anything/intermediate');

const extract = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const batchImportData = input.batchImportData;

const fileSummaries = {
  'apps/web/src/lib/print-agent-config.ts': '打印代理云端配置的默认值、表单转换、规范化与校验，涵盖轮询间隔、重试策略与默认收据站。',
  'apps/web/src/lib/print-agent-constants.ts': '打印代理连接测试用的固定订单 ID 常量。',
  'apps/web/src/lib/print-agent-dashboard-auth.ts': '店主仪表盘打印代理 API 的餐厅身份校验，解析当前登录店主所属餐厅。',
  'apps/web/src/lib/print-agent-jwt.ts': '从 @mesa/shared 再导出打印代理 JWT 签名与验证函数及声明类型。',
  'apps/web/src/lib/print-agent-pairing-code.ts': '生成六位配对码并对已消费码做掩码展示，排除弱码。',
  'apps/web/src/lib/print-agent-pairing-slots.ts': '判断配对记录是否处于待配对有效窗口内。',
  'apps/web/src/lib/print-agent-routing.test.ts': '打印任务路由、站点映射冲突与设备可见性过滤的单元测试。',
  'apps/web/src/lib/print-agent-routing.ts': '打印任务按收据站路由、设备可见性过滤、路由快照读写与站点冲突检测。',
  'apps/web/src/lib/print-job-max-age.ts': '定义打印任务最大存活时间与过期 cutoff 时间戳计算。',
  'apps/web/src/lib/print-jobs-scope.ts': '打印任务查询参数的租户隔离校验与餐厅级行过滤。',
  'apps/web/src/lib/print-receipt-printer-options.ts': '收据打印机快照构建、结账展示、路由快照解析与 ID 合法性校验。',
  'apps/web/src/lib/request-client-ip.ts': '从 Next.js 请求头提取客户端 IP（X-Forwarded-For / X-Real-IP）。',
  'apps/web/src/lib/restaurant-receipt-printers-server.ts': '服务端加载餐厅收据打印机快照并解析/校验打印机 ID。',
  'apps/web/src/lib/run-nightly-auto-close.ts': 'Cron 入口：按餐厅时区触发批量关闭未结账单会话。',
  'apps/web/src/lib/staff-account.ts': '员工账号角色、登录名规范化、邮箱合成、密码校验与 metadata 解析。',
  'apps/web/src/lib/staff-api-auth.ts': '员工 API 路由的身份认证，按 slug 加载餐厅并校验 Supabase 会话与角色。',
  'apps/web/src/lib/staff-dashboard-api.ts': '仪表盘员工 CRUD 的共享加载、行映射、metadata 与创建请求体校验。',
  'apps/web/src/lib/supabase/admin.ts': '创建 Supabase service-role 管理客户端，绕过 RLS 用于服务端操作。',
  'apps/web/src/lib/supabase/middleware.ts': 'Next.js 中间件会话刷新、Cookie 同步与仪表盘/员工路由访问控制。',
  'apps/web/src/lib/supabase/server.ts': 'Server Component / Route Handler 用的 Supabase 服务端客户端工厂。',
  'apps/web/src/lib/table-session/load-close-table-actor.ts': '关台操作审计 actor 解析，区分店主、前台与员工身份。',
  'apps/web/src/lib/verify-cron-secret.ts': '校验 Cron 请求头中的 CRON_SECRET 是否匹配环境变量。',
  'apps/web/src/lib/waiter-session-guard.ts': '服务员改单/关台前检查桌台会话是否处于 billing 等阻塞状态。',
  'apps/web/src/lib/zoned-time.ts': '按 IANA 时区提取年月日时分，供夜间自动关台等定时逻辑使用。',
  'apps/web/src/middleware.ts': 'Next.js 全局 middleware 入口，委托 updateSession 处理所有匹配路由。',
};

const fileTags = {
  'apps/web/src/lib/print-agent-config.ts': ['utility', 'printing', 'configuration'],
  'apps/web/src/lib/print-agent-constants.ts': ['utility', 'printing', 'constants'],
  'apps/web/src/lib/print-agent-dashboard-auth.ts': ['middleware', 'printing', 'auth'],
  'apps/web/src/lib/print-agent-jwt.ts': ['barrel', 'printing', 'auth'],
  'apps/web/src/lib/print-agent-pairing-code.ts': ['utility', 'printing', 'security'],
  'apps/web/src/lib/print-agent-pairing-slots.ts': ['utility', 'printing', 'validation'],
  'apps/web/src/lib/print-agent-routing.test.ts': ['test', 'printing', 'routing'],
  'apps/web/src/lib/print-agent-routing.ts': ['service', 'printing', 'routing'],
  'apps/web/src/lib/print-job-max-age.ts': ['utility', 'printing', 'constants'],
  'apps/web/src/lib/print-jobs-scope.ts': ['validation', 'printing', 'tenant-isolation'],
  'apps/web/src/lib/print-receipt-printer-options.ts': ['utility', 'printing', 'serialization'],
  'apps/web/src/lib/request-client-ip.ts': ['utility', 'middleware', 'network'],
  'apps/web/src/lib/restaurant-receipt-printers-server.ts': ['service', 'printing', 'data-access'],
  'apps/web/src/lib/run-nightly-auto-close.ts': ['service', 'cron', 'table-session'],
  'apps/web/src/lib/staff-account.ts': ['utility', 'auth', 'staff'],
  'apps/web/src/lib/staff-api-auth.ts': ['middleware', 'auth', 'api-handler'],
  'apps/web/src/lib/staff-dashboard-api.ts': ['service', 'auth', 'dashboard'],
  'apps/web/src/lib/supabase/admin.ts': ['singleton', 'data-access', 'supabase'],
  'apps/web/src/lib/supabase/middleware.ts': ['middleware', 'auth', 'supabase'],
  'apps/web/src/lib/supabase/server.ts': ['factory', 'supabase', 'server'],
  'apps/web/src/lib/table-session/load-close-table-actor.ts': ['service', 'audit', 'table-session'],
  'apps/web/src/lib/verify-cron-secret.ts': ['validation', 'security', 'cron'],
  'apps/web/src/lib/waiter-session-guard.ts': ['validation', 'waiter', 'table-session'],
  'apps/web/src/lib/zoned-time.ts': ['utility', 'timezone', 'date'],
  'apps/web/src/middleware.ts': ['entry-point', 'middleware', 'nextjs'],
};

const fnSummaries = {
  'defaultPrintAgentCloudConfig': '返回打印代理云端配置的默认值（轮询、重试、默认收据站等）。',
  'cloudConfigToForm': '将云端 JSON 配置映射为仪表盘表单字段结构。',
  'formToCloudConfig': '将表单输入转换并 clamp 为可持久化的云端配置对象。',
  'parseDefaultReceiptStationId': '解析默认收据站 ID 字符串，空值返回 null。',
  'normalizePrintAgentCloudConfig': '合并 partial 配置与默认值并规范化数值边界。',
  'validatePrintAgentCloudConfig': '校验配置字段类型与范围，返回错误消息数组。',
  'getOwnerRestaurantId': '从 Supabase 会话解析店主 userId 与所属 restaurantId，含暂停检查。',
  'randomPairingCode': '生成六位数字配对码，排除已知弱码。',
  'maskPairingCode': '对已消费配对码做掩码，未消费则原样返回。',
  'isPendingPairing': '判断配对行是否在 expires_at 之前且 revoked_at 为空。',
  'parseReceiptStationId': '从 receiptPrinterId 提取 station UUID（receipt: 前缀）。',
  'stationIdsFromRoutingSnapshot': '从路由快照 JSON 解析全部 station ID 列表。',
  'printJobTargetStationId': '从打印任务 payload 推断目标收据站 ID。',
  'isPrintJobVisibleToDevice': '判断打印任务是否应投递到指定设备绑定的站点集合。',
  'filterPrintJobsForDevice': '按设备站点过滤待处理打印任务列表。',
  'normalizeStationPrintersInput': '规范化 API 传入的 station→printer 映射数组。',
  'loadDeviceRoutingStationIds': '从数据库加载设备 routing_snapshot 中的 station IDs。',
  'findStationMappingConflicts': '检测多设备间同一 station 映射冲突并返回冲突详情。',
  'saveDeviceRoutingSnapshot': '持久化设备路由快照并更新 paired 设备列表。',
  'stationLabelsFromRoutingSnapshot': '从路由快照生成 stationId→显示名映射。',
  'printJobMaxAgeCutoffDate': '计算当前时间减去最大存活毫秒后的 Date。',
  'printJobMaxAgeCutoffIso': '返回过期 cutoff 的 ISO 8601 字符串。',
  'rejectForbiddenPrintJobsScopeParams': '拒绝含 restaurant_id 等禁止 scope 参数的查询。',
  'rejectUnexpectedPrintJobsQueryParams': '校验查询参数键是否在允许白名单内。',
  'filterPrintJobsByRestaurant': '按 restaurantId 过滤打印任务行，防止跨租户泄露。',
  'stationDisplayName': '按 locale 选择站点的中/英/葡显示名。',
  'buildReceiptPrinterSnapshot': '聚合设备路由与站点表构建收据打印机快照。',
  'presentReceiptPrintersForCheckout': '为结账 UI 组装可选收据打印机列表（含默认标记）。',
  'parseReceiptPrinterRoutingSnapshot': '解析 routing_snapshot JSON 为 station→printer 映射。',
  'isValidReceiptPrinterId': '校验 printer ID 是否存在于给定快照中。',
  'clientIpFromRequest': '从 X-Forwarded-For 或 X-Real-IP 提取客户端 IP。',
  'loadRestaurantReceiptPrinterSnapshot': '加载餐厅所有在线设备的合并收据打印机快照。',
  'assertReceiptPrinterIdAllowed': '断言 printerId 在快照中，否则抛出错误。',
  'resolveReceiptPrinterId': '解析显式或默认收据打印机 ID，含 locale 回退逻辑。',
  'executeNightlyAutoClose': '创建 admin 客户端并按各餐厅时区执行批量关台。',
  'isStaffRole': '类型守卫：判断字符串是否为合法员工角色。',
  'normalizeLoginName': '登录名 trim 并转小写。',
  'sanitizeStaffLoginInput': '从邮箱或登录名输入提取纯登录名部分。',
  'validateLoginName': '校验登录名字符集与长度，返回错误消息。',
  'suggestLoginNameFromDisplay': '根据显示名与角色生成唯一登录名建议（含哈希后缀）。',
  'buildStaffEmail': '由登录名合成 @staff 域邮箱。',
  'composeStaffEmail': '兼容登录名或完整邮箱输入，统一输出 staff 邮箱。',
  'staffPasswordValid': '校验员工密码最小长度要求。',
  'parseStaffUserMetadata': '从 Supabase user metadata 解析 StaffAccountMetadata。',
  'staffAuthErrorStatus': '将 StaffAuthError 映射为 HTTP 状态码。',
  'loadRestaurantBySlug': '通过 slug 加载餐厅 id，不存在返回 null。',
  'staffAuthFromRequest': '从请求 Cookie 会话校验指定 slug 餐厅的员工身份与角色。',
  'staffAuthForPage': 'Server Component 版员工认证（无 Request 对象）。',
  'openTableAuthFromRequest': '开台操作专用的员工角色认证。',
  'staffAuthFromRequestWithRoles': '允许多角色的员工认证变体。',
  'loadOwnerRestaurantWithSlug': '组合 getOwnerRestaurantId 与餐厅详情加载。',
  'mapStaffRow': '将数据库 staff 行映射为 API 响应 DTO。',
  'staffMetadataPayload': '构建 Supabase Auth 用户 metadata 写入 payload。',
  'validateStaffCreateBody': '校验创建员工请求体的 role、loginName、password 等字段。',
  'createAdminClient': '实例化 Supabase service-role 客户端。',
  'updateSession': '刷新 Supabase 会话、写 Cookie，并按路径重定向未授权访问。',
  'createClient': '基于 Next.js cookies() 创建服务端 Supabase 客户端。',
  'loadCloseTableSessionActor': '解析关台操作的审计 actor（店主/前台/员工）。',
  'verifyCronSecret': '比对 Authorization 头与环境 CRON_SECRET。',
  'tableSessionBlocksWaiterMutation': '检查桌台是否有 billing 会话阻塞服务员改单。',
  'sessionIdBlocksWaiterMutation': '按 sessionId 检查是否处于 billing 阻塞态。',
  'sessionBillingResponse': '返回 billing 阻塞的标准 JSON 错误响应。',
  'getZonedCalendarParts': '用 Intl.DateTimeFormat 提取指定时区的日历分量。',
  'middleware': 'Next.js middleware 包装，调用 updateSession。',
};

const crossBatchCalls = [
  ['function:apps/web/src/lib/print-agent-routing.ts:stationIdsFromRoutingSnapshot', 'function:apps/web/src/lib/print-receipt-printer-options.ts:parseReceiptPrinterRoutingSnapshot'],
  ['function:apps/web/src/lib/print-agent-routing.ts:findStationMappingConflicts', 'function:apps/web/src/lib/print-receipt-printer-options.ts:parseReceiptPrinterRoutingSnapshot'],
  ['function:apps/web/src/lib/restaurant-receipt-printers-server.ts:loadRestaurantReceiptPrinterSnapshot', 'function:apps/web/src/lib/print-receipt-printer-options.ts:buildReceiptPrinterSnapshot'],
  ['function:apps/web/src/lib/restaurant-receipt-printers-server.ts:resolveReceiptPrinterId', 'function:apps/web/src/lib/print-agent-config.ts:parseDefaultReceiptStationId'],
  ['function:apps/web/src/lib/run-nightly-auto-close.ts:executeNightlyAutoClose', 'function:apps/web/src/lib/auto-close-active-sessions.ts:closeAllOpenBillingSessions'],
  ['function:apps/web/src/lib/run-nightly-auto-close.ts:executeNightlyAutoClose', 'function:apps/web/src/lib/auto-close-active-sessions.ts:isNightlyAutoCloseDue'],
  ['function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequest', 'function:apps/web/src/lib/staff-account.ts:parseStaffUserMetadata'],
  ['function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequest', 'function:apps/web/src/lib/db-migration-error.ts:isDbMigrationRequiredError'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:loadOwnerRestaurantWithSlug', 'function:apps/web/src/lib/print-agent-dashboard-auth.ts:getOwnerRestaurantId'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:validateStaffCreateBody', 'function:apps/web/src/lib/staff-account.ts:validateLoginName'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:validateStaffCreateBody', 'function:apps/web/src/lib/staff-account.ts:staffPasswordValid'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:staffMetadataPayload', 'function:apps/web/src/lib/staff-account.ts:composeStaffEmail'],
  ['function:apps/web/src/lib/supabase/middleware.ts:updateSession', 'function:apps/web/src/lib/dashboard-access.ts:loadDashboardAccess'],
  ['function:apps/web/src/lib/supabase/middleware.ts:updateSession', 'function:apps/web/src/lib/dashboard-access.ts:isOwnerDashboardPath'],
  ['function:apps/web/src/lib/table-session/load-close-table-actor.ts:loadCloseTableSessionActor', 'function:apps/web/src/lib/dashboard-access.ts:loadDashboardAccess'],
  ['function:apps/web/src/lib/table-session/load-close-table-actor.ts:loadCloseTableSessionActor', 'function:apps/web/src/lib/audit/load-owner-dashboard-actor.ts:loadOwnerDashboardAuditActor'],
  ['function:apps/web/src/lib/table-session/load-close-table-actor.ts:loadCloseTableSessionActor', 'function:apps/web/src/lib/audit/index.ts:staffAuditActor'],
  ['function:apps/web/src/middleware.ts:middleware', 'function:apps/web/src/lib/supabase/middleware.ts:updateSession'],
];

const intraBatchCalls = [
  ['function:apps/web/src/lib/print-agent-dashboard-auth.ts:getOwnerRestaurantId', 'function:apps/web/src/lib/supabase/server.ts:createClient'],
  ['function:apps/web/src/lib/print-agent-dashboard-auth.ts:getOwnerRestaurantId', 'function:apps/web/src/lib/supabase/admin.ts:createAdminClient'],
  ['function:apps/web/src/lib/print-agent-routing.ts:stationIdsFromRoutingSnapshot', 'function:apps/web/src/lib/print-receipt-printer-options.ts:parseReceiptPrinterRoutingSnapshot'],
  ['function:apps/web/src/lib/print-job-max-age.ts:printJobMaxAgeCutoffIso', 'function:apps/web/src/lib/print-job-max-age.ts:printJobMaxAgeCutoffDate'],
  ['function:apps/web/src/lib/restaurant-receipt-printers-server.ts:loadRestaurantReceiptPrinterSnapshot', 'function:apps/web/src/lib/print-receipt-printer-options.ts:buildReceiptPrinterSnapshot'],
  ['function:apps/web/src/lib/restaurant-receipt-printers-server.ts:resolveReceiptPrinterId', 'function:apps/web/src/lib/print-agent-config.ts:parseDefaultReceiptStationId'],
  ['function:apps/web/src/lib/run-nightly-auto-close.ts:executeNightlyAutoClose', 'function:apps/web/src/lib/supabase/admin.ts:createAdminClient'],
  ['function:apps/web/src/lib/run-nightly-auto-close.ts:executeNightlyAutoClose', 'function:apps/web/src/lib/zoned-time.ts:getZonedCalendarParts'],
  ['function:apps/web/src/lib/staff-api-auth.ts:loadRestaurantBySlug', 'function:apps/web/src/lib/supabase/admin.ts:createAdminClient'],
  ['function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequest', 'function:apps/web/src/lib/supabase/server.ts:createClient'],
  ['function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequest', 'function:apps/web/src/lib/staff-account.ts:parseStaffUserMetadata'],
  ['function:apps/web/src/lib/staff-api-auth.ts:openTableAuthFromRequest', 'function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequestWithRoles'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:loadOwnerRestaurantWithSlug', 'function:apps/web/src/lib/print-agent-dashboard-auth.ts:getOwnerRestaurantId'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:loadOwnerRestaurantWithSlug', 'function:apps/web/src/lib/supabase/admin.ts:createAdminClient'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:validateStaffCreateBody', 'function:apps/web/src/lib/staff-account.ts:isStaffRole'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:validateStaffCreateBody', 'function:apps/web/src/lib/staff-account.ts:validateLoginName'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:validateStaffCreateBody', 'function:apps/web/src/lib/staff-account.ts:staffPasswordValid'],
  ['function:apps/web/src/lib/staff-dashboard-api.ts:staffMetadataPayload', 'function:apps/web/src/lib/staff-account.ts:composeStaffEmail'],
];

function complexityForFile(r) {
  const nel = r.nonEmptyLines ?? r.totalLines;
  if (nel > 200) return 'complex';
  if (nel > 50) return 'moderate';
  return 'simple';
}

function complexityForFn(start, end) {
  const len = end - start + 1;
  if (len > 30) return 'complex';
  if (len > 10) return 'moderate';
  return 'simple';
}

function isSignificant(fn, exports) {
  const exported = exports.some(e => e.name === fn.name);
  const len = fn.endLine - fn.startLine + 1;
  return exported || len >= 10;
}

const nodes = [];
const edges = [];
const fnNodeIds = new Set();

for (const r of extract.results) {
  const fp = r.path;
  const name = path.basename(fp);
  nodes.push({
    id: `file:${fp}`,
    type: 'file',
    name,
    filePath: fp,
    summary: fileSummaries[fp] || `${name} 模块。`,
    tags: fileTags[fp] || ['utility'],
    complexity: complexityForFile(r),
  });

  const exports = r.exports || [];
  for (const fn of r.functions || []) {
    if (!isSignificant(fn, exports)) continue;
    const id = `function:${fp}:${fn.name}`;
    fnNodeIds.add(id);
    nodes.push({
      id,
      type: 'function',
      name: fn.name,
      filePath: fp,
      lineRange: [fn.startLine, fn.endLine],
      summary: fnSummaries[fn.name] || `函数 ${fn.name}。`,
      tags: fp.includes('.test.') ? ['test'] : ['utility'],
      complexity: complexityForFn(fn.startLine, fn.endLine),
    });
    edges.push({ source: `file:${fp}`, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exports.some(e => e.name === fn.name)) {
      edges.push({ source: `file:${fp}`, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

// imports
for (const [src, targets] of Object.entries(batchImportData)) {
  for (const tgt of targets) {
    edges.push({ source: `file:${src}`, target: `file:${tgt}`, type: 'imports', direction: 'forward', weight: 0.7 });
  }
}

// calls
const allCalls = [...intraBatchCalls, ...crossBatchCalls];
const edgeKey = new Set();
for (const [src, tgt] of allCalls) {
  const k = `${src}|${tgt}|calls`;
  if (edgeKey.has(k)) continue;
  edgeKey.add(k);
  edges.push({ source: src, target: tgt, type: 'calls', direction: 'forward', weight: 0.8 });
}

// tested_by
edges.push({
  source: 'file:apps/web/src/lib/print-agent-routing.ts',
  target: 'file:apps/web/src/lib/print-agent-routing.test.ts',
  type: 'tested_by',
  direction: 'forward',
  weight: 0.5,
});

// depends_on for middleware
edges.push({
  source: 'file:apps/web/src/middleware.ts',
  target: 'file:apps/web/src/lib/supabase/middleware.ts',
  type: 'depends_on',
  direction: 'forward',
  weight: 0.6,
});

// Split
const files = extract.results.map(r => r.path).sort();
const nodeCount = nodes.length;
const edgeCount = edges.length;
console.error(`Total nodes: ${nodeCount}, edges: ${edgeCount}, files: ${files.length}`);

if (nodeCount <= 60 && edgeCount <= 120) {
  fs.writeFileSync(path.join(outDir, 'batch-12.json'), JSON.stringify({ nodes, edges }, null, 2));
  console.log(JSON.stringify({ parts: 1, nodes: nodeCount, edges: edgeCount, files: files.length }));
} else {
  const parts = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
  const chunkSize = Math.ceil(files.length / parts);
  for (let p = 0; p < parts; p++) {
    const partFiles = new Set(files.slice(p * chunkSize, (p + 1) * chunkSize));
    const partNodes = nodes.filter(n => !n.filePath || partFiles.has(n.filePath));
    const partNodeIds = new Set(partNodes.map(n => n.id));
    const partEdges = edges.filter(e => partNodeIds.has(e.source));
    fs.writeFileSync(
      path.join(outDir, `batch-12-part-${p + 1}.json`),
      JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)
    );
    console.log(JSON.stringify({ part: p + 1, nodes: partNodes.length, edges: partEdges.length, files: [...partFiles] }));
  }
  console.log(JSON.stringify({ parts, nodes: nodeCount, edges: edgeCount, files: files.length }));
}
