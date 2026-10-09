# 顾客手机按人分单、各自呼叫结账（交接文档）

> 写给后续接手的 agent 或工程师：**不需要看过之前的对话**，读完这一篇就知道为什么做、做成什么样、哪些已经定了、哪些还没定、从哪里开始。
>
> 状态：**已实现，且已改版为「一机一人一票」并去掉开关**（见第 15 节，**以第 15 节为准**；下文 §4.2「一批票」、§5.3 多人编辑、`guest_individual_checkout` 开关、「会话开台时盖章」均已被取代）。餐厅级开关已删除，所有会话一律按票结账、永不进入 `billing`。方案与最初实现的偏差见第 14 节。
> 文档中的结论分「已证实」（读过代码或迁移，附文件位置）和「未证实」（明确标出，开工前要核对）。**未证实的不要当结论用。**

---

## 0. 一句话

让顾客在手机上**各分各的单、各自呼叫结账、互不影响**：A 呼叫结账只锁 A 自己的票和 A 这台手机的点单，桌子不锁，B、C 照常点单、认领、各自呼叫。员工在前台，没收款前仍可随时调整分单。

---

## 1. 背景：为什么做、需求怎么一步步变成现在这样

### 1.1 起点

最初的问题是：**顾客手机分单能不能允许「部分分单提交」？** 现在必须每道菜都分完才能提交。

### 1.2 第一版想法（后来被推翻）

「部分提交」= 呼叫结账，没分的菜由员工在前台继续分（不是整单收），桌子进入结账中，不打印预结账单，提示文案「还有菜品未分配，请到前台继续结账」。

### 1.3 为什么推翻

需求方指出真正的目标是：**每个人分单后各自结账，互不干扰**。第一版的问题是呼叫结账会让**整桌**进入结账中（会话改成 `billing`），其他人就没法再点单、再分单，一个人的操作影响了所有人。

### 1.4 最终方案是怎么逐步定下来的（决策顺序，理解「为什么」用）

1. 目标：分单、各自结账、互不干扰。
2. 需求方补充：单人呼叫结账后**要锁一下**，否则认领会冲突 → 锁的是**这个人的票**，不是整桌。
3. 员工在前台**没收款前随时可以调整分单**，和现在一样 → 顾客锁只对顾客手机生效，员工不受限。
4. 呼叫结账后，这个人**不能继续点单**，进入待结账。
5. 需要继续点单时，可以「恢复点单」，但**只针对这个人**，所以整桌式的恢复机制要改成按票。
6. 已付款的票就结束了，这个人可以继续点单消费，新消费开新票。
7. 付清后再点的菜开**新票**（新 `party_id`）；名字预填可改：sole `resolveGuestClaimPrefillName`（本机上次名字 → 本机会话 `mine` 票名），不复用已结清那张票。
8. 未付清的人（含待结账）**不能重名**；这个机制项目里本来就有，沿用。
9. 通知：有人呼叫，其他手机要更新菜单。先说飘窗，后改成**弹框**。
10. 电脑端的结账原来基于桌状态和 realtime，要核对影响面。
11. 评估风险后，决定**加餐厅级开关 + 分四期**。

### 1.5 被明确否决的方案（不要再提）

| 方案 | 为什么否决 |
|---|---|
| 只放开顾客的「部分提交」，仍整桌锁单 | 一个人呼叫就锁住所有人，达不到互不干扰 |
| 部分提交后剩下的整单收 | 需求方明确是「继续分」，不是整单 |
| 顾客手机直接订阅 `bill_splits` 做实时通知 | 这张表里有别人的名字、金额、税号，匿名顾客不能看 |
| 飘窗做通知 | 需求方改为弹框；也免去抽通用飘窗组件 |
| 用「选名字找回」识别换了浏览器的顾客 | 点别人名字就能冒用，新问题比解决的多 |
| 冲突时自动裁减顾客认领的份数 | 悄悄改数量，顾客可能没注意就被收钱 |
| 为每人建一份独立的计划表 | 会和现有 `bill_splits` 并行，违反项目「一个表示」原则 |
| 夜间自动关台跳过未付清的桌 | 需求方说一般不会挂着，维持现状 |
| 关台前新增「还有 N 份未分配」提示 | 现有关台已按整桌应收减已收判断，不新增 |
| 平均分也做每人独立 | 金额取决于总人数和总额，天生互相牵连，不在范围内 |
| 呼叫前弹「还有菜品未分配，请到前台继续结账」确认框 | 第一版方案里有；按人分单后，只认领自己的菜、菜池有剩余是常态，需求方明确不需要 |

---

## 2. 术语

| 词 | 含义 |
|---|---|
| 票（ticket） | 按菜分单里，一个付款人的认领单。身份以 `party_id` 为准，没有才用名字（`splitPartyKey` / `splitResultTicketKey`）。数据在 `bill_splits.persons` 和 `result[]` |
| 菜池 | 一桌点的所有菜，减去所有票已认领的份数，剩下可认领的 |
| 呼叫结账 | 顾客提交自己的票，表示「我这部分要结了」 |
| 已呼叫 / 待结账 | 票被提交后的状态，对顾客锁定 |
| 按票解锁 / 恢复点单 | 把已呼叫（且没收过款）的票退回草稿，这台手机恢复点单。顾客可以恢复自己的；员工可以解锁任何人的 |
| 手机编号 | `guest_client_id`，存在浏览器 `localStorage`，用来识别「这台手机」 |
| 冻结 | 把票的金额写成 `frozenAmount` / `locked_amount`，之后别人变动不再影响它 |
| 开关 | 餐厅级功能开关，默认关，关时行为与改动前完全一致 |

