import fs from 'fs';
import path from 'path';

const ROOT = '/Users/chenjianping/Documents/restaurant-ordering';
const extract = JSON.parse(fs.readFileSync(path.join(ROOT, '.understand-anything/tmp/ua-file-extract-results-8.json'), 'utf8'));
const input = JSON.parse(fs.readFileSync(path.join(ROOT, '.understand-anything/tmp/ua-file-analyzer-input-8.json'), 'utf8'));
const importData = input.batchImportData;

const FILE_META = {
  'apps/web/src/app/api/auth/login/route.ts': {
    summary: '店主邮箱密码登录 API，集成 IP 速率限制、Supabase 认证与登录后跳转解析。',
    tags: ['api-handler', 'authentication', 'rate-limit', 'entry-point'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/auth/staff/login/route.ts': {
    summary: '员工账号登录 API，校验餐厅绑定、角色元数据，并复用登录限速与跳转逻辑。',
    tags: ['api-handler', 'authentication', 'staff', 'rate-limit'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/cron/nightly-close-sessions/route.ts': {
    summary: 'Vercel Cron 夜间任务：验证密钥后自动关闭逾期未结账会话并过期陈旧打印任务。',
    tags: ['api-handler', 'cron', 'billing', 'print-jobs'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/dashboard/staff/[id]/reset-password/route.ts': {
    summary: '店主后台重置指定员工密码，校验权限后通过 Supabase Admin 更新凭据。',
    tags: ['api-handler', 'staff', 'dashboard', 'security'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/dashboard/staff/[id]/route.ts': {
    summary: '单个员工账号的 PATCH 更新与 DELETE 删除，含角色校验与数据库迁移错误处理。',
    tags: ['api-handler', 'staff', 'dashboard', 'crud'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/dashboard/staff/route.ts': {
    summary: '员工账号列表查询与新建，封装登录名规范化、邮箱合成及店主餐厅上下文加载。',
    tags: ['api-handler', 'staff', 'dashboard', 'crud'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/bill-receipt-printer/route.ts': {
    summary: '配置餐厅默认账单小票打印机，校验打印机 ID 并持久化云侧 print-agent 配置。',
    tags: ['api-handler', 'print-agent', 'receipt-printer', 'configuration'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/claim/route.ts': {
    summary: '打印代理设备凭配对码申领 JWT，含速率限制、设备注册与连接测试任务下发。',
    tags: ['api-handler', 'print-agent', 'authentication', 'rate-limit'],
    complexity: 'complex',
  },
  'apps/web/src/app/api/print-agent/devices/[id]/revoke/route.ts': {
    summary: '店主撤销已配对打印代理设备，将设备标记为失效并阻断后续任务拉取。',
    tags: ['api-handler', 'print-agent', 'security', 'revocation'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/print-agent/heartbeat/route.ts': {
    summary: '打印代理心跳上报，更新设备最后在线时间与运行时状态快照。',
    tags: ['api-handler', 'print-agent', 'heartbeat', 'monitoring'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/jobs/[id]/route.ts': {
    summary: '打印代理按任务 ID 更新打印状态（完成/失败），结合路由快照校验设备可见性。',
    tags: ['api-handler', 'print-agent', 'print-jobs', 'routing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/pairing/route.ts': {
    summary: '店主发起打印代理配对，生成限时配对码并占用待配对槽位。',
    tags: ['api-handler', 'print-agent', 'pairing', 'dashboard'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/pairings/[id]/revoke/route.ts': {
    summary: '撤销指定配对槽位（待配对或已绑定），释放设备配对名额。',
    tags: ['api-handler', 'print-agent', 'pairing', 'revocation'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/print-agent/pairings/route.ts': {
    summary: '列出餐厅所有打印代理配对槽位及掩码后的配对码状态。',
    tags: ['api-handler', 'print-agent', 'pairing', 'dashboard'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/print-agent/pending-jobs/route.ts': {
    summary: '打印代理拉取待处理任务队列，过滤过期任务并按设备路由快照筛选可见作业。',
    tags: ['api-handler', 'print-agent', 'print-jobs', 'routing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/print-jobs/[id]/retry/route.ts': {
    summary: '店主后台将失败打印任务重置为待处理以便打印代理重新拉取。',
    tags: ['api-handler', 'print-agent', 'print-jobs', 'retry'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/print-jobs/recent/route.ts': {
    summary: '店主查询近期打印任务列表，按餐厅范围过滤并返回任务详情。',
    tags: ['api-handler', 'print-agent', 'print-jobs', 'dashboard'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/print-stations/route.ts': {
    summary: '打印代理获取餐厅打印站点列表，用于本地路由与任务分发。',
    tags: ['api-handler', 'print-agent', 'print-stations'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/print-agent/receipt-printers/route.ts': {
    summary: '查询或同步小票打印机配置，支持员工/店主鉴权与结账场景打印机快照。',
    tags: ['api-handler', 'print-agent', 'receipt-printer', 'checkout'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/routing/route.ts': {
    summary: '打印代理上传或同步站点到物理打印机的路由映射快照。',
    tags: ['api-handler', 'print-agent', 'routing', 'configuration'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/runtime-config/route.ts': {
    summary: '打印代理拉取运行时云配置，含下载地址、默认站点及连接参数。',
    tags: ['api-handler', 'print-agent', 'configuration', 'runtime'],
    complexity: 'simple',
  },
  'apps/web/src/app/api/print-agent/settings/route.ts': {
    summary: '店主读取或更新打印代理全局设置（GET/PUT），校验云配置合法性。',
    tags: ['api-handler', 'print-agent', 'configuration', 'dashboard'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/print-agent/support-snapshot/route.ts': {
    summary: '打印代理导出诊断支持快照，汇总设备、路由与近期任务状态供排障。',
    tags: ['api-handler', 'print-agent', 'support', 'diagnostics'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurant/features/route.ts': {
    summary: '餐厅功能开关的读取与更新，含打印代理启用状态及迁移错误友好提示。',
    tags: ['api-handler', 'restaurant', 'feature-flags', 'configuration'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurant/settings/route.ts': {
    summary: '更新餐厅运营设置（如点餐地理半径），需店主鉴权并通过 Admin 客户端持久化。',
    tags: ['api-handler', 'restaurant', 'settings', 'configuration'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/checkout/confirm-payment/route.ts': {
    summary: '确认分账结账支付，调用 RPC 完成账单拆分扣款并触发小票打印准备。',
    tags: ['api-handler', 'checkout', 'payment', 'billing'],
    complexity: 'moderate',
  },
  'apps/web/src/app/api/restaurants/[slug]/order-receipt/print/route.ts': {
    summary: '结账前/分账小票打印入队 API，支持顾客预结单与员工授权两种鉴权路径。',
    tags: ['api-handler', 'checkout', 'receipt', 'print-jobs'],
    complexity: 'complex',
  },
};

const FN_SUMMARIES = {
  POST: '处理 POST 请求的主路由处理器，编排鉴权、校验与 JSON 响应。',
  GET: '处理 GET 请求的主路由处理器，查询资源并返回 JSON 响应。',
  PATCH: '处理 PATCH 请求，部分更新资源字段并返回结果。',
  PUT: '处理 PUT 请求，全量或结构化更新配置并持久化。',
  DELETE: '处理 DELETE 请求，删除目标资源并返回确认。',
  authorizeCustomerPreBill: '校验顾客预结单打印权限，解析会话与分账上下文后授权入队。',
};

const NEIGHBOR_CALLS = {
  clientIpFromRequest: 'apps/web/src/lib/request-client-ip.ts',
  authLoginRateLimitCheck: 'apps/web/src/lib/auth/login-rate-limit.ts',
  authLoginRecordFailure: 'apps/web/src/lib/auth/login-rate-limit.ts',
  authLoginRecordSuccess: 'apps/web/src/lib/auth/login-rate-limit.ts',
  resolvePostLoginRedirect: 'apps/web/src/lib/auth/post-login-redirect.ts',
  createClient: 'apps/web/src/lib/supabase/server.ts',
  createAdminClient: 'apps/web/src/lib/supabase/admin.ts',
  verifyCronSecret: 'apps/web/src/lib/verify-cron-secret.ts',
  executeNightlyAutoClose: 'apps/web/src/lib/run-nightly-auto-close.ts',
  expireStalePrintJobs: 'apps/web/src/lib/expire-stale-print-jobs.ts',
  maybeExpireStalePrintJobs: 'apps/web/src/lib/expire-stale-print-jobs.ts',
  isDbMigrationRequiredError: 'apps/web/src/lib/db-migration-error.ts',
  loadOwnerRestaurantWithSlug: 'apps/web/src/lib/staff-dashboard-api.ts',
  mapStaffRow: 'apps/web/src/lib/staff-dashboard-api.ts',
  staffMetadataPayload: 'apps/web/src/lib/staff-dashboard-api.ts',
  validateStaffCreateBody: 'apps/web/src/lib/staff-dashboard-api.ts',
  getOwnerRestaurantId: 'apps/web/src/lib/print-agent-dashboard-auth.ts',
  getBearerToken: 'apps/web/src/lib/print-agent-auth.ts',
  verifyAgentBearer: 'apps/web/src/lib/print-agent-auth.ts',
  verifyActiveAgentBearer: 'apps/web/src/lib/print-agent-auth.ts',
  claimRateLimitCheck: 'apps/web/src/lib/print-agent-claim-rate-limit.ts',
  claimRecordFailure: 'apps/web/src/lib/print-agent-claim-rate-limit.ts',
  claimRecordSuccess: 'apps/web/src/lib/print-agent-claim-rate-limit.ts',
  signPrintAgentJwt: 'apps/web/src/lib/print-agent-jwt.ts',
  verifyPrintAgentJwt: 'apps/web/src/lib/print-agent-jwt.ts',
  randomPairingCode: 'apps/web/src/lib/print-agent-pairing-code.ts',
  maskPairingCode: 'apps/web/src/lib/print-agent-pairing-code.ts',
  isPendingPairing: 'apps/web/src/lib/print-agent-pairing-slots.ts',
  filterPrintJobsForDevice: 'apps/web/src/lib/print-agent-routing.ts',
  isPrintJobVisibleToDevice: 'apps/web/src/lib/print-agent-routing.ts',
  printJobTargetStationId: 'apps/web/src/lib/print-agent-routing.ts',
  saveDeviceRoutingSnapshot: 'apps/web/src/lib/print-agent-routing.ts',
  rejectForbiddenPrintJobsScopeParams: 'apps/web/src/lib/print-jobs-scope.ts',
  rejectUnexpectedPrintJobsQueryParams: 'apps/web/src/lib/print-jobs-scope.ts',
  filterPrintJobsByRestaurant: 'apps/web/src/lib/print-jobs-scope.ts',
  defaultPrintAgentCloudConfig: 'apps/web/src/lib/print-agent-config.ts',
  validatePrintAgentCloudConfig: 'apps/web/src/lib/print-agent-config.ts',
  normalizePrintAgentCloudConfig: 'apps/web/src/lib/print-agent-config.ts',
  loadRestaurantReceiptPrinterSnapshot: 'apps/web/src/lib/restaurant-receipt-printers-server.ts',
  assertReceiptPrinterIdAllowed: 'apps/web/src/lib/restaurant-receipt-printers-server.ts',
  resolveReceiptPrinterId: 'apps/web/src/lib/restaurant-receipt-printers-server.ts',
  authorizeCheckoutConfirmPayment: 'apps/web/src/lib/checkout-confirm-payment-auth.ts',
  confirmBillSplitPayment: 'apps/web/src/lib/checkout-confirm-payment.ts',
  enqueueReceiptPrint: 'apps/web/src/lib/order-receipt-enqueue.ts',
  loadOrdersForReceiptPrint: 'apps/web/src/lib/order-receipt-enqueue.ts',
  staffAuthFromRequest: 'apps/web/src/lib/staff-api-auth.ts',
  staffAuthFromRequestWithRoles: 'apps/web/src/lib/staff-api-auth.ts',
  normalizeOrderRadiusMeters: 'apps/web/src/lib/order-radius.ts',
  getPrintAgentDownloadUrls: 'apps/web/src/lib/print-agent-download.ts',
};

const nodes = [];
const edges = [];

for (const r of extract.results) {
  const meta = FILE_META[r.path];
  const name = path.basename(r.path);
  nodes.push({
    id: `file:${r.path}`,
    type: 'file',
    name,
    filePath: r.path,
    summary: meta.summary,
    tags: meta.tags,
    complexity: meta.complexity,
    languageNotes: 'Next.js App Router route handler，导出 HTTP 方法函数与 runtime 配置。',
  });

  const exports = r.exports || [];
  const sigFns = (r.functions || []).filter(
    (f) => f.endLine - f.startLine + 1 >= 10 || exports.some((e) => e.name === f.name),
  );

  for (const fn of sigFns) {
    const fnId = `function:${r.path}:${fn.name}`;
    const isExported = exports.some((e) => e.name === fn.name);
    const fnSummary =
      FN_SUMMARIES[fn.name] ||
      `${fn.name} 路由处理器，负责该端点的核心业务编排与响应。`;

    nodes.push({
      id: fnId,
      type: 'function',
      name: fn.name,
      filePath: r.path,
      lineRange: [fn.startLine, fn.endLine],
      summary: fnSummary,
      tags: ['api-handler', 'route-handler', isExported ? 'exported' : 'handler'],
      complexity:
        fn.endLine - fn.startLine + 1 > 80 ? 'complex' : fn.endLine - fn.startLine + 1 > 40 ? 'moderate' : 'simple',
    });

    edges.push({
      source: `file:${r.path}`,
      target: fnId,
      type: 'contains',
      direction: 'forward',
      weight: 1.0,
    });

    if (isExported) {
      edges.push({
        source: `file:${r.path}`,
        target: fnId,
        type: 'exports',
        direction: 'forward',
        weight: 0.8,
      });
    }
  }

  for (const imp of importData[r.path] || []) {
    edges.push({
      source: `file:${r.path}`,
      target: `file:${imp}`,
      type: 'imports',
      direction: 'forward',
      weight: 0.7,
    });
  }

  const seenCalls = new Set();
  for (const cg of r.callGraph || []) {
    const callee = cg.callee;
    const baseName = callee.split('.')[0].split('(')[0];
    const targetFile = NEIGHBOR_CALLS[baseName] || NEIGHBOR_CALLS[callee];
    if (!targetFile) continue;
    const key = `${cg.caller}->${baseName}@${targetFile}`;
    if (seenCalls.has(key)) continue;
    seenCalls.add(key);
    edges.push({
      source: `function:${r.path}:${cg.caller}`,
      target: `function:${targetFile}:${baseName}`,
      type: 'calls',
      direction: 'forward',
      weight: 0.8,
    });
  }
}

// partition
const files = extract.results.map((r) => r.path).sort();
const nodeCount = nodes.length;
const edgeCount = edges.length;
const parts = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
const chunkSize = Math.ceil(files.length / parts);
const fileChunks = [];
for (let i = 0; i < parts; i++) fileChunks.push(files.slice(i * chunkSize, (i + 1) * chunkSize));

const outDir = path.join(ROOT, '.understand-anything/intermediate');
fs.mkdirSync(outDir, { recursive: true });

let totalNodes = 0;
let totalEdges = 0;

for (let i = 0; i < fileChunks.length; i++) {
  const chunkFiles = new Set(fileChunks[i]);
  const partNodes = nodes.filter((n) => chunkFiles.has(n.filePath));
  const partNodeIds = new Set(partNodes.map((n) => n.id));
  const partEdges = edges.filter((e) => partNodeIds.has(e.source));
  totalNodes += partNodes.length;
  totalEdges += partEdges.length;
  const outPath = path.join(outDir, `batch-8-part-${i + 1}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2));
  console.log(`part ${i + 1}: nodes=${partNodes.length} edges=${partEdges.length}`);
}

console.log(`TOTAL nodes=${totalNodes} edges=${totalEdges} importEdges=${edges.filter(e=>e.type==='imports').length}`);
