# 按菜分单：电脑端与手机端跨端逻辑审计

> 审计日期：2026-09-27  
> 范围：电脑端自主分单、手机端提交分单请求、部分收款、恢复点餐后新增菜与再次呼叫结账。  
> 性质：代码审计与风险清单；本次未修改业务代码。

## 1. 需求理解

电脑端结账页必须统一承接以下入口，而不是只处理一种“已完成分单”：

1. **完整账单、尚未分单**：电脑端从整桌账单进入自主分单，对完整账单选择均摊、按菜或自定义。
2. **手机端已分好、尚未收款**：直接载入顾客提交的 `persons/result`，允许电脑端继续调整并逐票收款。
3. **已经部分收款**：保留收款台账；已付票的身份、份额与金额冻结，未付票和新增菜继续编辑。
4. **恢复点餐后再次由电脑端呼叫结账**：重新打开原分单方案；旧方案可能只覆盖旧菜，新菜先进入剩余池，再由电脑端完成分配和收款。

手机端与电脑端可以使用不同的编辑状态模型，但最终必须遵守同一组服务端不变量：

- 票据身份以 `party_id` 为主，姓名只用于显示并允许重复。
- 已付票份额和金额精确冻结，不能向已付票继续叠菜。
- 缺失的未付旧票可以删除，已付旧票不能被删除。
- 单票收款只核验、只写当前票。
- 恢复点餐不能清空历史收款，也不能把保留的分单方案改成整桌结账。

## 2. 总结

当前代码已经覆盖了三个主要电脑端入口，尤其是“恢复点餐后由电脑端再次呼叫结账”已经会 reopen 原方案，而不是错误创建 `whole_table`。

本次发现 **4 项逻辑问题**：

| 编号 | 严重度 | 端 | 结论 |
|---|---|---|---|
| BYI-01 | 高 | 电脑端 | 有折扣时，按菜单票收款会在确认前使用不同金额口径比较，正常收款会被拒绝。 |
| BYI-02 | 高 | 服务端 / 两端 | 服务端只校验已付份额“不减少”，仍允许继续往已付票增加同菜份额，与精确冻结规则冲突。 |
| BYI-03 | 高 | 服务端 / 两端 | incoming `result` 缺少旧已付票时，merge 会直接删除该已付票，可能造成台账 `person_index` 错位。 |
| BYI-04 | 中 | 手机端 | 新菜同步改变 `lineSpecs` 时，手机编辑器会用服务端旧快照整体重建 allocations，可能清空尚未提交的本地调整。 |

此外存在明显的端到端测试缺口：现有相关测试 78 个全部通过，但没有覆盖以上 4 条跨组件/跨层链路。

## 3. 已确认正确的主流程

### 3.1 电脑端完整账单自主分单

- `whole_table + 零收款` 会进入路径选择器。
- 选择“分单”进入 `split_edit`。
- 选择按菜后使用员工专用 `StaffByItemSplitWorkbench`，不是手机端逐菜卡片组件。
- 第一张真实票写入时会移除 whole-table sentinel。

证据：

- `resolveCheckoutDetailPhase`：`apps/web/src/components/dashboard/checkout/checkout-detail-phase.tsx:11`
- 电脑端分单编辑器：`apps/web/src/components/dashboard/checkout/StaffCheckoutSplitEditor.tsx:111`
- whole-table sentinel 替换：`apps/web/src/lib/checkout-by-item-collect.ts:218`

### 3.2 手机端已分好单的请求

- 手机端提交链为：`BillPage` → `useGuestClaim`（一机一人一票）→ `buildMyTicket` → `useGuestCallCheckout` → checkout request（顾客手机不再走 `useBillSplitDraft`）。
- 电脑端将请求本身作为 `existingSplit/continuationSplit` hydrate。
- 未付 persons 会进入电脑端 draft；已锁票进入 committed，避免 Realtime 覆盖本地未付编辑。

证据：