---

## 3. 现状（已证实，附位置）

### 3.1 分单与提交

- 顾客手机要求每道菜分完、金额之和等于整单才能呼叫：`validateByItemDraftRows`（`apps/web/src/lib/bill-split-validate.ts:26`）、`validateBillSplit`（同文件）。
- 员工端已有「允许部分分单」`allowPartialByItem`，服务端限制只有员工能用：`apps/web/src/app/api/restaurants/[slug]/checkout/request/route.ts:176`。
- 一桌只有一份活跃分单，数据库函数 `upsert_bill_split_request`（最新定义 `supabase/migrations/20260727163000_bill_splits_whole_table_split_mode.sql`），提交是**整份覆盖**，只保留已付款的票；并发时靠唯一冲突回退到更新已有行。
- 提交成功后，会话从 `open` 改成 `billing`（同函数末尾），分单状态为 `requested`。
- 应用层入口：`submitCheckoutRequestForTable`（`apps/web/src/lib/checkout-request-server.ts`）。提交后还会自动调度打印预结账单（`scheduleCallBillPreBillPrint`），可用 `skipAutomaticPreBill` 选项跳过。

### 3.2 顾客手机

- 账单页 `apps/web/src/components/menu/BillPage.tsx`；提交 hook `useCheckoutRequestSubmit`（`lib/use-checkout-request-submit.ts`）；顾客分单编辑状态 `useGuestByItemSplitState`（`lib/use-guest-by-item-split-state.ts`）；账单读模型 `useCustomerBillReadModel`（`lib/use-customer-bill-read-model.ts`）。
- 呼叫成功后 `commitSubmittedCheckout` 把 `submitted` 设为 true，`BillPage` 整页换成 `BillCheckoutSubmittedScreen`（含菜品评价）。
- `submitted` 是否显示由 `shouldShowCheckoutSubmitted` 决定：分单为 `requested` 就显示（`lib/checkout-split-continuation.ts:246`）。**这是整桌语义**。
- 本地草稿保存：`mayPersistBillSplitLocalDraft`（`lib/bill-split-local-draft.ts:183`），遇到分单 `requested` 就停止保存。
- 顾客端合并同步：`reconcileGuestByItemAllocations`（服务端锁定票覆盖进来、本地未付款草稿保留）。
- 按菜分单时，顾客页**不收税号**（`guestBillCollectsCustomerNif` 返回 `splitMode !== 'by_item'`，`lib/checkout-request-submit.ts:17`），税号只在员工收款时填。
- 手机编号：`ensureGuestClientId`（`lib/table-order-round/guest-client.ts`），存 `mesa_guest_client_id_{餐厅}_{桌}`；目前只有寿司轮次用，**普通下单没传**。

### 3.3 点单闸口

所有加菜最终经过同一个函数 `loadAppendWriteContext`（`apps/web/src/lib/append-write-context.ts`），它在会话是 `billing` 时返回 409 `session_billing`。调用点共 3 个：
1. 普通下单（顾客和服务员代点）：`app/api/restaurants/[slug]/orders/append/route.ts`；
2. 寿司轮次提交写入订单：`lib/table-order-round/service.ts`；
3. 寿司轮次所有接口的前置检查：`lib/table-order-round/request-context.ts`（这里有 `guestClientId`）。

菜单页「结账中」提示依赖会话状态：`lib/customer-menu-order-gate.ts`（`guestOrderingEnabled` 只认 `open`）。

### 3.4 改菜、减菜、改人数

- `patchOrderItemsWithVoidAudit`（`lib/order-item-void/patch-order-items.service.ts`）：服务员改订单（`staff/waiter/orders/[orderId]/route.ts`）**和后厨作废菜**（`staff/kitchen/orders/[orderId]/route.ts`）都走这里。
- `decrement-order-item.service`（`lib/order-item-void/`）：服务员减一份。
- 自助餐开台和改人数：`lib/buffet-waiter-pipeline.ts`（会话是 `billing` 时返回 `session_billing`）。
- 现在只有服务员的两个接口在会话是 `billing` 时拦（`sessionIdBlocksWaiterMutation`，`lib/waiter-session-guard.ts`）。**后厨作废菜接口从来没有这个拦截**，即现有的一个洞。

### 3.5 恢复点单

- 只有员工能做，整桌：数据库函数 `resume_table_session_ordering`（`supabase/migrations/20260710120000_resume_ordering_preserve_by_item_split.sql`），应用层 `lib/resume-table-session-ordering.ts`、`lib/use-checkout-resume-ordering.ts`。
- 手机端靠整桌状态判断：会话 `open` 且分单 `confirmed`（`lib/customer-bill-checkout-resume.ts` 的 `detectCheckoutResumedFromBillContext`）。

### 3.6 电脑端

