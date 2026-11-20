# 本次改动业务场景测试报告 — 页面 build ↔ health 版本门闩

## 本次修改
- 终态：页面 `getWebAppBuildInfo().version` 必须等于 `/api/health/live.version`；不一致则整页 reload 一次（sessionStorage 防循环）。
- 入口：root layout `WebAppBuildReconcile`（mount / tab 可见 / SW `controllerchange` 同门闩）。
- 开台：`invalid_body` 日志增加 `body_keys`；客户端无 `buffetId` 不发 POST。
- 文件：`web-app-build-reconcile.ts`、`WebAppBuildReconcile.tsx`、`layout.tsx`、buffet route、`waiter-buffet-open-submit.ts`、sole 索引与 PWA 设计文档。

## 核心业务规则
1. 两端 version 都非空且不等 → 只 reload 一次。
2. 任一侧空、或 health 失败 → 不 reload（本地 dev 常空 version）。
3. 开台 body 仍只认 `buffet: { buffet_id, adult_count, child_count }`（不双轨 `buffets[]`）。

## 详细测试场景

### 场景 1：同版本打开登录与楼面（正常）
- **前置**：feature web `:3002`，`MESA_WEB_VERSION=fix-web-app-build-reconcile`
- **操作**：打开 `/auth/login` → 登录 luckytea → 进 `/dashboard/waiter`
- **预期**：不出现 reload 循环；`sessionStorage mesa:web-app-build-reload-attempt` 为空
- **数据验证**：`GET /api/health/live` → version=`fix-web-app-build-reconcile`
- **结果**：【已验证】pass

### 场景 2：旧客户端发 `buffets[]`（升级错位）
- **前置**：已登录 jar
- **操作**：`POST …/staff/waiter/buffet` body 含 `buffets` 数组、无 `buffet`
- **预期**：400 `invalid_body`；服务端日志 `body_keys` 含 `buffets`
- **结果**：【已验证】pass

### 场景 3：版本不一致决策只触发一次（单元）
- **操作**：`takeWebAppBuildReloadDecision('old','new')` 两次
- **预期**：第一次 reload=true 并写入 attempt；第二次 false
- **结果**：【已验证】pass

### 场景 4：升包后店员长开 PWA/标签（回归门闩）
- **前置**：店机旧页仍开着，新包已上线且 bump `MESA_WEB_VERSION`
- **操作**：回前台 / 新 SW claim
- **预期**：自动 reload 到新版后再开台
- **结果**：【未验证】需含本改动的 on-prem 包升到店机后验

## 实际测试结果
- 本机 feature UAT base `http://localhost:3002`：场景 1–3 pass；场景 4 未验证。
- ops `:3001` soft-missing（与本改动无关）。

## 风险与待确认
- 发版必须 bump `MESA_WEB_VERSION`（on-prem pack 已有）；否则门闩比不到差异。
- 店机需升含本改动的包后，旧页才会带上门闩逻辑。