- 手机端 hook 入口：`apps/web/src/components/menu/BillPage.tsx:163`
- 手机端编辑器：`apps/web/src/lib/use-guest-by-item-split-state.ts:30`
- 电脑端 committed/draft：`apps/web/src/lib/use-by-item-split-state.ts:47`

### 3.3 部分收款与恢复点餐后电脑端呼叫结账

- 楼面再次呼叫结账会查找 `pending|confirmed|requested` 的活跃方案。
- 找到保留方案时 reopen 原 `split_mode/persons/result`；只有完全不存在活跃方案时才创建 whole-table。
- `staffReopenActivePlan` 允许旧按菜方案暂时不覆盖新菜，也允许 result 暂时不等于新账单总额。
- 部分池收款时 `shouldHoldCheckoutSessionOpen` 会避免尚未分完就提前关台。

证据：

- 活跃方案查找：`apps/web/src/lib/checkout-active-bill-split.ts:32`
- reopen：`apps/web/src/lib/checkout-request-server.ts:269`
- reopen 放宽：`apps/web/src/lib/bill-split-validate.ts:51`
- 未分完保持开台：`apps/web/src/lib/checkout-confirm-payment.ts:118`

## 4. 漏洞清单

### BYI-01：折扣下电脑端按菜收款金额口径不一致

**严重度：高**

#### 触发条件

1. 账单设置了大于 0 的折扣。
2. 电脑端在按菜工作台点击某票“收款”。
3. 在弹窗中确认付款。

#### 当前调用链

1. `resolveByItemCollectTarget` 返回：

   ```text
   折前 live obligation − 当前票历史已收
   ```

2. `collectSavedPerson` 再对该金额应用折扣，形成弹窗金额。
3. 确认时 `persistCollectTicket` 重新调用 `resolveByItemCollectTarget`，得到未打折金额。
4. `collectModalAmountStillValid` 直接比较“未打折 liveTarget”与“已打折 modalAmount”。

例如：票面 €100、折扣 10%，弹窗为 €90，但确认前比较的是 €100 与 €90，校验失败。

#### 代码证据

- target 语义：`apps/web/src/lib/checkout-by-item-collect.ts:142`
- 弹窗前应用折扣：`apps/web/src/components/dashboard/checkout/StaffCheckoutSplitEditor.tsx:577`
- 确认前比较未打折 target 与弹窗金额：`apps/web/src/components/dashboard/checkout/StaffCheckoutSplitEditor.tsx:453`
- SQL 的正确口径是“先折扣 obligation，再减历史已收”：`supabase/migrations/20260925223000_collect_payment_lines_buffet_vat.sql:166`

#### 影响

- 有折扣的按菜票无法正常确认收款。
- 如果未来允许同一票多次收款，现有客户端顺序还会把历史已收也再次参与折扣，进一步造成少收。

#### 建议修复方向

建立唯一 helper，直接返回：

```text
本次应收 = discountedObligationAmount(折前票应付, discountRate) − 当前票历史已收
```

打开弹窗与确认前校验必须调用同一个 helper；不要在外层对 outstanding 再打折。

---

### BYI-02：服务端允许向已付票增加份额

**严重度：高**

#### 当前行为

服务端续结校验 `lockedSharesPreserved` 对普通菜使用 `incomingQty >= lockedQty`，对自助餐使用 incoming 成人/儿童数不低于已锁人数。

这只能防止减少或转走已付份额，却允许：

- 已付票原来有某菜 1 份，incoming 改成 2 份。
- 已付自助餐票原来 1 成人，incoming 改成 2 成人。

现有单测甚至明确写成“allows increasing locked guest qty on same line”。

#### 与需求冲突

当前定稿要求：

- 已付份额精确只读。
- 不能往已付票继续叠菜。
- 同人续消费必须新开票，可以同名，但必须使用新的 `party_id`。

#### 代码证据