- 结账队列查 `bill_splits.status = 'requested'`（`lib/checkout-requests-queue.ts`）。
- 楼面「待结账」= 有 `requested` 分单**或**会话是 `billing`（`lib/waiter-board-session.ts`、`lib/waiter-table-detail-load.ts`）。
- 实时订阅同时监听 `table_sessions` 和 `bill_splits`（`lib/use-restaurant-realtime-refresh.ts`），员工端 `CheckoutRequestsRealtime` 用 `bill_splits`。**顾客手机不订阅 `bill_splits`**（隐私）；菜单与结账页共用 `CustomerTableSessionRealtime`（本桌 `table_sessions` + `orders`，含员工改人数）门铃 → 权威 GET；进页/回前台仍 reconcile 一次。
- 服务员桌台详情 `components/waiter/WaiterTableDetail.tsx`：`isCheckoutPending`（`requested` 或 `billing`）为真时，**关闭点单抽屉并自动跳转**到结账页或楼面看板。
- 转台并桌接口 `app/api/restaurants/[slug]/staff/waiter/tables/action/route.ts`：并桌被 `tableInActiveCheckout`（`billing` 或有 `requested` 分单）拦；转台只看 `billing`（`tableSessionBlocksWaiterMutation`）。
- 并桌数据库函数（`supabase/migrations/20260812154028_sushi_table_order_rounds.sql`）：两桌都有分单时把 `persons`、`result` 首尾拼接、金额相加；只有一边有时改挂。对按菜多票**不安全**，所以用拦截回避。

### 3.7 关台

- 关台函数 `compute_session_payment_gap`（`supabase/migrations/20260709120000_session_collected_payments_resume_ordering.sql`）：应收 = 本桌所有订单菜价之和；`has_unpaid_split` = 存在状态为 `pending|confirmed|requested` 的分单；`is_unpaid_close` = 有未结分单或差额大于 0。有未付时强制关台需二次确认并填原因（`lib/table-session/close-table-session.service.ts`）。
- 已付清正常关台由最后一笔 `confirm_bill_split_payment` 完成（`close_table_session_settled` 已由迁移 `20261005190000` 删除）。**所以全部付清后 `bill_splits.status` 必须正确转成 `paid`，否则不会自动关台。**
- 夜间自动关台 `lib/auto-close-active-sessions.ts`：05:00（里斯本）强制关闭所有 `open` 和 `billing` 会话，含未付清，历史标 `auto_nightly`。**维持原样，不改。**
- 订单历史里的 `'billing'`（`lib/order-history/close-kind.ts`）是「关台类型」标签，不是会话状态，不受影响。

### 3.8 金额冻结机制

- `stampCollectTicketFrozenAmounts`（`lib/bill-split-by-item.ts`）：收款确认时把这张票每道菜份额的金额写进 `frozenAmount`（存为 `locked_amount`）。
- `allocateLineCentsWithFrozen`：分摊零头时，已冻结的金额原样保留，只把剩余分给未冻结的份额。
- 只有「拆成几分之一」的菜才有零头，整份的菜不受影响。
- 现状缺口：冻结金额**只对已付款行生效**（`bill-split-by-item.ts:477`：`row.paidLocked && row.lockedAmount != null`），已呼叫未付款的票没有冻结。

---

## 4. 新规则

### 4.1 一张票的生命周期

`草稿 → 已呼叫（待结账） → 部分收款 → 已付款（结束）`

| 状态 | 顾客手机 | 员工前台 |
|---|---|---|
| 草稿 | 可认领、可改、可点单。草稿只在本机，别人看不到 | — |
| 已呼叫（未收款） | 票对顾客锁定，这台手机**不能点单**；可「恢复点单」 | 没收款前随时可调整分单（和现在一致）；可「按票解锁」 |
| 部分收款 | 票锁定，不能点单，不能自己恢复，需员工处理 | 继续收款 |
| 已付款 | 票永久冻结；这台手机**自动恢复点单**；再点的菜开**新票** | — |

- **呼叫结账锁票，不锁桌。** 会话保持 `open`，其他人照常点单、认领、各自呼叫。
- 新点的菜只进菜池，不进已锁定的票。
- 付清后开新票：新 `party_id`；名字预填 sole `resolveGuestClaimPrefillName`（本机 `rememberGuestClaimLastName` → 本会话 `mine` 票名，可改）。
- 恢复点单后重新呼叫同一张票，沿用原名，`party_id` 不变，不算重名。
- **解锁（员工按票解锁，或顾客恢复点单）后，票不删除，留在服务端，标记为「未呼叫」。** 它继续占着认领的菜（别人抢不走，手机换浏览器也能恢复内容），但不再算「已呼叫」，不影响 `bill_splits.status`。解锁时清除冻结金额。顾客一直不改的话，由员工在前台处理。
- 呼叫结账必须至少认领一份菜，空票服务端直接拒绝。

### 4.2 谁是「我」

- 以 `guest_client_id` 识别。**服务端按「当前会话 + 手机编号」查票，不信本地标记。** 编号是按桌存的、不按会话，所以必须按会话查，上一餐的呼叫记录不能影响这一餐。
- 关浏览器、关页面后重开能认出。清数据、无痕、换浏览器、换手机认不出，当新顾客处理（可继续点单）。这是**接受的边界**，后果有限：之前认领的菜已在锁定票里，不能被重复认领。
- 一台手机可能代多人（草稿里有多个名字）。顾客侧按「这台手机这次呼叫的这一批票」一起锁、一起恢复；员工侧可单张解锁。批内只要有票已收过款，顾客不能整批恢复。

### 4.3 名字

沿用现有规则：未付清的票不能重名；已付款或已锁定的票不挡名字（靠 `party_id` 区分）。已有机制：同一道菜上同名未付款票报 `duplicate_names`，候选名字下拉隐藏已占用的（`lib/consumer-name-roster.ts`、`lib/bill-split-by-item.ts`）。服务端只在提交事务里加**并发兜底**：同名且不同 `party_id` 的未付清票，拒绝后到者。

### 4.4 冲突处理

- 菜被别人先锁定 / 超额认领 / 名字被占：服务端拒绝，返回明确错误码。
- 手机收到后自动拉一次最新数据（`refreshBill` + `reconcileGuestByItemAllocations`），草稿保留，冲突行标红并显示「仅剩 N 份」。不自动改份数，不自动重提。
- 提交先到先得，最终以服务端合并和校验为准。

