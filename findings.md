# 按菜分单跨端审计发现

## 已确认需求基线

- 电脑端需同时支持完整账单自主分单、载入手机端已分方案、部分收款续结、恢复点餐后新增菜的继续分配。
- 按菜票据身份以 `party_id` 为准；姓名可重复。
- 已付票份额与金额冻结；新消费必须进入未付票或新票。
- 单票收款只核验、只写当前票；摘要待收不能夹断单票应收。
- 手机端与电脑端使用不同编辑状态模型，但提交 wire 共用。

## 代码发现

- 手机端主链已定位：`BillPage` → `useBillSplitDraft` → `useGuestByItemSplitState` → `buildSplitPersonsFromAllocations` → `requestCheckoutRequest`。
- 电脑端关键链已定位：`CheckoutRequestDetailHost` / `StaffCheckoutSplitEditor` / `StaffByItemSplitWorkbench`，以及 `checkout-request-server`、`checkout-by-item-collect`。
- 共享续结/锁定逻辑集中在 `checkout-split-continuation.ts`；职员锁票/草稿分层集中在 `by-item-committed-draft.ts` 与 `use-by-item-split-state.ts`。
- 需要特别验证 `existingSplit`、`continuationSplit` 与电脑端请求对象在三类入口下分别取什么数据，而不是只检查组件外观。
- 电脑端编辑器无论来源都把当前 `request` 同时作为 `existingSplit` 与 `continuationSplit` 传入 `useBillSplitDraft`；因此三类入口能否正确工作，关键取决于请求对象的 `split_mode/persons/result` 形状及 hydrate/merge 逻辑。
- 电脑端按菜收款已走独立当前票路径：`resolveByItemCollectTarget` → 冻结当前票份额 → `mergeCurrentByItemTicketForCollect` → `allow_partial_by_item:true` → confirm-payment。
- 完整保存 `persistSplit` 对按菜允许池未分完，并会调用 `applyCollectedObligationFloors`；需验证它是否可能覆盖/重复折扣或破坏已付票。
- 发现一个需验证的金额疑点：工作台的 `resolveByItemCollectTarget` 返回金额随后又进入 `collectSavedPerson`，后者统一调用 `discountedObligationAmount`；必须确认 target 金额究竟是折前 obligation 还是已经扣除历史已收后的“本次应收”，否则部分收款可能被二次折扣或错误折扣。
- 已确认恢复点餐后电脑端呼叫结账的入口不是重新创建 whole-table：`ensureStaffCheckoutEntryForTable` 会查找 `pending|confirmed|requested` 活跃方案并原样 reopen；`staffReopenActivePlan` 专门允许新菜导致的按菜池未分完和总额暂不匹配。这一入口本身符合补充需求。
- 已确认电脑端完整未分单账单由 `whole_table + 零收款` 进入路径选择器，选择“分单”后进入统一编辑器；已是 `even/by_item/custom` 的手机请求直接进入 `split_edit`。
- 已确认手机端与电脑端 hydrate 分离：手机会用服务端 persons 整体重建行；电脑端只把锁票放 committed，未付 persons 作为 seed merge 到本地 draft，以避免 Realtime 覆盖本地编辑。
- 金额疑点升级为高可信漏洞：`resolveByItemCollectTarget` 明确返回“折前 live obligation − 已收”，UI 随后打折形成弹窗金额；确认前却拿未打折的 live target 直接与已打折弹窗金额做分币相等校验。折扣大于 0 时会拒绝按菜收款。现有 helper 单测未覆盖组件层这条折扣链。
- 手机端提交前会权威刷新账单；若发现订单变化会中止提交并更新 orders。这一防旧账提交机制正确。
- 但手机 `useGuestByItemSplitState` 的 hydrate key 包含 `lineSpecs`。新增菜导致 lineSpecs 改变时，它用服务端旧 persons **整体替换**当前本地 allocations；因此顾客在恢复点餐后对旧菜做的未提交修改可能被一次前台同步/提交前同步清空。电脑端的 merge-missing 模型不存在同样覆盖。此项需在报告列为“可复现的数据丢失风险”，并说明精确触发顺序。
- 当前测试覆盖了“手机/电脑编辑器隔离”和电脑端 committed/draft merge，但没有覆盖手机端“有旧 persons + 本地已编辑 + lineSpecs 新增”的重 hydrate 保留行为。
- 已运行 7 组相关测试文件：78 个测试全部通过。这说明现有测试与当前实现一致，但也确认下述漏洞属于“测试未覆盖/测试固化旧规则”，不是已有红灯。
- 服务端续结校验与当前产品定稿冲突：`lockedSharesPreserved` 只要求 incoming qty **不低于**已付 floor；现有单测还明确断言“allows increasing locked guest qty on same line”。这允许调用 API 时继续往已付票追加同菜份额，而定稿要求已付份额精确只读、同人续消费必须新票。前端 UI 通常会阻止，但服务端不守此不变量，手机/电脑任一陈旧或异常客户端都可突破。
- `mergeByItemSplitResultWithLedger`（TS 与最新 SQL 同口径）会丢弃 incoming 中缺失的所有旧票，包括 `paid:true` 的旧票；只有 incoming 仍带该票时才保留已付金额。续结校验只检查 locked persons 份额，不检查 result 必含已付 ticket，因此可构造“persons 保留锁份额、result 缺已付票”的合法请求，造成已付 result 消失、后续 person_index/台账映射错位。这与“已付票不可被后续合并改写/丢失”冲突。
- 按菜 merge 丢弃缺失的**未付**旧票是文档要求（避免幽灵金额）；问题仅在没有区分 paid/locked 旧票。

## 疑点验证表

待补充。
# 2026-09-27：手机端重复选择提示与呼叫结账状态不一致

- 菜品卡片使用原始 `ByItemConsumerRow[]` 调用 `getByItemLineStatusFromRows`，会把“已填姓名但数量为空”的重复行判为 `duplicate_names`。
- 底部按钮使用 `splitValidation`；该值先经 `buildByItemAllocationsFromRows` / `parseConsumerRows` 解析，姓名或有效数量缺一的行被静默丢弃。
- 因此，当第一行已完整覆盖菜品数量、第二行又选中同一人但数量为空/无效时，卡片报重复，解析后的分配仍只有第一行，整单校验为通过，按钮保持可点击。
- 提交前的二次校验仍只校验 committed 后的 parsed allocations，因此会继续忽略该行，请求可能成功提交；这不是单纯按钮样式问题。
- 自助餐路径还有一处相同性质的损失：`getBuffetLineStatusFromShares` 先按姓名聚合，再判断完整性，序列化后的重复来源已不可见。
- 修复应让客户端草稿行校验成为按钮与提交前置条件，并让服务端校验 payload 中同一 line + party 的重复 share；不要只给按钮额外加一个临时 disabled 条件。