- 普通菜只做 `rationalGte`：`apps/web/src/lib/checkout-split-continuation.ts:542`
- 自助餐只做下限比较：`apps/web/src/lib/checkout-split-continuation.ts:563`
- 固化旧规则的测试：`apps/web/src/lib/checkout-split-continuation.test.ts` 中搜索 `allows increasing locked guest qty on same line`
- 前端 UI 已经按精确只读处理 `paidLocked`，说明前后端不变量不一致：`apps/web/src/lib/checkout-split-continuation.ts:332`

#### 影响

- 正常 UI 通常能挡住，但服务端 API 没有守住核心财务不变量。
- 陈旧客户端、竞态或构造请求可以把新消费叠进已付票。
- 已付票 amount 又受冻结保护，份额与金额可能出现互相矛盾。

#### 建议修复方向

- 对真正 paid/`locked_amount` 的行做精确份额相等校验，不再使用 floor。
- 新增消费必须使用新的 `party_id` 和新行。
- 保留 floor 模式只能用于明确的遗留数据兼容分支，不能作为当前票据规则。

---

### BYI-03：incoming 缺票时可以删除旧已付 result

**严重度：高**

#### 当前行为

TS 和 SQL 的 `mergeByItemSplitResultWithLedger` 都按如下方式合并：

1. 遍历 existing result。
2. 在 incoming 中找同一 ticket。
3. 找不到就 `continue`，即丢弃旧行。
4. 找到且 paid 时，才保留旧 amount。

“丢弃 incoming 已不存在的未付旧行”是合理需求；漏洞在于它没有区分未付与已付，导致 paid 旧票也能被删除。

#### 为什么服务端校验挡不住

- `validateCheckoutContinuation` 对 by-item 只检查 incoming `persons` 是否保留 locked shares。
- 它没有验证 incoming `result` 必须包含所有已付 ticket。
- 因此可提交“persons 仍有锁定份额、result 删掉已付票”的请求。

#### 代码证据

- TS merge 找不到 incoming 直接丢行：`apps/web/src/lib/bill-split-result-merge.ts:44`
- SQL 同样找不到直接 continue：`supabase/migrations/20260926142000_by_item_merge_preserve_paid_amount.sql:47`
- 续结校验只核 persons：`apps/web/src/lib/checkout-split-continuation.ts:601`

#### 影响

- 已付票可能从 `bill_splits.result` 消失。
- 后续结果数组下标改变，而历史台账仍用原 `person_index`，可能映射到错误的人。
- 锁票、已付标记、打印和再次收款判断都可能被连带破坏。

#### 建议修复方向

- merge 时：incoming 缺失的未付旧票可删；incoming 缺失的 paid/ledger-locked 旧票必须原位保留。
- 服务端 continuation 额外校验：所有 locked ticket key 必须同时存在于 incoming persons 与 result。
- 增加同名不同 `party_id`、删除 paid ticket、删除 unpaid ticket三组对照测试。

---

### BYI-04：手机端新增菜同步可能清空未提交分单修改

**严重度：中**

#### 触发顺序

1. 已有按菜方案恢复点餐，手机账单页 hydrate 服务端 `persons`。
2. 顾客在手机上修改旧菜归属，但尚未提交。
3. 同桌又新增菜，或页面回前台触发完整账单同步。
4. 新菜使 `lineSpecs` key 集合发生变化。
5. 手机编辑器的 `hydrateKey` 随 `lineSpecs` 变化。
6. hydrate effect 用服务端旧 `persons` 整体重建并替换 `byItemAllocations`，本地未提交修改被覆盖。

提交前同步虽然会发现账单变化并中止旧账提交，这是正确的；但 orders 更新后会触发上述整体 hydrate，所以用户回到页面时可能发现刚才的分配已丢失。

#### 代码证据

- hydrate key 包含 `lineSpecs`：`apps/web/src/lib/use-guest-by-item-split-state.ts:90`
- hydrate 后整体 `setByItemAllocationsState(...)`：`apps/web/src/lib/use-guest-by-item-split-state.ts:95`
- 提交前发现订单变化会 commit 新 orders 并中止：`apps/web/src/lib/use-guest-call-checkout.ts`（`resolveFreshBill`）
- 电脑端采用 merge-missing、保留本地 draft：`apps/web/src/lib/use-by-item-split-state.ts:119`