### 4.5 金额冻结

- **实际实现：只在收款确认时冻结**（沿用现有 `stampCollectTicketFrozenAmounts`，唯一冻结点）。原方案「呼叫时提前冻结」未落地，原因见第 14 节第 1 条。
- 呼叫时服务端用 `recomputeIndividualTicketAmounts` 按菜池份额重算本票金额存入 `result[].amount`，顾客手机的「待结账」页显示这个已存金额，不再随别人变动重算；收款时员工端仍按份额重算并冻结。
- 员工编辑已呼叫的票（没收款前）不受冻结约束；按票解锁不需要清冻结（呼叫时本来没写）。

### 4.6 其它

- **预结账单：** 每人呼叫都**不自动打印**，员工需要时手动打（用 `skipAutomaticPreBill`）。
- **菜品评价：** 呼叫结账后，在「待结账」页弹出，沿用现有评价组件；评过或跳过后，恢复点单再呼叫不再弹。
- **并桌、转台：** 有已呼叫的票时**都拦截**。转台的前置检查要补上 `requested`（现在只看 `billing`）。并桌的数据库拼接逻辑不改。
- **关台、自动关台：** 不改。
- **未分配的菜：** 不新增提示，沿用关台时的未付二次确认。

---

## 5. 设计

### 5.1 数据

- **`bill_splits.status` 含义：本桌至少有一张已呼叫且未付清的票，或店员已接手结账（`staff_checkout_requested_at` 非空）。** 仍是唯一的桌级标志，只在数据库函数里统一维护：呼叫 → `requested`；最后一张已呼叫票付清或全部被恢复、且店员未接手 → `confirmed`；全部付清 → `paid`。店员接手标记只由 `mark_bill_split_staff_checkout` 写入（楼面「呼叫结账」，或按菜分单收款后仍有菜未分完），只由「恢复点单」清除——否则「票全付清但菜没分完」的桌子既不关台、也不进结账列表。**禁止在应用层随手改。**
- `result[]` 的每张票增加「已呼叫」标记和呼叫它的手机编号。具体字段形态实现时定，并写进 `docs/ai-schema.md`。
- **新增窄表「呼叫通知」：** 只存会话编号、票编号、名字、认领的菜和份数。顾客订阅这张表，**不订阅 `bill_splits`**。权限用 `SECURITY DEFINER` 的会话检查（见第 8 节的坑），按会话过滤。加入实时发布；**店内部署还要加进 `deploy/on-prem/schema/ensure_realtime_publication.sql`**。
- **迁移兼容：** 上线时已是 `requested` 的票一律视为「已呼叫」，不绑定手机，不拦任何手机点单。
- **开关值在开台那一刻记到会话上**，这桌整个用餐过程固定用同一套逻辑；之后开关被切换，只对新开的桌生效，避免用餐中途新旧逻辑混用。
- **通知分两类：** 「呼叫」类（有人呼叫结账）→ 其他手机弹框并刷新；「静默」类（员工收款、解锁、员工改单、顾客恢复点单）→ 手机只刷新数据，不弹框。收款、解锁等也要写通知行，否则手机会一直停在「待结账」，直到顾客手动刷新。
- **手机编号不能泄露给其他手机。** 顾客账单接口会把 `bill_splits` 整行（含 `persons`、`result`）返回给同桌每一台手机，以便叠加已锁定的票。所以「呼叫它的手机编号」**不能存进 `result[]` 或 `persons` 里**，要存在不返回给顾客的地方（例如单独的列或表，只在服务端使用）。编号既是点单拦截的依据，也是顾客自己恢复票的凭证，泄露就能被冒用。

### 5.2 服务端

1. **按票合并提交：** 只写自己的票，别人的票原样保留，已付款票锁定。数据库函数里加行锁；服务端统一校验菜池（所有票认领之和不得超过份数）、名字并发兜底。复用 `mergeByItemSplitResultWithLedger`（TS + SQL，唯一合并入口）。
2. **顾客恢复我的票接口：** 只能恢复自己手机的票，没收过款才允许。
3. **员工写入不受「顾客锁票」限制。**
4. **去掉 `allow_partial_by_item` 只有员工能用的限制**，改为校验本桌当前会话。
5. **加菜闸口：** 在 `loadAppendWriteContext` 加一次「这台手机在当前会话是否有已呼叫且没付清的票」检查，3 个调用点共用。普通下单需把 `guest_client_id` 传过来，复用 `ensureGuestClientId`。
6. **减菜、改菜守卫：** 份数不得低于已锁定票认领总和。三个闸口：`patchOrderItemsWithVoidAudit`（含后厨作废）、`decrement-order-item.service`、`buffet-waiter-pipeline`。复用 `buildLockedPersonLineMins`、`allocationLockedTicketKeys`（`lib/checkout-split-continuation.ts`）。守卫做成**一个共用函数**，不在各接口里各写一份。
7. 新增错误码要接入 `messageForCheckoutRequestError`（`lib/checkout-request-error-message`，错误提示的唯一入口），不要在组件里内联。
8. **已锁定的票，任何顾客请求都不能改。** 不论请求带的手机编号是谁，只要请求里的票 `party_id` 对应的是已呼叫（锁定）的票，顾客写入一律拒绝；只有票的主人通过「恢复」接口才能解锁。防止 A 手机伪造一张带 B 的 `party_id` 的票，把 B 已呼叫的票覆盖掉。
9. **点单拦截只对顾客点单生效，不影响服务员代点**（`orders/append` 里 `waiter_flow` 为真时跳过）。服务员的手机编号如果因为代顾客呼叫结账而绑定了票，不能因此被拦住给别的桌点单。
10. 呼叫、恢复、解锁、收款接口都要幂等（重复点击、重试不产生重复票或重复通知）。
11. ~~解锁、强制改票等员工操作要写审计记录~~ **未做**：现有整桌「恢复点单」也没有审计，新增审计事件会牵动操作记录表约束和列表，留作后续（见第 14 节）。
12. 所有新增文案（提示、弹框、错误提示）要补齐项目现有的三种语言（中文、英文、葡萄牙语）。

