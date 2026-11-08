# 自助餐：套餐最少人数 + 价目成人/儿童开关（定稿方案）

状态：用户已确认方案，**可直接开工，不再重新分析**。实现前把本文件复制进 worktree 的 `docs/buffet-min-guest-and-side-toggle.zh.md` 一起提交。

## 0. 已拍板的需求（不要再问）

1. 每个套餐有「最少人数」`buffets.min_guest_count`，默认 0，范围 0–99 整数。
2. 人数口径 = 成人 + 儿童合计（关掉的一侧按 0 计）。
3. **开台、桌台详情改人数、结账改人数都拦**：合计 < 最少人数 → 提示原因并拒绝。没有例外，「要规则就得按规则来」。
4. 开错台 = 强制关台重开；**不**为「减回 0 人」开口子。最少人数 > 0 时人数到不了 0，「人数改为 0？」确认自然不出现，不用改它。
5. 价格规则上加 `adult_enabled` / `child_enabled`，**默认都勾上**，**至少勾一个**才能保存（UI + DB CHECK 双拦）。
6. 显示一律按开关：关掉的一侧哪里都不显示（开台抽屉、详情、结账改人数、预计合计、后台价目矩阵/列表/预览、小票），人数必须为 0，接口也拒绝 > 0。
7. 开关只存一份（在价格规则上），**不**复制进 `buffet_base` 行。已开台的桌按「当前命中的规则」取开关；跨时段导致开关不一致 = 线下单桌处理，系统不兜底。
8. 已开台桌不做迁移兼容：升级一定是打烊后，不考虑营业中升级。
9. 合并桌 `merge_table_sessions` 不改。前提：价格列保持 NOT NULL（关掉的一侧保留原价，不存 NULL），否则合并桌「两价都不能为空」会报错。
10. 新字段必须进现有版本控制：写入只走现有 `updateBuffet` / `create|updateBuffetPriceRule`（已由 `afterBuffetConfigWrite` → `invalidateBuffetConfig` bump `buffet_config_version`），不许另开保存接口。

## 1. 现状（已核实的代码事实）

- 取价唯一 RPC `resolve_buffet_prices(p_restaurant_id, p_buffet_id, p_at)`，最新定义在 `supabase/migrations/20261107150000_buffet_openable_now.sql`，`RETURNS TABLE(adult_price, child_price, rule_id, time_slot_id)`，无显式 GRANT/REVOKE（默认 PUBLIC execute）。TS 调用方只有 `lib/resolve-buffet-prices-server.ts` 与 `components/dashboard/buffet/BuffetPricePreview.tsx`（浏览器直调）；SQL 调用方（merge / append 等）按列名取值，加列不影响。
- `runBuffetWaiterOpenPipeline`（`lib/buffet-waiter-pipeline.ts`）：冷开台先 `assertOpenable`，然后 **`openTableSessionIfAbsent` 先建会话**，之后才取价 / `buildBuffetBaseLine`，失败无回滚 → 今天 `no_price_rule` 就会留下空会话。
- 已开台改人数：`resolved = locked ?? RPC`，`resolvedBuffetPriceFromLockedLine`（`lib/buffet-locked-prices.ts`）只有单价，无开关。
- 唯一楼面编辑器 `WaiterBuffetPackagesEditor`（开台抽屉 / 详情 / `CheckoutHeadcountAdjustModal` 共用），入参 `buffetOptions: Buffet[]` + `resolvedByBuffetId`，计数器 `BuffetGuestCounter`。
- 客户端预检 `buffetOpenSubmitBlockReason`（`lib/waiter-buffet-open-submit.ts`，目前只有 `unchanged` / `editor_not_ready`），失败提示唯一出口 `toastWaiterBuffetOpenFailure`。
- 开台缓存：`loadWaiterOpenableSnapshot`（`lib/buffet-openable-server.ts`）+ `lib/waiter-buffet-openable-client-cache.ts`（`CACHE_SCHEMA_VERSION = 2`，`parseCachedPrices`）。
- 套餐 PATCH 白名单 `parseBuffetUpdatePatch`（`lib/buffet-update-patch.ts`）。规则草稿 `BuffetRuleDraft`（`lib/buffet-pricing-admin.ts`），规则弹窗在 `components/dashboard/BuffetSettingsManager.tsx`（~975 行附近成人/儿童价输入）。
- 后台规则价格 3 处各自内联 `€x / €y`：`BuffetSettingsManager.tsx:754`、`buffet/BuffetPriceMatrix.tsx:127-131`、`buffet/BuffetPricePreview.tsx:188`。

## 2. End-state shape

最少人数只有 `buffets.min_guest_count` 一份；开关只有 `buffet_price_rules.adult_enabled/child_enabled` 一份，经 `resolve_buffet_prices` 随取价结果进入 `ResolvedBuffetPriceRow`。人数是否合规只由一个纯函数判断，服务端管道 + 开台抽屉 / 详情 / 结账三处共用。

## 3. 实现步骤