#### 影响

- 恢复点餐后多人同时操作时，手机端可能丢失尚未提交的分单编辑。
- 本地草稿也不能可靠恢复：已有服务端 persons 时，本地 by-item 草稿恢复会主动让位于服务端快照。

#### 建议修复方向

- 手机端仍保持独立编辑器，但同步时改成三方 reconcile：锁定服务端行覆盖、本地未付编辑保留、新 line 只追加默认槽。
- 至少不要因为纯 `lineSpecs` 扩展而整体替换旧行。
- 对账单减少/作废菜品需要单独定义删除策略，不能简单复用“追加新菜”。

## 5. 测试缺口

现有相关测试运行结果：**78/78 通过**。通过的测试主要验证 helper 内部行为，尚缺以下跨层场景：

1. 折扣 > 0 的电脑端按菜：点击收款 → 弹窗 → 当前票 upsert → confirm-payment。
2. 恢复点餐 + 部分收款 + 新菜未分配 → 电脑端 ensure-entry → 打开工作台 → 分新菜 → 收款。
3. 已付 ticket 的 incoming qty 增加应被服务端拒绝。
4. incoming result 删除已付 ticket 应被服务端拒绝或 merge 原位保留。
5. 手机端已有 persons、本地修改旧菜、同步新增 line 后，本地修改仍保留。
6. 同名不同 `party_id` 在以上所有场景中仍保持两张独立票。
7. 普通菜：第一行已分完，新增第二行只选择同一人、不填数量时，卡片错误与底部按钮状态必须一致。
8. 自助餐：同一 `party_id` 在同一道菜出现两行时，客户端与服务端都必须拒绝提交。

## 5.1 BYI-05：手机端显示“重复选择同一人”，但“呼叫结账”仍可点击

**结论：确认存在校验分叉。** 这不是单纯的按钮视觉问题；在特定输入下，点击后提交链路也会把报错的编辑行静默丢弃，并可能成功创建结账请求。

### 可稳定触发的场景

1. 某普通菜数量为 1，第一行已填写“客人 A / 数量 1”，该菜已完整分配。
2. 点击“添加消费者”，第二行再次选择“客人 A”，但第二行数量为空或无法解析。
3. 菜品卡片显示“同一人不能在同一道菜重复出现”。
4. 底部“呼叫结账”仍可能保持可点击；点击时第二行不会进入提交 payload。

### 根因链路

界面实际上使用了两套粒度不同的校验：

- **菜品卡片校验原始编辑行。** `getByItemLineStatusFromRows` 会收集所有有姓名的行并按 `party_id`（无 id 时按规范化姓名）检查重复，因此即使第二行没有有效数量，也会报 `duplicate_names`（`apps/web/src/lib/bill-split-by-item.ts:610-637`）。
- **按钮校验解析后的计费 shares。** `parseConsumerRows` 对姓名为空或数量无法解析的行直接 `continue`，即静默丢弃（`apps/web/src/lib/bill-split-by-item.ts:396-413`）；`buildByItemAllocationsFromRows` 只把这些解析结果交给整单校验（同文件 `1037-1051`）。
- `validateBillSplit` 只对 parsed shares 调用 `getByItemLineStatusFromShares`（`apps/web/src/lib/bill-split-validate.ts:67-82`）。如果第一行已经覆盖完整数量，被丢弃的第二行不再可见，于是返回 `ok: true`。
- “呼叫结账”按钮及点击处理都只依赖这个 `splitValidation.ok`（`apps/web/src/components/menu/BillPage.tsx:279-296, 635-647`），所以与菜品卡片的红色状态不一致。
- 提交前虽有二次校验，但 `resolveSplitDraftInputForSubmit` 仍把 committed rows 再解析为 shares（`apps/web/src/lib/use-bill-split-draft.ts:628-645`），随后 `validateSubmitSplitDraft` 校验的仍是 parsed 数据。因此该无效重复行会被忽略，而不是阻止提交。