### 5.3 顾客手机

- 去掉按整桌 `requested` 显示「已提交」页的逻辑，改为只看「我这批票」的状态。
- 本地草稿保存条件改为按「我自己有没有已呼叫的票」判断。
- 桌上已有分单后，分单方式**只提供「按菜分单」**（`split_mode` 整桌共用，其它方式会触发 `split_mode_locked`），不能只靠服务端报错。
- 「待结账」页：我的票、评价区块、「恢复点单」按钮。
- **通知弹框**（不用飘窗）：标题「呼叫结账」；正文按人分块列出认领菜、份数、金额与每人合计；人多时中间滚动、底栏「知道了」固定；同时多人合并为一个弹窗（按票合入，开着也可追加）；自己呼叫的和已待结账的手机不弹；弹框期间保留输入草稿；同时自动拉最新数据并标红冲突行。恢复点单、员工改单只静默刷新，不弹。通知内容只读 `table_checkout_signals`（呼叫时盖入菜名三语 + 行金额），不依赖点菜页本地解菜名。

### 5.4 员工端

- 服务员桌台详情：`isCheckoutPending` 现在是「`requested` 或 `billing`」。改为：楼面桌卡和结账队列**继续显示「待结账」**；**详情页不再自动跳走、不关闭点单**。这个标志现在有两层意思（有人要结账 / 这桌不能点单），要拆开：「不能点单」只对已呼叫的那台手机生效。
- **按菜分单：** 每个已呼叫的人那一行有「解锁」按钮（只能解锁没收过款的票）。店员接手标记（`staff_checkout_requested_at`）仍在时，结账详情**同时保留**整桌式「恢复点单」（唯一清接手标记的路径）。
- **整桌 / 均摊：** 不写、不认 `bill_split_ticket_calls`；恢复只走 `resume_table_session_ordering`。禁止用「有没有 call 行」把非整菜单当成按票桌。
- 结账队列、楼面「待结账」读 `bill_splits.status`，数据库维护好后基本不用改。
- 关台仍在桌台详情，结账页不放关台。
- 解锁的权限用现有 `can` / `requirePermission`，具体用哪个 capability 实现时选，不新增平行的角色白名单。

---

## 6. 影响面

### 必改

1. 服务员详情页被踢走（5.4）。
2. 顾客页「已提交」页判断：`shouldShowCheckoutSubmitted`（`checkout-split-continuation.ts:246`）。
3. 本地草稿保存条件：`bill-split-local-draft.ts:183`。
4. 减菜、改菜、改自助餐人数守卫（三个闸口）。
5. 加菜入口拦截（一个闸口 `loadAppendWriteContext`）。
6. 分单方式选择只剩按菜。
7. 转台前置检查补 `requested`；并桌保持拦截。
8. 整桌恢复点单改为按票解锁（含 `use-checkout-resume-ordering`、`resolveCheckoutResumeOrderingNameGate` 等，名字检查改为按票）。

### 语义变化，风险较小（需核对）

- 今日「未收」金额 `liveSessionUncollectedAmount`（`lib/checkout-settlement.ts`）：`requested` 时用结账汇总的待收额，公式看起来仍是应收减已收，**需用部分呼叫场景验证（未证实）**。
- `session_billing` 拦截（`waiter-session-guard`、`buffet-waiter-pipeline`、`append-write-context`、`waiter-buffet-open-failure-toast`）：会话保持 `open` 后不再触发，逐个核对使用点。

### 已核对，不受影响

订单历史关台类型与生命周期展示、夜间自动关台、收款付清自动关台（`confirm_bill_split_payment`，只要分单状态正确转为 `paid`）、菜品评价、打印路由、`staff-board`、`dashboard-tables`、菜品历史、桌台删除（它们只把 `open` 和 `billing` 一起当「进行中」）。

---

## 7. 风险与回退

主要风险：
1. 状态标志被约 20 处读取、语义改变，可能漏改。
2. 减菜、改菜撑破已锁定票（涉及收错钱）。
3. 并发（同时呼叫、认领、恢复、收款）。
4. 迁移只能新增、无法回退数据库；店内部署升级周期长（打包、拷到店机）。
5. 多手机、实时通知、并发在本地的验证条件有限。

缓解：
- **餐厅级开关，默认关**，关时行为与现在完全一致。可参照项目现有的功能开关（例如 `menu_flavor_hints_enabled`，默认关；编辑入口 `FeatureFlagsManager` + `PATCH /api/restaurant/features`）。名字建议 `guest_individual_checkout_enabled`（建议值，未定）。开关内新旧逻辑并存是**临时**的，稳定后要清掉旧逻辑，不留两套。
- **分四期**，每期可独立合并、独立验证；先在自己的店试点一两周再开放。
- 先写测试再接前端。

---

## 8. 实现时必须避开的坑（项目已踩过）