1. **迁移（一个新的时间戳文件）**
   - `buffets.min_guest_count integer NOT NULL DEFAULT 0 CHECK (min_guest_count BETWEEN 0 AND 99)`
   - `buffet_price_rules.adult_enabled boolean NOT NULL DEFAULT true`、`child_enabled boolean NOT NULL DEFAULT true`、`CHECK (adult_enabled OR child_enabled)`；价格列保持 NOT NULL。
   - `DROP FUNCTION public.resolve_buffet_prices(uuid, uuid, timestamptz)` 后按现有逻辑重建，返回表追加 `adult_enabled boolean, child_enabled boolean`（无规则分支返回 null）。保持原有授权状态（默认）。
   - 本地 Docker 先跑通（`supabase migration up --local --include-all`），更新 `docs/ai-schema.md`。
2. **类型 / 取价**：`Buffet.min_guest_count`、`BuffetPriceRule.adult_enabled/child_enabled`、`ResolvedBuffetPriceRow` 加两开关；`resolve-buffet-prices-server.ts`、`BuffetPricePreview` 解析；缺开关时按两侧都开处理。
3. **共享校验**（放在 `lib/buffet-order.ts`，不新建平行文件）：`buffetGuestCountViolation({ minGuestCount, adultEnabled, childEnabled, adults, children })` → `null | { code: 'buffet_side_disabled', side } | { code: 'buffet_min_guest_count', min, total }`。先查关掉的一侧，再查最少人数。
4. **开台管道**
   - 冷开台：取价（RPC）+ `assertOpenable` + `buffetGuestCountViolation` **全部在 `openTableSessionIfAbsent` 之前**；通过才建会话（顺带修掉 `no_price_rule` 留空会话）。
   - 已开台 save（`!unchanged` 分支内）：单价取锁定，开关取当前 RPC（RPC 返回空时按两侧都开）；这条「价取锁定、开关取当前」规则只放在 `mergeBuffetPricesPreferLocked` 一处，管道与详情客户端都用它。
   - 不合规 → 409 + 稳定 code `buffet_min_guest_count` / `buffet_side_disabled`（message 带 min/total），与已收款人数地板并存。
5. **缓存**：`loadWaiterOpenableSnapshot` 价格项带开关（`min_guest_count` 随 `Buffet` 下发，确认看板/详情的 buffets select 带上该列）；`parseCachedPrices` 解析开关；`CACHE_SCHEMA_VERSION` → 3。
6. **楼面 UI**
   - `WaiterBuffetPackagesEditor`：按开关显隐成人/儿童 `BuffetGuestCounter`；`min_guest_count > 0` 时显示「最少 N 人」提示；预计合计按开关显示。
   - `buffetOpenSubmitBlockReason` 增加两种原因（调用共享校验）；开台确认、详情自动保存、`CheckoutHeadcountAdjustModal` 确认都先本地拦并 toast；服务端 409 code 映射进 `toastWaiterBuffetOpenFailure`，文案同源（含「本套餐最少 N 人，当前 M 人」「本时段不收儿童/成人」）。
7. **后台**
   - 套餐行加「最少人数」整数输入（复用 `buffetFieldClass`，走现有 `updateBuffetField`）；`parseBuffetUpdatePatch` 白名单加 `min_guest_count`（整数 0–99）。
   - 规则弹窗成人价/儿童价前各加勾选；不勾 → 价格框禁用但保留原值；`BuffetRuleDraft` + 保存校验「至少一个」。
   - 新增一个规则价格格式化函数（关掉的一侧不显示），替换上述 3 处内联 `€x / €y`。
8. **i18n**：`messages`（buffetAdmin）+ `waiter-messages`。
9. **测试**：`buffet-update-patch` 白名单、`buffet-pricing-admin` 规则保存、`waiter-buffet-open-submit` 预检、`buffetGuestCountViolation` 表驱动。
10. **文档**：`docs/agent-sole-index.zh.md` 楼面「开台确认 / 一桌一套餐 / 可开台套餐」小节各补一行（含 PATCH 白名单加字段）；`docs/test-scenarios/2026-11-xx-套餐最少人数和成人儿童开关.md`。

## 4. 流程约束（项目规则）

- 独立 worktree，基于 `main`，独立端口 + `MESA_NEXT_DIST_DIR`；不碰主 checkout。
- 实现后先清冗余扫描，再 UAT（`gate.sh scan` → `uat` → `check`），`uat.md` 带 `## 测试项` + `## 证据`（`gate.sh uat-evidence`）。
- 浏览器 UAT 可交给低档模型子代理执行，主会话只看结果与失败项。
- commit 只在用户要求时；push / merge main 只在用户要求时。

## 5. UAT 清单

1. 套餐最少 2：1 人开台 → 提示原因不开，**桌子仍是空桌**；2 人可开。
2. 已开台详情 / 结账：减到 2 以下被拦并提示。
3. 最少 0：0 人仍可开台（回归）。
4. 规则只勾成人：开台/详情/结账只见成人；直接 POST 儿童 > 0 → 409 `buffet_side_disabled`。
5. 两个都不勾 → 不能保存；DB 直接写也被 CHECK 拒。
6. 改设置后 `buffet_config_version` +1，开台抽屉拿到新最少人数/开关；旧 v2 缓存自动作废。
7. 后台矩阵/列表/预览关掉的一侧不显示价格；小票不出现关掉的一侧。
8. 合并两桌（同套餐）仍正常（回归）。