自助餐还有一个相关缺口：`getBuffetLineStatusFromShares` 先按姓名聚合 shares，再判断份数是否完整（`apps/web/src/lib/bill-split-by-item.ts:533-549`）。一旦进入 parsed 层，重复行的来源边界已经丢失，更不能依赖该层完整表达编辑错误。

### 影响判断

- **数据金额通常不会重复计算**：空/无效数量行被丢弃，真正提交的是第一行。
- **但用户意图可能被静默篡改**：界面明确报错，系统却允许继续，并在提交时忽略用户可见的一行。
- 这会让用户误以为重复选择被接受或系统已自动合并；恢复页面后该行可能消失，进一步造成困惑。
- 若未来更多行级规则只存在于 rows 层，同类问题会继续出现。

### 推荐修复方案

1. **建立统一的草稿行校验结果。** 新增例如 `validateByItemDraftRows(lineSpecs, rowsByKey)`，逐菜调用 `getByItemLineStatusFromRows`，明确返回 `duplicate_names`、`missing_names`、`invalid_qty`、`short/over` 等问题。
2. **按钮与卡片消费同一个结果。** `useBillSplitDraft` 的最终 `splitValidation` 应先检查原始 rows，再做金额/parsed shares 校验；只要页面显示阻断性错误，按钮必须禁用。
3. **提交时再次校验 committed 原始行。** `commitAllByItemAllocations` 后，先对 `committed` rows 做同一校验，再构造 persons/result，避免实时校验与 blur/commit 后状态不同。
4. **服务端补结构性兜底。** 对 payload 中同一 `line key + party_id + guest_type` 的重复 share 明确拒绝；无 `party_id` 的兼容数据才回退到规范化姓名。服务端无法看到客户端已经丢弃的空行，但应防止可序列化的重复条目进入账本。
5. **不要只修改按钮 `disabled`。** 单独增加按钮条件会漏掉程序化提交、提交前 fresh-bill 重算及其他调用入口；校验必须进入共享 domain helper。

### 建议验收用例

- 普通菜完整分配后，新增“同人 + 空数量”：显示重复错误、进度不完整、按钮禁用、提交函数拒绝。
- 普通菜两行“同人 + 有效数量”：客户端拒绝；绕过客户端构造 payload 时服务端也拒绝。
- 自助餐两行同一 `party_id`：无论成人/儿童组合，均不能通过。
- 同名但不同已锁定 `party_id`：保持为两张独立票，不应按显示名误判。
- 删除重复行后：卡片、进度、按钮在同一 render 中恢复为可提交。
- 提交前 blur/commit 改写数量后：以 committed rows 的统一校验结果为准。

## 6. 建议处理顺序

1. **先修 BYI-01**：它会直接阻断有折扣的正常收款。
2. **再修 BYI-02 与 BYI-03**：两者是服务端财务不变量，必须由服务端兜底，不能只依赖 UI。
3. **最后修 BYI-04**：先补可重复 hook/组件测试，再调整手机端 reconcile，避免重新引入无名槽或同名票问题。
4. 为用户列出的四类入口建立一张端到端场景矩阵，后续按矩阵做回归，而不是继续只补单个 helper 测试。

## 7. 本次未发现问题但应保留的设计

- `ensureStaffCheckoutEntryForTable` reopen 活跃方案，禁止在保留分单旁再 mint whole-table。
- 电脑端使用 locked committed + unpaid draft，手机端使用独立 guest editor。
- 单票确认走 `allow_partial_by_item:true`，不要求当前 result 合计等于整桌。
- 单票确认只 merge 当前 ticket，不再执行整桌重算。
- `party_id` 优先于姓名；同名不同票可以并存。
- 部分按菜池未分完时保持 session open。