- **Realtime + RLS 嵌套 `EXISTS`：** 顾客匿名订阅 `postgres_changes`，如果策略里 `EXISTS (SELECT … FROM table_sessions …)`，会被 `table_sessions` 自己的 RLS 挡成永远不可见——订阅成功但收不到任何数据。必须用 `SECURITY DEFINER` 的会话态检查（参照 `table_session_is_open_or_billing`）。
- **顾客菜单 SSR：** `MenuPage` 引用的 client 模块不能 value-import `@supabase/supabase-js`（只能 `import type`），否则报 `Element type is invalid`。
- **票身份：** 以 `party_id` 为准，没有才用名字（`splitPartyKey`）；`mintSplitPartyId` 是唯一生成入口；线上格式解析用 `parseOptionalPartyId`。不要做「只靠名字认票」。
- **合并唯一入口：** `mergeByItemSplitResultWithLedger`（TS + SQL 必须一致）。不要再写第二个合并函数。
- **错误提示唯一入口：** `messageForCheckoutRequestError`。
- **服务员详情会话写入锁：** 唯一互斥是 `useWaiterDetailSessionBusy`，新增的操作（如按票解锁）要先 `tryBegin`。
- **迁移规则：** 只能新增带时间戳的迁移，**不改已应用的历史**；不削弱 RLS、服务角色、员工鉴权；**未经明确许可不能 `supabase db reset`**。
- **改 schema 必须更新 `docs/ai-schema.md`。**

---

## 9. 分期

1. **数据库和服务端**（开关关，用户无感）：票状态、按票合并、冲突兜底、`bill_splits.status` 维护、（冻结提前已改为只在收款，见第 14 节）、恢复接口、加菜与减菜守卫、转台并桌拦截、测试。
2. **顾客端：** 呼叫不锁桌、待结账页、恢复点单、拉数据标红、评价。
3. **通知：** 通知表、实时订阅、弹框。
4. **员工端：** 详情页不踢走、按票解锁、待结账提示。

### 第一期具体任务（从这里开始）

1. 新迁移：票状态与手机编号、按票合并、名字与菜池并发兜底、（冻结提前已改为只在收款，见第 14 节）、恢复接口、`bill_splits.status` 维护（呼叫 / 恢复 / 部分收款 / 全部付清）。
2. 共用守卫函数：加菜闸口（`loadAppendWriteContext`）、减菜三个闸口、转台并桌拦截。
3. 对应测试（见第 10 节）。
4. 开关与默认关；`docs/ai-schema.md` 更新。

---

## 10. 测试清单

- 按票合并：A、B 同时提交，互不覆盖。
- 菜池超额认领、重名并发，只有先到者成功。
- 冻结（分数份数的菜、**整单打折加部分分单**）：原计划的呼叫时冻结已改为只在收款确认，本项只验证现有收款冻结不受影响；整单打折加部分分单仍待专门验证。
- `bill_splits.status` 流转：呼叫、恢复、部分收款、全部付清、关台（最后一笔 `confirm_bill_split_payment`）。
- 减菜、改人数、后厨作废，低于已锁定认领时被拒绝。
- 所有加菜入口对已呼叫手机的拦截；已付款后自动恢复。
- 并桌、转台在有已呼叫票时被拦。
- 老数据（上线时已是 `requested` 的桌）行为不变。
- 多手机本地 UAT；普通、寿司、自助餐各走一遍。

---

## 11. 未证实 / 还没定（开工前处理）

**未证实（读代码核对）：**
- `session_billing` 拦截的每一处使用点（下单、自助餐开台等）。
- 部分分单加整单打折时，各人应收分摊是否正确（`allocateDiscountedSplitObligations`）。
- 员工代顾客呼叫结账（`ensure-entry`、`ensureStaffCheckoutEntryForTable`）在桌上已有按菜票时，是否保持重开现有计划、不另建整桌分单。
- 评价状态是按会话还是按手机记的；别人后加的菜是否会出现在已评价页面。
- 今日「未收」`liveSessionUncollectedAmount` 在部分呼叫场景下是否正确。
- 寿司轮次拦截已呼叫手机时，转台后篮子和手机编号是否需要跟着走。
- 部分分单时员工手动打印预结账单，内容是否正确（目前按 `bill_split_id` 打，分单里只有已呼叫的票，可能漏掉未认领的菜）。
- 顾客账单接口目前返回的 `bill_splits` 整行里是否已含 `customer_nif` 等不该给其他顾客看的字段（现有行为，需核对）。

**需求方未决事项：** 无。（呼叫前「还有菜品未分配，请到前台继续结账」的确认弹窗，需求方已明确**不需要**，见第 1.5、12 节。）

---

## 12. 决策记录

| 问题 | 决定 |
|---|---|
| 呼叫后锁什么 | 锁自己的票和这台手机的点单，不锁桌 |
| 呼叫后能否点单 | 不能；可「恢复点单」；已付款自动恢复 |
| 员工能否调整 | 没收款前随时可调整，和现在一致 |
| 员工整桌恢复点单 | 去掉，改按票解锁 |
| 名字规则 | 沿用现有，只加并发兜底 |
| 通知形式 | 弹框，不用飘窗；用窄通知表，不暴露 `bill_splits` |
| 预结账单 | 每人呼叫都不自动打印 |
| 菜品评价 | 呼叫后在待结账页弹出 |
| 未分配的菜提示 | 不新增，沿用关台时的未付确认 |
| 呼叫前的「还有菜品未分配」确认弹窗 | 不需要，呼叫直接提交 |
| 自动关台 | 维持原样 |
| 并桌转台 | 有已呼叫票时都拦截 |
| 范围 | 只做按菜分单，所有点单模式通用 |
| 冻结 | **实际只在收款确认冻结**（呼叫时写冻结会让员工编辑器把票当只读，见第 14 节） |
| 解锁后的票 | 不删除，留在服务端标「未呼叫」，继续占着菜 |
| 开关的生效范围 | 开台时记到会话上，用餐中途切换只对新开的桌生效 |
| 收款、解锁后手机如何更新 | 也写通知行，类型为「静默」，只刷新数据不弹框 |
| 手机编号 | 不得出现在返回给顾客的数据里 |
| 交付 | 餐厅级开关默认关，分四期 |

---

## 13. 工作规则（接手前读）

本仓库的工作规则以 `AGENTS.md`（即 `CLAUDE.md`）和 `.cursor/rules/` 为准，这里只摘本任务相关的：

- **先分析后改代码**：分析已完成并经需求方确认（见 `.cursor/rules/analysis-before-code.mdc`），可以按本文档实现；遇到本文档没覆盖的行为变化，仍要先停下来问。
- **只做最终形态**，不留「补丁 + 以后再清」的并行实现（`.cursor/rules/best-practice-not-patches.mdc`）。
- 从 `main` 开分支，用自己的 worktree 和端口：`:3000` 只留给本地 `main`，测试用 `3002+` + `MESA_UAT_BASE`，另起 web 要设 `MESA_NEXT_DIST_DIR=.next-uat`（不要写默认 `apps/web/.next`）。**占用中的端口不要 kill。**
- 实现后、UAT 前先**清冗余**（`.cursor/rules/redundancy-cleanup-before-uat.mdc`）；改行为必须通过本地产品 UAT（`mesa-local-product-test`）。
- 门禁：提交前 lint + typecheck（`bash scripts/agent-gates/gate.sh check`），push 前生产构建加定向测试（`gate.sh build`，逻辑改动用 `node --import tsx --test …`）。
- **不要擅自 commit / push / 开 PR**，用户要求才做。
- 中文措辞要准确，不要用「大概、多半」下结论，未证实的明确写「未证实」（`.cursor/rules/evidence-based-conclusions.mdc`、`accurate-zh-wording.mdc`）。


---

## 14. 实现与方案的偏差、验证与代码地图（已实现）

### 偏差

1. **呼叫时不提前冻结金额。** 现有系统把「票上带 `locked_amount`」当作「这张票已锁定」（`allocationLockedTicketKeys` 把它和已付款同样处理，员工编辑器会把它当只读）。呼叫时写冻结会让员工没法在前台调整已呼叫的票，和「没收款前随时可调整」冲突。因此冻结只留在收款确认（原方案的备选）。窗口影响：仅「拆成几分之一」的菜在收款前可能差 1 分钱，收款时按冻结值收。
2. **解锁不写审计。** 与现有整桌恢复点单一致；新增审计事件要改操作记录约束和界面，另行处理。
3. **菜单页的呼叫弹框不带菜品明细**（菜单页没有该会话的账单行名称映射）；账单页弹框带明细。
4. **菜品评价按会话记**（`loadDishFeedbackState(sessionId)`），不是按手机：同桌任一人评价或跳过后，其他人的待结账页不再弹评价。
5. **后厨作废被已呼叫票占用时，只有通用失败提示**；服务员端减菜有专门提示（`claimedByTicket`）。服务端接口都返回 `claimed_by_ticket`。
6. **顾客手机进入 individual 会话的账单页时，先等一次带手机编号的读取再渲染**（避免已呼叫的手机先闪出可编辑页）。读取失败会放行（服务端写入口仍然拦截）。
7. 员工编辑器里已呼叫的票**不是只读**；「解锁」放在按菜分单工作台「当前人份额」的收款按钮旁，以及待收列表每人一行。

### 数据库

迁移 `supabase/migrations/20261005120000_guest_individual_checkout.sql`：`table_sessions.individual_checkout` 与开台触发器；会话永不进入 `billing`；`bill_splits.revision`；`bill_split_ticket_calls`（仅 service_role）；`table_checkout_signals`（匿名只读 + 实时）；`individual_checkout_apply`；`bill_splits_individual_sync` 触发器统一维护票状态与 `bill_splits.status`（员工整份写入、收款、恢复等所有写入者）。

### 关键代码位置

| 能力 | 位置 |
|---|---|
| 纯规则（合并、重名、超额、空票、只读键、占用） | `apps/web/src/lib/individual-checkout.ts` |
| 服务端呼叫/解锁/读取 | `apps/web/src/lib/individual-checkout-server.ts`、`checkout/request`、`checkout/individual-unlock`、`checkout/unlock-ticket` |
| 加菜闸口 | `append-write-context.ts`（`orders/append`、寿司轮次） |
| 减菜守卫 | `individual-claim-guard.ts`（`patch-order-items.service`、`decrement-order-item.service`），自助餐人数 `buffet-paid-headcount-floor.ts` |
| 顾客账单页 | `BillPage.tsx`、`use-customer-bill-read-model.ts`、`use-checkout-request-submit.ts`、`BillCheckoutSubmittedScreen.tsx` |
| 菜单页占用 | `use-individual-checkout-hold.ts`、`customer/individual-hold`、`customer-menu-order-gate.ts` |
| 实时通知弹框 | `use-individual-checkout-signals.ts`、`IndividualCheckoutNotice.tsx`、`individual-call-notice.ts` |
| 员工端 | `staff-ticket-unlock.ts`、`StaffByItemSplitWorkbench.tsx`、`CheckoutRequestDetail.tsx`、`WaiterTableDetail.tsx`（`checkoutRequestLocksTable`） |
| 转台并桌 | `staff/waiter/tables/action/route.ts`（`tableInActiveCheckout`） |

### 验证（本地，`:3002`，白云测试店 A-12）

- 单元测试：`npm run test:unit`（含 `individual-checkout`、`individual-call-notice`、`individual-claim-guard`、`staff-ticket-unlock`、`bill-split-draft` 新增用例）。
- 数据库层：回滚事务脚本覆盖呼叫、他人改票、过期 revision、解锁、状态维护、旧写入者不进 `billing`。
- 接口层场景（S0–S10，100+ 条断言）：旧会话不变；呼叫不锁桌；超额/重名/伪造/空票/非按菜；占用只拦本手机、服务员代点不受影响；解锁与状态；减菜守卫；转台并桌拦截；队列带票状态且不含手机编号；收款后状态与占用；全认领全付清后关台；开关中途切换；寿司轮次入口；员工 `ensure-entry`。
- 浏览器：手机视口走完分单→呼叫→待结账页→菜单页占用提示与 toast→恢复点单→他人呼叫的弹框（被动页）→待结账手机不弹框→员工解锁→服务员详情不被踢走→功能开关页；旧会话回归。
- **未能证明的一项：** 浏览器窗格被应用隐藏时（`visibilityState=hidden`）实时订阅不投递（设计如此，页面可见时才订阅），所以「员工收款后被动页面自动刷新」这条在隐藏窗格下只验证了「重新打开后状态正确」；呼叫弹框的实时投递是在窗格可见时验证过的。

---

## 15. 改版：一机一人一票、去掉开关（当前形态）

需求方决定：分单只让**本机认领自己的菜**，不再支持同一台手机替多人分单；想替全桌付款的人自己认领全部菜即可（有「全部认领」按钮）。同时去掉开关，当作全新系统，不考虑存量会话。

### 形态

- 顾客账单页顶部**先填一次名字**（必填，呼叫后锁定；未呼叫时可改），再逐道菜填「我吃几份」，然后「呼叫结账」。
- 份数保留分数份（整份 + 分子/分母，复用 `ByItemQtyInput`）；自助餐人头类改成「我是几个大人 / 小孩」两个数字框。
- 别人的票（已呼叫 / 别的手机已占用 / 已付款）是菜池上的只读叠加：认领页「其他人已认领」按人分块只读列出（`guestOthersClaimBlocks`）；菜卡只显示剩余/超额，别人认完且本机未认的菜不再出现在可编辑列表（`guestClaimLineEditableVisible`）。超出剩余份数标红并禁用呼叫。
- 付清后再点的菜开**新票**：新 `party_id`；名字预填 sole `resolveGuestClaimPrefillName`（本机上次名字 → `mine` 票名，可改）。
- 员工桌台详情里的「呼叫结账」不变（`ensure-entry`，整桌或已有分单原样提交）。员工点单页底部的「查看账单」（`from=waiter`）只读：只展示账单明细，不渲染编辑器，也不提供呼叫。
- 换浏览器 / 清缓存认不出自己之前已解锁的票时，新票同名会报「名字已被本桌使用，请换一个名字，或请员工协助」。

### 取代了什么

| 旧 | 新 |
|---|---|
| 开关 `guest_individual_checkout`，开台时写 `table_sessions.individual_checkout` | 无开关；列与开台触发器已删除；`table_sessions_never_billing` 无条件把 `billing` 改回 `open`（`billing` 状态值本身保留，读取点未动） |
| 一台手机多张票（一批一起锁 / 恢复） | 一台手机一张票：`validateIndividualCall` 要求恰好一张（`invalid_ticket`） |
| 顾客端多人编辑（`ByItemDishAllocator` / `ConsumerNameCombobox` / 展开卡片 / `useGuestByItemSplitState` / `reconcileGuestByItemAllocations`） | `GuestClaimPanel` + `GuestClaimDishCard` + `useGuestClaim` + 纯逻辑 `lib/guest-claim.ts`（草稿本机存 `mesa:guest-claim:{餐厅}:{会话}`） |
| `useCheckoutRequestSubmit`（含整桌 / 员工跳转 / 暂存） | `useGuestCallCheckout`（只发本机这一张票） |
| 顾客页的整桌 / 平均分入口 | 顾客页只有按菜认领；整桌付款 = 认领全部菜 |

### 代码地图（新增 / 改动）

| 能力 | 位置 |
|---|---|
| 单人认领纯规则（菜池叠加、可认领量、超额、重名、我的票金额、全部认领、从服务端票还原） | `apps/web/src/lib/guest-claim.ts`（测试 `guest-claim.test.ts`） |
| 认领状态（服务端已解锁票 → 本机草稿 → 新票；付清后换新票） | `apps/web/src/lib/use-guest-claim.ts` |
| 呼叫 | `apps/web/src/lib/use-guest-call-checkout.ts` |
| UI | `components/menu/GuestClaimPanel.tsx`、`GuestClaimDishCard.tsx`、`BillPage.tsx`（顾客页 + 员工只读页） |
| 去开关迁移 | `supabase/migrations/20261005180000_guest_checkout_always_per_ticket.sql` |
| 唯一的桌锁规则 | `lib/waiter-board-session.ts` 的 `isCheckoutPending`（只认 `billing`，呼叫结账不锁桌） |
| 服务端校验 | `lib/individual-checkout.ts`（一张票、菜池、重名）、`individual-checkout-server.ts`、`checkout/request` 路由（顾客一律走按票呼叫） |

### 验证

见第 16 节（本地 UAT 记录）。
