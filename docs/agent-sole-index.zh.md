# Agent sole 索引（按域）

> 从 `AGENTS.md` Retrospectives 拆出。改某域产品代码前，**只读该域小节**；不要整篇灌进上下文。
> 新条目规则：同一 agent 错误被 Will 抓到**第二次**才追加一行到对应域；禁止把一次性失误堆进 `AGENTS.md` 正文。

导航：`AGENTS.md` → Checks / Retrospectives 指针；本文件是 sole 细则正文。

## 流程 / 门禁 / Git / 证据

### Commit without lint+typecheck

never — sole runner `scripts/agent-gates/gate.sh check` (policy in `scripts/agent-gates/README.md` + Checks above; production build paused on push — pack/on-prem still may build).

### Evidence, not fortune-telling

never present 多半/应该是/大概 as root cause; conclusions need checkable evidence (code/DB/log/repro); label gaps as 未证实 — see `.cursor/rules/evidence-based-conclusions.mdc`.

### Chrome / top-bar layout UAT

presence of copy or a CSS class is not enough — screenshot the bar and assert the new control shares the designed row/alignment with neighbors (e.g. same vertical mid as the account menu); stretched flex items with top-aligned text will look like a second row.

### 顾头不顾腚

before “不用改 / 不用 push / 只重试某一步”, check the **whole producer→consumer path on what is actually running** (caller expectations vs deployed callee; local branch ahead of `origin`/prod = gap). Do not answer from one step’s happy path while the other side’s live contract is unverified.

### 顾头不顾腚 (protocol/deploy)

before “不用 push / 再签码即可”, verify the **full producer→consumer contract on what is actually deployed** (e.g. store build expects `leaseSecret` in claim JSON ⇒ `origin/main` + live Ops must already return it); local `main` ahead of `origin` is a deploy gap, not “recovery needs no Ops change.”

### Workspace root / 切分支

开发期切分支、进 worktree、合进 main **一律 shell**（`git checkout` / `worktree add|remove`）；**不要**为“切过去”调 `move_agent_to_root` / `move_agent_to_cloned_root`——二者会 `git fetch origin <对话先前分支>`，本地-only 分支必炸。主仓路径能 `checkout main` 就够；MCP root 挪不动就用绝对路径继续改，事后再报。

### 禁止 stash / restore / 带着 dirty 换分支搬旁路 WIP（Will）

每会话一任务分支/worktree；不得 `git stash` / `git restore` / 在脏主仓 `git checkout` 清掉或挪走其他分支或会话的未提交改动（含合进 main 收尾）；门禁须在目标 worktree 内跑 `gate.sh`（`cd`/`git -C`）；hook 看错树 → 停下来报，见 `.cursor/rules/feature-branch-before-code.mdc` + `scripts/agent-gates/README.md`。

### 合进 main 收尾

user-asked land/merge 后必须删本任务 feature worktree + 本地 feature 分支并更新本地 `main` tip（见 `git-local-merge-push.mdc`）；主仓有**旁路 dirty WIP** 时禁止 `git checkout main` / `git restore` / park-copy / stash 去强切——报停即过 done-gate；**禁止**为收尾调用 `move_agent_to_root` / `move_agent_to_cloned_root`（含“切回主仓”）——一律 shell；

### 测试端口冲突

`:3000` 只留给本地 `main`；功能分支 / worktree 测试即使 `:3000` 空闲也禁止占用，须 `3002+` + `MESA_UAT_BASE`；占用中的端口不要 kill（见 `.cursor/rules/dev-port-isolation.mdc`）。

### 同仓第二套 web

另起端口时必须 `MESA_NEXT_DIST_DIR=.next-uat`（或其它非默认 distDir）；禁止第二实例写默认 `apps/web/.next`（chunk 404 → 登录黑屏）；开票/其它仓不是同一 `.next`。

### Local web after human stop

never auto-restart `next`/`npm run dev` after Will kills a port or an aborted-shell notification — sole rule `.cursor/rules/local-dev-services.mdc`; restart only on explicit ask.

### 本地服务收尾

任务/UAT 期间可保留本线程 web 方便测；**合进 main 后必须停掉本线程起的 web/ops 监听端口**（Supabase 可留；禁止 kill 其他 session；禁止为清理而 `db reset`/删本地库）— 见 `.cursor/rules/local-dev-services.mdc`。

### 清冗余 before UAT (Will)

implement → 清冗余 → UAT → lint+typecheck → commit（build 留到 push）；sole gate `.cursor/rules/redundancy-cleanup-before-uat.mdc` — never start testing with confirmed dead/parallel/forward-only wrappers left “测完再清”.

### Best practice only (Will)

never lead analyze/plan with补丁/`hide-when-lying`/「小补丁 vs 最佳」并列；sole standing rule `.cursor/rules/best-practice-not-patches.mdc` — recommend one end-state that matches the real bill/UI truth.

### Accurate Chinese wording (Will)

hard gate `.cursor/rules/accurate-zh-wording.mdc` — no nonsense, no loose EN→ZH (e.g. never 「系统退回」 for missing `party_id`; write 有 id 用 id、没有用名字认票); chat/plan/JSONC comments same standard.

## 员工结账 / 收款 / 分单 UI

### Whole-table checkout amount

sole persist stamp is `normalizeCheckoutRequestPayload(..., { authoritativeWholeTableTotal })` from billable session total in `submitCheckoutRequestForTable`; guest/staff explicit whole_table body may use `buildWholeTableCheckoutPayload` (provisional ok) — never inline `{ name:'__whole_table__', amount:0 }` beside it, never trust client amount as persisted obligation.

### Staff floor「呼叫结账」/「关台结账」

sole toggle `quick_table_close` — off → `showCallCheckout` = `tables.checkout_close` ∧ open session; on → `showCheckoutClose` settled close (mutually exclusive with `bill_sync_to_fiscal`; guest call checkout unchanged); otherwise session closes on the last collect, or via 强制关台; sole `ensureStaffCheckoutEntryForTable` + `POST …/checkout/ensure-entry` + `loadActiveBillSplitForSession` (active split → reopen; none → mint whole_table); never `buildWholeTableCheckoutPayload` from `WaiterTableCallCheckoutControl` beside a preserved plan; fiscal tableId resolve reuses the same active-split loader.

### Staff took over checkout

sole marker `bill_splits.staff_checkout_requested_at` via `markBillSplitStaffCheckout` (ensure-entry + by-item collect held open; cleared by `resume_table_session_ordering`, or by by-item unlock once no called-unpaid ticket remains and nothing was collected; with a collection unlock calls `mark_bill_split_staff_checkout` so the table stays queued even if the marker was previously null). By-item 恢复点单 = `individual_checkout_apply(unlock)` deletes that unpaid ticket (persons + result + call row, dishes back to pool) and shifts later `session_collected_payments.person_index` in the same transaction — never leave an `unlocked` ticket for new unlocks; `individual_refresh_split_status` keeps `requested` while set — never re-derive queue membership from tickets alone (all-paid by-item with unallocated dishes otherwise vanishes from the queue while the table stays open).

### Checkout request error toast

sole `messageForCheckoutRequestError` (known codes → explicit copy; `callCheckoutFailed`/`actionFailed` fallback only) — never inline error switches in WaiterTableCallCheckout / StaffCheckoutSplitEditor / use-checkout-request-submit.

### Even draft roster

sole hydrate `resolveContinuationSplitShape` (null for `whole_table`) + sole pad `ensureSplitPersonNames` + sole size gate `splitDraftPersonCount` (min/default 2); never seed from `__whole_table__` sentinel; never parallel Math.max(2) beside that gate.

### Staff checkout by-item UI

sole `StaffByItemSplitWorkbench` (horizontal person rail: name+€amount from `calcByItemSplitResults`/`locateByItemSplitResult` + ✓ when locked; auto-scroll active; remount after partial pay: hydrate by-item from `persons` only after `lineSpecs` ready + mint next unpaid when current already locked; no due/progress beside chips — bill totals sole sticky `SettlementBar`; empty share = `staffByItemShareEmpty` + hide estimate/收款; no qty inputs on the staff right panel — mirrored `‹` return buttons + 44px trash); guest phone stays `ByItemSplitSection` — never embed guest cards in staff `split_edit`.

### Settle person progress

sole `CheckoutSettlePersonRail` ✓ when `settlementStatus==='settled'` (payment complete, not invoice).

### Checkout session footer

sole `CheckoutSessionActions` is path-back「取消」+「恢复点单」— never 关台/`CloseTableSessionAction` on checkout detail (floor/table detail owns close).

### Staff by-item collect

sole target `resolveByItemCollectTarget` (roster `result[]` index + live amount capped by bill pending); calc order via `personOrder` never localeCompare-sort for person_index; obligation floor `applyCollectedObligationFloors`; chip ✓ sole settled via `settledByItemPersonKeys`; pool-complete persist must amount-match (allowPartial only while pool open).

### Staff by-item collect obligation

sole `calcByItemSplitResults` (incomplete lines unit×qty) + `locateByItemSplitResult` for index/amount; never toast `staffByItemNeedName` for missing results; never parallel `staffByItemPersonEstimate` amount beside it.

### Staff by-item people

serial collect only — next unpaid chip minted after lock when pool remains; never a parallel「+添加人员」on `StaffByItemSplitWorkbench` (even `BillSplitPanel` has no add-person).

### Staff checkout detail

sole shell `/dashboard/checkout` list+detail → always `StaffCheckoutSplitEditor` (`BillSplitPanel` 结账方式 tabs); cancel sole `CheckoutPathChooserBackButton` → `waiterTableHref` (queue kept); no path_chooser/settle phase / WaiterBoardCheckoutSheet; mode freeze sole `isStaffCheckoutSplitModeFrozen` + `staffMayChangeCheckoutSplitMode` (even/by_item submitted locked; unpaid whole_table may switch); even min/default 1 via `splitDraftPersonCount`.

### Collect payment tender

sole enum `CASH|MULTIBANCO|MIXED` via `BILL_SYNC_PAYMENT_METHODS`/`parseBillSyncPaymentMethod` (no CARD/MBWAY/OTHER); sole tender UI `CheckoutPaymentTenderFields` in both `CollectPaymentModal` + `PrintFiscalInvoiceModal`; sole normalize `resolveCollectPaymentTender` → `payment_lines`; sole `billSyncDocumentTypeForPayment` (CASH≤100→FS else FT); ledger `payment_method`+`payment_lines`; buffet headcount IVA sole `buffets.vat_rate` DEFAULT 13; auto receipts use `receiptPaymentMethodLabel` (never hardcode Cash); cash drawer when CASH or MIXED cash>0 via `enqueueCashDrawerOpen` → Agent `KickCashDrawerOnLocalDefault` — never browser→Local open, never second ESC p in Mesa print-agent.

### Collect payment buyer name + auto fiscal

sole seed `collectPaymentInitialCustomerName` → `CollectPaymentModal.initialCustomerName`; sole auto-invoice gate `shouldAutoIssueFiscalAfterCollect` stamped as `CheckoutPrintAsk.autoIssueFiscal` (controller never re-derives); never leave parallel empty-name reset or always-ask dialog beside that.

### Checkout SettlementBar sticky

sole fill `brand-bg` (paper; no card ring on gold inset); `/dashboard/checkout` sole `checkoutSettlementBarStickyShellClass` (`belowStaffTopBar`); board sheet sole `checkoutSettlementBarSheetStickyShellClass` (`top-0` under sheet header); never bare `top-0` on the dashboard path.

### Checkout summary 待收

sole `buildCheckoutSettlementSummary.pending` / `customerBillCallAmount` = `outstandingAmount(payable|total, collected)`; never Σ person outstanding for bill-level pending (person「本次应收」stays `buildSplitSettlementRows`).

### Staff by-item share line meta

sole `staffByItemShareLineMetaParts` + `StaffByItemShareLineMeta` (always `qty × unit = amount` slots; ready → gold euro from share.amount; incomplete → muted `—` placeholder in the same slot, never fake `€0.00` / never mount-omit `=`); pool sole `StaffByItemPoolLineIdentity` (name row = label then adjacent unit price, not right-pinned; meta = remaining only — never `可分 … · €` on one line) — never reuse pool layout on share rows, never a second line-total beside share.amount.

### Staff by-item pool remaining

sole taken qty is `parseConsumerRows` (named only) inside `staffByItemPoolLines`/`addWhole`/`addHalf` — never count unnamed seed `qtyWhole=1` as allocated (that yields fake「菜品已分完」while progress/validate still incomplete); UAT must assert pool vs `byItemProgress` vs confirm gate agree.

### Staff by-item rail names

sole authoritative tickets `resolveStaffByItemRailPeople` + sync `syncStaffByItemRailPeople` (third arg `previousAuthoritative` drops unlock/server-departed tickets; seed/filter still `staffByItemLedgerPeople`/`staffByItemRailSeedPeople`; append-only via `appendStaffByItemRailPeople` only when overlap — never keep unlocked chips or early blank「客人 N」after hydrate; no mint while `awaitingRailHydrate`); sole edit/collect roster `resolveStaffByItemEditRoster`; rename lock = settled ∨ `lockedPersonNames` (collection history), not settled-only.

### Checkout resume mode gate

sole `isByItemPerTicketCheckoutPlan` (`by_item`); whole_table/even never stamp/attach `bill_split_ticket_calls` as per-ticket; session footer「恢复点单」omitted for by_item (`individual_session`) and even (`even_session`) via sole `omitsSessionResumeOrdering`; only whole_table may show session resume; staff by-item share-panel resume sole copy `checkout.resumeOrdering` / `resumeOrderingOperating` (same words as session resume; API still ticket unlock) — never a parallel unlockTicket label.

### Staff by-item unpaid hydrate

sole `billSplitDraftAuthorityKey` → `useByItemSplitState` wipe unpaid draft on authority/session change (same render already merges against `{}` — do not leave prior unpaid rows for append-only `mergeMissing`), then sole `pruneByItemDraftDroppedSeedTickets` (seen-seed keys stick after unlock so prune still fires when `setByItemAllocations` would otherwise append-keep deleted tickets) before `mergeMissingByItemDraftTickets` from unlocked persons seed (empty draft = full server unpaid reseed after guest re-call; same fingerprint keeps staff mid-edit); workbench remounts on that authority key + sync drops unlock leftovers; never one-shot seed by split id / fingerprint skip that drops unpaid tickets while a locked chip is present; never keep stale local unpaid over a newer server plan.

### Staff by-item delete/return

sole omit `byItemLineTicketOmitKey`+`recordStaffByItemShareOmit` via `mergeMissingByItemDraftTickets` omit set; trash and a return that empties the row (`StaffShareReturn.removed`) both record it — never resurrect trash from the same persons seed.

### Checkout queue progress

sole `formatCheckoutBillCollectionProgressLabel` + copy `checkout.billCollectionProgress`（已收 €collected / €payable from `buildCheckoutSettlementSummary`); never `checkoutPaymentProgress` / `N/N 人已收` / `paymentProgress` person-count beside it.

### Staff by-item unpaid plan persist

sole `mergeStaffByItemUnpaidDraftIntoLedger` (persons[i]↔result[i] same party key; paid amounts freeze; locked-unpaid amounts refresh from draftResults; order prefers existing result for person_index); staff「分单结果」+ persist draftResults sole `editRoster`/`byItemDisplayResults` — never zip allocation first-seen order with payment person_index; by-item draft calc sole `byItemPersonOrder`+`byItemPersonPartyIds` from ledger result via `persistByItemUnpaidPlan` for resume `beforeResume`/`onRegisterPersist` and collect after stamp — never `mergeCurrentByItemTicketForCollect` or resume without flush.

### Checkout discount display

sole money view `resolveCheckoutDiscountMoneyView` + labels `formatCheckoutDiscountLabel` / `formatCheckoutCollectDiscountDetail` / share `resolveCheckoutDiscountedShareDisplay`; SettlementBar + person chips + CollectPaymentModal all read that view — never a second discount € calculator beside `discountedObligationAmount`.

### Checkout split settlement obligation

sole fold `buildSplitSettlementRows(..., discountRate)` via `allocateDiscountedSplitObligations` (bill payable once + proportional cents; one cut — no freeze/re-split after collects) — Host / `settledByItemPersonKeys` / `resolveByItemCollectTarget` / guest display / order-history; persist `result[].amount` stays pre-discount — never independent per-row `discountedObligationAmount` as multi-person settle truth, never freeze+reallocate unpaid after partial collect, never a second settled/partial calculator beside it.

### Checkout bill discount commit

sole decision `resolveCheckoutDiscountCommit` + hook `commitRate` + host `commitDiscountRate` wired as `onDiscountRateCommit` on IntegerInput onChange; never a parallel business onBlur that re-reads display draft after commit.

### Checkout take-away charge

sole line `buildTakeawayChargeItem` (`orders.items` kind `takeaway`, id `takeaway:<uuid>`, fixed `TAKEAWAY_LINE_NAME`, unit `price` + `qty` ≥1, item_status done) written only by `POST …/checkout/takeaway` body sole `lines:[{amount,qty}]` via `parseTakeawayLines` (`append_order_items` + append idempotency, `checkout.confirm_payment`); remove = same route `DELETE` → `decrementOrderItemWithAudit` / `applyOrderItemDecrement` **always voids whole takeaway charge** (even qty>1 — not peel-by-1; menu lines still peel) + `RowRemoveIconButton` large in `CheckoutTableItemsSection` + editor rows, no confirm; staff list instant drop sole `voidTakeawayChargeInOrders` (same decrement) then DELETE — fail restores; while `takeawayBusy` / `removingTakeawayLineId` sole `detailLocked` (blocks collect / resume / discount); entry sole `SettlementBar.onAddTakeaway` + `CheckoutTakeawayModal` on sole `RightPushPanel` `form` (continue-order = same panel `ordering`); paper/fiscal qty+unit from same `OrderItem` via `buildPaperBillableSessionItems` / `buildReceiptLinesFromOrders` / `buildBillSyncJobPayload`; "is a menu dish" sole `isMenuCatalogItem` (kitchen / menu_items lookups / dish history / ranking / feedback); line IVA sole `vatPercentForOrderItem` + `loadOrderLineVatRates` (`restaurants.takeaway_vat_rate`); fiscal code `TAKEAWAY` + `open_price` (one product, many prices, never merged). Never a bill-level surcharge field, never per-line minted item codes, never parallel `amounts[]` without qty.

## 顾客结账 / by-item / even

### Guest bill modes

chips `whole_table`|`by_item`|`even` (default `whole_table`, no custom) via `GUEST_SPLIT_MODE_ORDER` + `guest-bill-split-mode`; even sole `useGuestEvenSplit`; by-item sole `GuestClaimPanel` + `GuestClaimDishCard` over `useGuestClaim` / `guest-claim` (step ① name once, step ② per dish the portion buttons `+1|+1/2…+1/5` ARE the add action — no expand, no separate pick-size-then-plus step — with the line cut `fractionUnitOfLine` + stamped `unitDen`; − takes back the size last added; dish footer `我的 qty` + euro from sole `guestClaimLineAmounts` (same allocator as the pool, so dishes add up to the call amount to the cent — never `unit × qty` per dish); panel money me/others/unclaimed sole `guestClaimMoney` (unclaimed = table − mine − others; `剩下的 €X 都算我` = `claimAllRemaining`); euro preview before the name is typed runs on sole `guestClaimForDisplay` while the call payload (`buildMyTicket`) stays nameless-empty; others read-only with one status slot `已呼叫结账` → `已结清`); call sole `useGuestCallCheckout` (by_item → `submitIndividualCall`, whole/even → `submitCheckoutRequestForTable`); never multi-row name-combobox / `byItemEditor:'guest'` / any qty keyboard on guest cards.

### Guest bill call-checkout vs keyboard

sole yield rule is the CSS `[data-guest-bill-page]:has(<text field>:focus) [data-guest-call-checkout-dock] { display:none }` in `globals.css` (any text field on the guest bill page; claim name `enterKeyHint="done"` + Enter blurs) — iOS keyboard-dismiss (Safari ✓ bar / hide-keyboard icon) blurs only the window, not the field — sole fix is `GuestBillBottomDock`'s window-blur → bill text field `blur()` (else the next touch refocuses it, `:focus` returns and the dock hides before click); never visualViewport/innerHeight keyboard detection, never React hide state for the dock, never programmatic scroll on focus or before focus — the by-item CTA「填写名字」→ `askForClaimName` only calls plain `input.focus()` (same native iOS keyboard reveal as tapping the field; never `scrollIntoView` / `preventScroll`, which parked the field under the keyboard in 31461224) (the by-item dock shows sole summary + one CTA whose label is the next step claim→name→call, never a disabled `呼叫结账 — €0.00` while a name is missing) (fights the iOS keyboard: shake + ghost-painted fixed CTA; removed in 57030d1d, regressed in a4f99bd1).

### Guest bottom dock surface

sole `customerBottomDockSurfaceClass` (fixed bottom-0, opaque `bg-brand-card`, border-t, safe-area pad; no width) — menu footer = surface + `CUSTOMER_MENU_SHELL_WIDTH_CLASS`; guest bill sole `GuestBillBottomDock` (editing: call gold then outline「返回点单」; awaiting/settled: outline back only; no guest「恢复点单」/「刷新页面」) = surface + same shell width; never a floating `bottom-4 -translate-x-1/2` CTA over scrolling content.

### By-item fraction unit (one cut per dish)

sole rule module `lib/by-item-fraction-unit` — a fractional share stores the unit it was picked in (`qty_unit_den` 2..5; `2/4` reads as `1/2`, so qty alone cannot say the cut); line cut = `fractionUnitOfLine` (explicit unit first, else inferred from dens; paid shares count); first writer to the server plan fixes it, later writers must follow (`fractionUnitConflict`, code `by_item_unit_mismatch`, 409 + `line_keys`). Checked only on lines the write touches: guest call = lines of my ticket (`validateIndividualCall`), staff write = `changedFractionLineKeys` in `submitCheckoutRequestForTable`; drafts (staff pool, guest phone) never occupy the cut. A staff draft may re-cut a dish the stored plan already cut (the first called guest's) **only on the collect write** (`allow_cut_change` → `submitCheckoutRequestForTable` `allowCutChange`); every other staff by-item write, incl. the 恢复点单 flush, keeps the stored cut (`fractionCutChangedLineKeys`, code `by_item_cut_change_at_collect`); after that collect the paid share fixes the cut. Staff pool `1/N`: free line → picker strip under the row (`fractionUnitChoices`), fixed line → direct `1/unit`; share rows mirror the pool buttons (`‹`, `returnMenuShareToPool`/`returnBuffetSeatToPool`) and have no qty/den inputs; never backfill a unit onto old shares (SQL rejects changed rows of other tickets), never a second den-lock helper or free-typed den.

### By-item ticket match/lock

sole key `splitPartyKey`/`splitResultTicketKey` (party_id first); ledger lock/floor via sole `ledgerPaymentTicketKey` (party_id first — never stale `person_index` when id set) into `allocationLockedTicketKeys`/`collectedTotalsByPersonKey`; SQL+TS `merge_by_item_split_result_with_ledger` must not name-collide distinct tickets; resume never treats `by_item` as `whole_table_paid` via row-count.

### By-item atomic ticket

sole id `mintSplitPartyId`/`splitPartyKey`; wire parse sole `parseOptionalPartyId`/`parseOptionalPartyIdFromRow` + `toWireSplitResult` (API/persist `party_id` only; camelCase `partyId` accepted on read then normalized) (optional `party_id` on wire); paid share money sole freeze via `frozenAmount`/`lockedAmount` in `allocateByItemShareAmounts`; settled chip cannot take pool adds; never name-only identity for new duplicate tickets.

### By-item obligation

sole `allocateByItemShareAmounts` (qty×unit weights + cent remainder; never per-share `round(unit×qty)`); `calcByItemSplitResults` + staff share-row amounts both call it; collect = obligation−prior only (no bill-pending clamp); paid shares are `paidLocked` rows (read-only, no merge) — new same dish = new row.

### By-item UI layers

staff sole committed=`extractByItemLockedAllocations` + draft via `mergeByItemCommittedAndDraft`/`useByItemSplitState`; submit wire still `buildSplitPersonsFromAllocations`; the guest phone never uses this dual-layer (see **Guest by-item claim**);

### by-item draft party ids

sole `normalizeByItemDraftPartyIds` (unpaid same-name coalesce then same-dish divergent-name split; guest+staff write/hydrate; never a second name-aggregate path).

### Custom (手填金额) split is removed

`SplitMode` is `whole_table|even|by_item`; no custom-amount editor and `parseSplitMode` rejects `custom` — do not reintroduce.

### Customer bill read-model

sole `useCustomerBillReadModel` + `syncCustomerBill` full (orders+split+ledger+session); never orders-only `live` half-shell or freeze `submitted`/payments from mount props.

### By-item collect amount

sole `resolveByItemCollectTarget({ discountRate })` (discountedObligation − prior); open-modal and confirm both call it — never `discountedObligationAmount` again on that outstanding.

### By-item locked shares

continuation exact equality (`rationalsEqual` / buffet heads exact) + locked tickets must remain in incoming persons and result; never floor/`rationalGte` allow-increase on locked tickets.

### By-item merge missing paid

sole `mergeByItemSplitResultWithLedger` (TS+SQL + checkout queue `mergeBillSplitsFromRefresh`) keeps paid existing when incoming omits; unpaid missing may drop — never pad via `mergeSplitResultPaid` index max-length (resurrects unlocked tickets as €0 Resultado ghosts).

### By-item draft row gate

sole `validateByItemDraftRows` before parsed shares in `validateSplitDraft` (staff draft + submit); never enable call-checkout from parsed-only while rows still show `duplicate_names`.

### Bill-split local draft

sole persist `bill-split-local-draft` keyed by session; hydrate sole `resolveBillSplitDraftHydrateAction`+`billSplitDraftAuthorityKey` (authority change → reseed server; never keep stale whole-table draft after resume); by-item local apply sole `resolveByItemLocalDraftApplyAction` (`leave_reconcile`|`apply_local`; staff + server shares → leave, guest restorable + local draft → apply even after checkout→resume) — never `setByItemAllocations({})`; guest refresh restore sole `restoreGuestByItemLocalDraft` (local unpaid wins, server-locked overlay only, never whole-replace); persist gated by `billSplitLocalDraftOwnerKey`/`mayPersistBillSplitLocalDraft`; by-item working map resets on `draftOwnerKey` (guest+staff) — session change clears even/by_item memory (never write prior roster into the new session key).

### Checkout money lines (screen + paper + by-item pool)

sole `isBillableSessionRowOnPaper` / `buildPaperBillableSessionItems` (`billableLineAmount>0`) via `checkoutLinesFromOrders` + `buildByItemSplitOrderLines`; kitchen/floor「已点」/feedback stay on full `buildBillableSessionItems` — never a parallel `price===0` / `isByItemSplittable*` filter beside that gate.

## 顾客菜单 / 菜卡 / sushi round

### Menu dish list row

identity separate from actions (mobile stack / desktop identity-left + compact action cluster right); one cluster for €+thin toggle+text edit/delete (`gap-3`, extra air after toggle) — never `justify-between` price∥controls desert, never switch jammed on 编辑, never name∥price/toggle on one band, never list `⋯` overflow, never PT·EN·ZH one-line title.

### Guest catalog card depth

sole CSS on `.mesa-menu-item-card` (lit top sheen + layered shadow, per-theme `--mesa-menu-card-hl/shade`; thumb well inset via `.mesa-menu-item-card-thumb::after`); press-sink skips `.mesa-menu-item-card-action`; mouse hover lift + tilt via sole `menuItemCardTiltFromPointer` → `--mesa-menu-card-tilt-x/y` (no React state); reduced-motion off. Gold `+` / qty pill keep their own look — never add depth chrome to the action.

### Guest menu catalog categories

sole `resolveCustomerMenuCatalogView` — nav shows a category only when it still has ≥1 dish in `servedItems` after channel + time-slot filters; never keep empty shells or a second UI hide for takeaway-only.

### Guest menu catalog freshness

sole durable signal `restaurants.menu_catalog_version` + client `ensureCustomerMenuCatalog` (knownVersion); SSR seeds version via `loadCustomerMenuCatalogForDisplay`; MenuPage always entry/attention reconcile (never disable the hook because SSR seed exists); live doorbell sole `menu_catalog_signals` via `CustomerMenuCatalogRealtime` (`restaurant_id` filter; upsert on invalidate — never CDC full `restaurants`, never poll, never `menu_items` CDC) → same ensure. Server cache key includes the version so a bump cannot serve a stale body.

### Customer recommended merchandising

sole `CustomerRecommendedRail` via `catalogLeading` (recommended → sticky sub chips → list); 4:3 + catalog label + price (+ photo-corner `VegetarianMark` thumb), tap opens detail; poster motion sole `.mesa-recommended-poster` (hover lift + press sink + focus-visible; **no** pointer tilt); do not keep a strip sentinel `recommended` or overlay the list gold action (`MenuItemCardAction`) / reuse `MenuItemCard` / `.mesa-menu-item-card` on the rail.

### Recommended add POST

sole `{ menu_item_ids }`; do not keep a parallel `menu_item_id` add body.

### Staff catalog list thumb

sole `MenuItemListThumb` (40×40 photo else emoji); do not inline a second 40×40 `Image` in MenuManager / recommended picker.

### Menu item allergens

sole `menu_items.allergen_codes` + `normalizeAllergenCodes` / `ALLERGENS` in `lib/allergens.ts` (EU 14); do not store contains-allergens on `note_preset_keys` or invent a parallel shellfish code.

### Menu item flavor hints

sole `menu_items.flavor_codes` + `lib/flavors.ts` + guest `MenuItemFlavorChips`; gate `menu_flavor_hints_enabled` (default off, module `flavor`); pick cap sole `FLAVOR_CODES_MAX_SELECTED` (3) via `normalizeFlavorCodes`/`toggleFlavorCodeInDraft`/`flavorDraftPickBlocked` — never a parallel max or truncate-compat beside it; list under name / detail hero bottom-left text gold chips only; no spice_none, no chili count, no print; do not mix with note presets or allergens.

### Menu dish motion video

sole columns `menu_items.video_url` (960×720 detail) + `rail_video_url` (480×360 rail) + `video_effect` (set/cleared together; DB CHECK); sole catalog `lib/menu-dish-video.ts` (effects, encode tiers, ≤ `DISH_VIDEO_MAX_BYTES` = photo 1MB, object path, device gate) + browser encoder `menu-dish-video-encode.ts` (WebCodecs + `mp4-muxer`, periodic loop, tier ladder) — no server encode, no AI; sole Cache-Control `MENU_STORAGE_CACHE_CONTROL` (three years, every `menu-images` upload: photo/video/storefront — keys are unique per upload); sole write `setMenuItemImage` (photo + video one request; any photo change clears videos unless new ones come with it; delete row → `removeMenuItemStorageObjects`); sole gate `resolveDishVideoAccess` = Pro `menu_dish_video` × manage cap / × `menu_dish_video_enabled` (`guestVisible`) and list add-on `guestListVisible` = guestVisible × `menu_dish_list_video` grant × `menu_dish_list_video_enabled` (list reuses `rail_video_url` via `MenuItemCard` + `DishMotionVideo` layer rail; catalog field `guestListMotionEnabled`); never `platform_pro_settings.premium_keys`; guest catalog strips video fields in sole `loadCustomerMenuCatalogForDisplay` (`customer-menu-catalog-display.ts`); guest playback sole `DishMotionVideo` (children = still; rail/list = `rail_video_url`, detail = `video_url`) + sole exclusivity `dishMotionCoversStill` (motion ready → still hidden; one visible media in the well — list + rail + detail) + sole policy `dishMotionVideoShouldPlay` (on screen + tab visible; rail yields while detail open — never a global concurrent cap) + sole element src sync `applyDishMotionVideoElementSrc` (catalog URL change must replace stale mp4; never keep first-mounted src); dish form sole `MenuItemPhotoField` (photo + free quality/sharpen `menu-image-quality.ts` + effect chips via sole `DISH_VIDEO_EFFECT_MESSAGE_KEYS`); batch sole `DishVideoBatchModal` (toolbar open; candidates = current `visibleItems` ∩ `menuItemEligibleForDishVideoBatch` — has photo, no video; one shared effect; confirm sole `Modal` `footer` + `ModalConfirmActions` — never nest confirm in scroll body or a second list `max-h`); batch progress sole toolbar chip (Spinner + `dishVideoBatchRunning` via `splitDishVideoBatchRunningTemplate` fixed digit slots + thin meter — never `Button` `loading` that hides the count); list motion label sole `menuItemDishVideoListEffectLabelKey` → effect name on thumb ▶ a11y + one muted meta chip after 出品档口 (else after 类型; never name-row; never gold vs price; never generic “has video”); Pro tag sole `ProFeatureBadge`. Do not add a parallel video upload route, a per-surface play/IO hook, keep still+motion both visible in the well, or a second effect-label map beside `DISH_VIDEO_EFFECT_MESSAGE_KEYS`.

### Customer menu SSR / Element type undefined

`MenuPage` 图里的 client 模块禁止 value-import `@supabase/supabase-js`（`serverComponentsExternalPackages` 会让 webpack 标成 async → `MenuPage` client ref `async:true` → RSC 报 `Element type is invalid` / got undefined，客户端再恢复）；只 `import type` + 订阅状态字面量。

### Selectable chips

sole chrome `mesaSelectionChipStrongClass`/`mesaSelectionChipSoftClass` + `mesaSelectionChipShellClass` (strong = block switch; soft = in-group pick with gold border); never hand-roll `bg-brand-gold/20` without border as selected.

### Menu note presets

sole dictionary is `menu_note_preset_groups` + `menu_note_presets` (seed via SQL `seed_default_menu_note_presets`); dish sole link `note_preset_group_ids` (groups only); guest chips via catalog + `toggleCartNotePresetSelection` / `composeCartLineNote` (one pick per group) — never hardcode `NOTE_PRESETS` / `note-presets.ts`, never dish-level preset-id checkboxes beside group ids.

### Sushi roundReview cart badge

sole `round.ownReviewQty` → footer `roundOwnQty` (本机本轮份数, `CustomerRoundTrayIcon` badge — never the cart glyph);整桌 `tableReviewQty` only drives footer phase (`roundTableQty`) + send guidance + round review — never the badge.

### Sushi send guidance

sole state `resolveSushiSendGuidance` (table round only, never cart) via one `useSushiSendGuidance` per page → `SushiSendGuidanceStrip` (footer `guidance` slot, height `--mesa-bottom-dock-extra`) + 核单 `SushiSendGuidanceNotice`; copy `formatSushiSendGuidanceMessage`; sticky slot is round limit only (`formatSushiStickyRoundLimit`) — never countdown/cooldown there again; footer CTA `去送厨 · N` only opens 核单 (send stays sole in 核单); cart submit label sole `resolveSushiCartSubmitLabel`; paid rows in 核单 sole `buildRoundPaidSentLines` (read-only); auto-open 核单 sole `shouldAutoOpenRoundReview` (submit / enter / visibility — never a second remind modal).

### Sushi free card qty

sole `sushiFreeItemDisplayQty` (cart draft only; never ownRoundQty on cards); round lines edited only in 核单 via `CartQtyStepper` + `setOwnRoundLineQty`; line identity `(item, guest, note)`; cart 下单 uses qtyMode add.

### 已点 badge

sole `countSubmittedDishPortions` (Σ dish qty, no buffet_base/voided) — never `items.length`.

### Sushi round guest free-qty preview

sole UI gates `previewGuestRoundCartDraftGates` (菜卡/详情/购物车加份 + 下单前) + `previewGuestRoundLineSetGates` (核单 set); each runs round-cap then meal (cap helpers + `previewGuestRound*MealGate`; same `checkSushiLimitForCartLine` as append); never parallel used+delta or meal-only beside those for those paths; write authority still RPC upsert/delete + `resolveRoundLineMealLimitApply`.

### Guest menu shell width

sole `CUSTOMER_MENU_SHELL_WIDTH_CLASS` = `w-full max-w-[68rem]` (page root / menu footer / bill dock / bottom sheets via `CustomerMenuBottomSheet` / storefront hours sheet) — never a parallel `max-w-mobile` + `lg:max-w-[68rem]` pair or bare `max-w-mobile` on those surfaces; dish detail panel stays full-bleed below `lg` / `max-w-lg` dialog at `lg+` (not the menu shell).

### Guest menu edge floats (peer float)

sole content host `customerMenuContentHostClass` (under header + guests/sushi sticky + gate); peer rail `customerMenuPeerFloatRailClass` `absolute inset-x-0 top-0` inside that host (left-inset `CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS`); never viewport-fixed rem tops (`3.75rem` / safe-area stacks) or a second host/rail.

### Guest restaurant notice

sole entry `CustomerGuestOrderingNotice` = megaphone capsule (`appearanceChromeGroupClass` + segment button, gold unread dot) via `CustomerOrderingHeader` `notice` left of `AppearanceChromeGroup` (classic + sushi guest only); never an edge tab floating over the dish list (it covered the gold `+`).

### Menu vegetarian mark

sole `VegetarianMark` + `VegetarianLeafIcon` (status-success tokens): list card + recommended poster = `thumb` leaf disc `.mesa-veg-mark-thumb` at the photo top-left (word via sole `formatMenuItemOpenDetailAria`); guest detail + kitchen detail = `label` pill; sushi 素食 filter chip shows the same leaf as legend. Never a word pill in the name / flavor / price bands (drifts with name length, clips, steals name width per language), never `emerald-800` hand-rolled copies.

### Guest menu peer float

sole `CustomerMenuPeerFloats` + `customerMenuPeerFloatRailClass` (classic + sushi; chronological flex-col older-above; sushi = free round peers + paid appends; classic = order appends only with `includeZeroPriceOrderLines`) + sole dismiss `schedulePeerFloatDismiss` (`PEER_FLOAT_HOLD_MS` 10s then `customerMenuPeerFloatBubbleClass` CSS opacity fade `PEER_FLOAT_FADE_MS`/duration-300) + sole baseline `sushi-peer-float-baseline` with per-source catchup (`roundSnapshotReady` / `ordersSnapshotReady`) and paid `added_at` > baseline (merge history absorb; session+table reset); never one shared OR catchup across feeds, never viewport-only `left-*`, never content-`px-4` as the side edge, never a second float rail or bottom-left twin, never a parallel fade timer beside that schedule; sole guest dish thumb is `PeerFloatDishThumb` + `resolvePeerFloatThumb` (catalog photo else dish emoji) for peer floats, 已点, and cart; peer label `formatPeerFloatLabel` (name×qty); 已点 label `formatStaffBuffetLineLabel` (name + ×qty or ·A-C, no emoji); cart name stays `formatLocalizedMenuItemLabel` — never `formatOrderItemListLabel` / leading emoji beside that thumb.

### Table headcount chrome

sole `formatCustomerMenuTableGuestsLabel` + `MENU_PAGE_MESSAGES.tableGuestsCap` + `CustomerMenuTableGuestsLabel`/`CustomerMenuTableGuestsChrome` (count via `sessionGuestCountForLimits` / `live_guest_count`); never parallel `stickyGuestsCap` or a second「本桌 N 人」string.

### Customer menu category chrome

sole top-category key = `.mesa-category-key` (+`-active` gold face, `-badge` red cart qty) in globals (dark :root + `[data-theme='light']` face/edge/lip vars; box-shadow lip, `:active` sinks 3px); qty sole `customerMenuNavTopCategories(view, label, cart)` via `view.topCategoryIdByItemId`; storefront preview mounts the same `CustomerMenuCategoryNav` — never a second rail button copy or the old 3px gold side bar.
sole `CustomerMenuCategoryNav` dual-pane (`customerMenuDualPaneRootClass` + nav shell `customerMenuCategoryNavShellClass`=`min-w-0 w-full overflow-hidden` + `customerMenuCategoryRailClass` / catalog `overflow-x-hidden`+`overscroll-y-contain`); page-scroll catalog sole `customerMenuCatalogPanePageScrollClass` has **no** overflow (vertical scroll + horizontal clip only on storefront `[data-mesa-storefront-menu-scroll]` — never `overflow-x-hidden` on the catalog or CSS will trap gestures); guest page and staff embedded share one independent left/right scroll in pane mode — never page sticky nested rail chained to document scroll; never omit nav-shell width containment (false 2-col / clipped list +).

### Guest menu bottom sheet height

sole `customer-menu-bottom-sheet-layout` (`max-h-[100dvh]` flex panel + `customerMenuBottomSheetBodyClass` scroller) via `CustomerMenuBottomSheet` (cart / 已点 / 本轮核单 / sushi allergen filter) — never a parallel hand-rolled allergen `fixed` sheet beside it; never body-only `max-h-[60vh]` without capping the panel (title/close clipped off-screen).

### Guest menu overlay scroll lock

sole `lockBodyScroll` / `useBodyScrollLock` freezes + restores guest menu scrollports (`MENU_SCROLLPORT_SELECTOR` = storefront `[data-mesa-storefront-menu-scroll]` + catalog `[data-mesa-menu-catalog-pane]`) with body/html overflow; sole skip `MENU_SCROLLPORT_LOCK_SKIP_CLOSEST` = open `[role=dialog][aria-modal=true]` so staff continue-order catalog stays scrollable — never freeze dialog-owned scrollports, never a CartDrawer-only scroll restore beside that lock.

### Cart line remove + clear

sole trash `RowRemoveIconButton` (cart + by-item/buffet shares); sole empty+close `clearSubmitCart`; cart header clear via `CustomerMenuBottomSheet` `headerActions` + `ConfirmModal` danger; remove-last/clear closes drawer; submit locks −/+ / trash / clear — never a second cart trash or parallel clear helper beside `clearSubmitCart`.

### Sushi round guest phone seats

sole `guestClientSeatLimit` (max(n+2, 2n); 0 = no cap) in `registerGuestClient` (round line upsert + submit-request); copy sole `messageForSushiRoundError` → `guestClientLimit` — never inline `floor(guestCount)` as the phone cap, never fall back to `submitFailed` for `guest_client_limit`; never tell staff to raise headcount to unblock a phone (headcount bills buffet).

### Sushi round cooldown settle

sole SQL `settle_expired_table_order_round_cooldown` (GET `getRoundSnapshot` + upsert both); never leave expired cooldown lines in snapshot as a live cap beside that settle.

### Sushi round due-submit settle

sole `settleDueTableOrderRoundSubmit` (empty → collecting; else `finalizeRound`); triggers = submit-request arm held by `waitUntil` (Vercel; no-op on long-lived Node) + lazy in-process sweep (long-lived Node only, skipped when `VERCEL`) + GET snapshot (client deadline = one GET, no finalize API) — never post-response timer work without `waitUntil` on Vercel (frozen instance strands the append claim → everyone `append_in_progress`), never a guest finalize POST, never a second due-submit branch, never instrumentation/crypto pull, never a second Vercel cron beside nightly-close.

## 厨房 / 楼面 / 权限

### Kitchen ready-after minutes

sole `FeatureFlagsManager` + `PATCH /api/restaurant/features`; do not keep a Hub card or `…/staff/kitchen/settings`.

### Floor opener label

sole `table_sessions.opened_by_name` stamped at open via `resolveOpenedByNameForOpen`; board/live/history read the column only — never resolve-on-read for opener display; fixed `cardOpenerSlot` (no card height change).

### 开台确认

idle confirm is one `POST …/buffet` with `intent=open`; occupied headcount sole autosave via `useWaiterBuffetOpenMutation` debounce `intent=save`, armed only by `scheduleAutosave` from a −/+ tap (never an effect on draft/orders/refs — load/refresh/Realtime realign once posted a lagging 0); total→0 on an occupied table is held behind the「人数改为 0？」confirm (`buffetDraftClearsHeadcount`), cancel = `resetDraftToAligned` (no「保存人数」button / no parallel `applyBuffetToTable`); stale guard is server `409 already_open` only — never a confirm-time GET table precheck. Floor buffet adult/child sole UI `BuffetGuestCounter` −/n/+ only (no typed qty / no `onQtyChange` on that counter). Open-time unit prices sole on `buffet_base.adult_unit_price`/`child_unit_price` via `resolvedBuffetPriceFromLockedLine` / `mergeBuffetPricesPreferLocked` (checkout adjust + headcount upsert reuse lock; never re-slot a package that already locked — RPC only when no lock yet).

### 楼面跨端

一直亮着的桌面只靠 Realtime；手机回前台有 visibility 兜底。只修 published bridge 不够——`useRestaurantStaffEntryReconcile` 必须含 window focus catch-up（与 visibility 同一 resume 路径，勿在 Realtime transport 再挂一份 focus）。

### 楼面跨端 UAT

禁止用 `select_page` 在被动页断言前切走再切回当「同步证明」（会触发 focus/visibility catch-up，假通过）；被动页保持前台，用 API 改态，再 `wait_for`/`evaluate_script`。Docker 挂掉/本地库被清 ≠ 产品不同步——先 `ready`/登录，再谈 Realtime；绿场 `db reset` 会卡在残缺 `initial_schema`，需 cloud schema+data 恢复后再 `db push` 本地-only 迁移。

### 默认角色权限模板

sole `ROLE_TEMPLATES`（`@mesa/shared`，web 再导出）= Pirata 现场五套预制角色权限；开云店 `createRestaurantWithOwner` 立刻 `ensureRestaurantPresetRoles`；「恢复默认」同此；禁止平行第二套默认矩阵。

### 权限勾选文案

角色权限编辑器唯一 IA 为 `ROLE_PERMISSION_PAGE_TREE`（产品页面树）；设置子页（含后厨大屏）只作为「餐厅设置」子节点出现一次，label 读 `settingsHub`/`nav`。开台与保存人数唯一 key 为 `tables.open_session`；楼面看板唯一 key 为 `dashboard.waiter_board.view`。勿恢复已删除的死 key `orders.edit`（从未运行时校验）。

### 桌台详情金额

sole `dashboard.waiter_board.table_detail_amounts.view` → `canViewTableDetailAmounts` → panel `showAmounts` + board-card `amountText`（饮食/合计/行价/超出提示 € + 桌卡 €）；不控开台自助餐价、结账页；预结 sole `checkout.print_pre_bill`（与金额展示解耦）。

### 厨房权限唯一

进 `/{slug}/kitchen` 与员工顶栏厨房入口共用唯一 key `floor.kitchen_board.view`；禁止再挂平行 `dashboard.kitchen_shortcut.view` / 第二行「厨房看板」文案。

### 厨房备餐 401

与看板 refresh 同一写法——`classifyStaffBoardFetchFailure` → `unauthorized` → `handleSignOut()`；禁止再对 session 401 画「备餐失败，请重试」。

### Floor-card fixed slots

sole geometry is always-on `cardOpenerSlot` + `cardAmountSlot` + `cardStatusSlot` + status-rail `cardRailBelow*` (empty when idle) + one-line `cardMeta` (seats ± time ± dishes `×N` via sole `orderedDishQty`/`sumBillableMenuCatalogQty`/`formatWaiterBoardOrderedDishQty` — no icon on dishes); do not omit opener/status/rail bands by board state or reintroduce `flex-wrap` meta that changes hall card height.

### Waiter table-detail session writes

sole mutex `useWaiterDetailSessionBusy` (kind discriminant); CallCheckout/SettledClose/force-close/transfer-merge/order-line/buffet-open/pre-bill/demo-close must tryBegin that lock — never parallel per-button `busy`/`operating`/`closingDemoTable` beside it.

### Waiter detail ordered sort

sole `sortBillableSessionItemsForWaiterDetail` (buffet headcount first, then on-paper, then €0; within each band `buildMenuCatalogBrowseRankByItemId` — category tree + dish sort_order; unknown/off-menu after ranked).

### Waiter detail ordered row

sole `WaiterTableOrderedItemsPanel` + `waiterDetailLayout` receipt grid: code `5ch` (as stored, no zero-pad) · name+leader `1fr` · mid auto (`€`/`unitPrice` + status + qty + serve/minus); below `sm` three cols mid flush right (no balance); `sm+` balance `1fr` mid near center; never a parallel `orderedItemIdentity` or far-right-only qty column. Buffet headcount sole `buffetOrderedTitle` via `formatWaiterOrderedBuffetTitle` on the section title row — never a buffet_base row inside `orderLines`.

### Kitchen board row swipe prep

sole `react-swipeable-list` `Type.ANDROID` on `SwipeableListItem` (`LeadingActions`/`SwipeAction`, `destructive={false}`); sole cue `KITCHEN_SWIPE_PREP_CUE_CLASS` (`bg-brand-gold`+`text-brand-on-gold`, fill reveal, no `min-w` > maxSwipe); sole in-flight `prepInFlightKeys` + sole `Spinner` on those rows (footer prep loading same set; never optimistic status, never footer-only busy); never DIY `dragX`/`finishRowGesture`/Pointer capture beside it, never gold+`brand-ink` cue.

### Kitchen board ready-rail chrome

sole expanded panel `KITCHEN_READY_RAIL_*` + `groupBottomRailByStatus` + `kitchenRowSurfaceClass`/`readyRailZoneTitle` (group heads = `statusCooking`/`statusReady`); open/close sole footer toggle via `railOpenStations`/`setRailOpen` — prep success (`runPrep`) never auto-opens; never paint bottom-rail rows with workbench `bg-brand-card` as the undifferentiated surface, never a second zone-title vocabulary beside `readyRailZoneTitle`.

### Kitchen board dish thumb/detail

sole thumb `MenuItemListThumb` (56 on board) + catalog map `menu_catalog_by_id` via `kitchen-board-menu-catalog`/`resolveKitchenBoardDishCatalogEntry`; sole modal `KitchenMenuItemDetailModal` (frozen at open; confirm close) — never customer detail sheet, never a second board image map or inline kitchen `Image`.

### Kitchen shared prep tray

sole flag `kitchen_screens.shared_prep_tray` (settings modal switch, shown with ≥2 stations); sole state `useKitchenPrepTrays` on the screen (panes and shared tray are views); shared prep sole `collectStationPrepBatches` → existing per-station prep API sequentially (same order spans stations; `updated_at` guard); narrow pane/tray two-line rows by container query (`mesa-kitchen-pane` ≤26rem, `mesa-kitchen-tray` ≤36rem), never by the shared flag; one `KitchenMenuItemDetailModal` per screen. Never keep a second per-pane tray state, a station colour palette, or a multi-station prep body.

### Kitchen prep tray card key

sole `prepTrayCardKey` / `buildPrepTrayCards` = dish + trimmed note (`lineNoteKey`); React key sole `card.cardKey` (cards never mix stations — shared tray groups them per station `sections`), expand key = station id + `card.cardKey`. Same dish + different/blank notes must not stack; never regroup tray cards by `menuItemId` alone.

### Kitchen note display

sole `KitchenLineNote` — list rows `variant="row"` (second line under primary title); prep tray `variant="tray"` + `noteLabel`; never inline `· {note}` inside a shared `truncate` with the dish name.

### Kitchen group header leading (chevron · select)

sole `KitchenGroupHeader` cluster: 36×36 chevron + `gap-3` + `KitchenGroupSelectControl` (36 hit / 22 visual); workbench row checkbox sits in the same 36 column, indent sole `.mesa-kitchen-group-row` (`3.75rem` ≥30rem pane = rail+pad+chevron+gap). Never a second header select, never reintroduce 20px chevron + `2.5rem` indent as a parallel geometry.

## 后台看板 / 列表 / 分析

### Dashboard list pagination

sole Web footer is `ListPaginationBar` (icon first/prev/next/last + aria-labels; no visible prev/next text; no parallel pager in `TablesQrTable`); Ops sole `OpsListPagination` same four icons.

### Value-analytics dish ranking

sole month|quarter|year period + paginated list from `menu-item-consumption`; never Top10/`topItems` beside dashboard today top-selling; never bind ranking to overview day/week.

### Dashboard today amount card

settled gold + muted uncollected (`gold/40`) with 已收/未收 labels; hide `+`/未收 when uncollected is 0; uncollected only via `liveSessionUncollectedAmount` — never parallel floor `sessionTotal` sum, never flatten to one same-weight gold string. **已收 / 今日桌数 / 今日客人** 归属日 sole `sessionRevenueDateKey` = Lisbon `opened_at`（与增值分析同口径；禁止再按 `closed_at` 分桶）。

### 历史订单列表

唯一 feed 路径是 SQL RPC `order_history_feed_page`（closed∪transfer 排序分页）+ 当页 `loadOrdersForOrderHistoryPage` hydrate；禁止全窗口 `.in(session_id)` 或应用层双源 merge 后再切片，禁止查询失败 `EMPTY_PAGE` 吞错（Kong `URI too long` 会伪装成「暂无历史订单」）。

### 当日菜品检索

唯一列表是里斯本当天 + `{ items, page, pageSize, total }` + 本店 `open`/`billing` 会话 Set 标 `session_open`；禁止 `.in('id', sessionIds)`（Kong `URI too long`）、cursor/`loadMore`、20/50/100 平行档位。筛选条与操作记录同款横排工具条（无字段标题）；桌号筛选唯一 `DashboardTableMultiSelect` + `table_ids`；菜名/编号搜索唯一 `DASHBOARD_COMPACT_SEARCH_CLASS` 的 `type="search"`（与操作记录共用）；`q` 与桌号均走 `useDashboardListQuery` 防抖实时查，禁止平行搜索按钮、`Input` 大表单搜索或第二套桌号下拉。

### 后台管理员（`owner_id`）capabilities

唯一写法是 `resolveCapabilitiesForOwner() → '*'`；顶栏/中间件也只认 `can(capabilities)`（无平行 `OWNER_NAV_*` / owner path 白名单）；禁止再拼 `ROLE_TEMPLATES.owner` + settings 补丁列表；店主员工 preset 仍走 `restaurant_roles.permissions`。

### Landing (v2)

sole hero product proof is `LandingHeroStage` (value-analytics dashboard + guest phone drawn from demo data, `hero.stage` copy; never AI/stock device images, never a second hero preview); sole title lines `titleA`/`titleB` via `HeroTitleLine`; sole capability chips `hero.proofs` (exactly three); agent entry `agentLead`+`agentCta` text link below proofs → `#agents` line in the contact block. Section order: hero → `LandingTrustStrip` → `LandingPainPoints` (six problem→solution rows via `pain.items[]`) → `LandingFlow` → `LandingFeatures` → `LandingTeam` → `LandingCaseStudy` → `LandingContact`; never parallel `LandingPillars` / a second pain block. Landing copy is authored for zh/en/pt only (es/fr/de read English); language chips show exactly PT·EN·中文. Dark panels use fixed palette via `landing-chrome` (never `bg-brand-ink`, which flips light in dark theme). Sole sales contact `LANDING_CONTACT_PEOPLE` is 李先生 only (`key:'li'`, WhatsApp+WeChat; name via `founderIndex` → `team.founders`) via `LandingAdvisorContact` (no advisor tabs); flat renew/Pro lists and `LANDING_WHATSAPP_URL` derive from that one person — never a second Chen contact beside it. Team intro may still show two founders + `/landing/team/*` photos. Case/team claims (半年 0 故障, results) are owner-supplied — never invent numbers.

## 打印 / on-prem / agent

### On-prem 店主影子

sole owner restaurant load is `loadOwnerRestaurantForUser` (`owner_id` or claimed-store prem `admin`); do not keep `loadOwnerForSlug` owner_id-only beside it — staff APIs and dashboard share that one call.

### Store agent recommend/download (Will)

sole `resolveRecommendedAgentVersion` + Farvoo Fiscal Agent (`fiscal-agent-v*` / `FarvooFiscalAgent-*`); dashboard behind = `agentVersionOlderThan` only — never bake `apps/print-agent/VERSION` / `print-agent-v*` / string `!==` as the recommend or upgrade hint.

### Bill sync buffet item_code

sole mint `resolveBillSyncItemCode` → `BF########A`|`C` (buffet uuid + guest); never bare `BF########` shared by adult/child.

### Station ticket order_time

sole ISO `earliestOrderItemAddedAtIso` (auto batch via `stationTicketOrderTimeIso` filter; kitchen prep via selected lines) → `formatStationTicketOrderTime` — never stamp prep slips with bare `orders.created_at` beside the line `added_at`.

### Print fiscal invoice

sole staff path `runStaffPrintFiscalInvoice` (enqueue `auto_issue` bill_sync_jobs → wait success; NO table close); UI label sole `checkout.printInvoice`（打印发票）; gate sole `mayFiscalBillQueue` = `checkout.sync_bill`∧`tables.checkout_close` (+ feature `bill_sync_to_fiscal`); buyer NIF sole `@/lib/pt-nif` + copy `bill.nifInvalid` (modal + `POST …/bill-syncs` `parsePortugueseNif`); do not keep `maySyncAndCheckoutClose` / sync-and-close / `checkout.syncBill` compound close beside it, never a parallel NIF regex beside `pt-nif`.

### On-prem pack after web/lib/font change

`pack-release` only zips; store `next build` is the real typecheck — run `npm run build -w @mesa/web` on that commit before zip/upgrade; `next/font/local` `adjustFontFallback` is `false|'Arial'|'Times New Roman'`, never `true` (Google-font boolean).

### Docs-only on-prem build advice is a mistake

agreed Dockerfile/migrate gates must land in code + `pack-release` fail-closed before the next zip (see `.cursor/rules/on-prem-pack.mdc`). **Mode B same-origin URL without matching auth cookie name** (`getSupabaseAuthCookieOptions` ↔ `kong` host) leaves Realtime anon and drops CDC — do not ship same-origin alone.

### Tunnel `X-Forwarded-Proto=http` / Mode B

claim `supabase_url` prefers agent `api_base` only when `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`; cloud claim always `getPublishedSupabaseUrl()`. Dashboard downloads use relative `/api/downloads/...` and pair `api=` uses `window.location.origin`.

### Pair success

sole browser exit is `location.replace('/configure')`; Connected re-pair uses in-process `rebindTrayAgentWork` (not process restart) after `/api/pair` flush — never paint `#err` after ok.

### Inno Setup upgrade

sole path is `PrivilegesRequired=admin` + `PrepareToInstall` taskkill of `MesaPrintAgent.exe` (no `AppMutex`, no CloseApplications yes/no) + `restartreplace` — do not leave `PrivilegesRequired=lowest` or `AppMutex` beside that story.

### On-prem claim

pack ships URL only; store `leaseSecret`/`checkinCredential` come from Ops claim → `license-state/platform.json` — do not require env lease secret for `/setup`.

### POS-80 / 80mm 纸

可打点宽 **576**（Font A 48 列 × **12** dots）；Han/GS v 0 画布必须 576。**禁止**把 `384=48×8` 当满纸——那会让 Qty 永远停在纸宽约 3/4 处（见 `docs/technical/print-agent-station-slip-han-canvas.zh.md`）。

### 部署到 prem

Will 口令仅要求 pack → scp → 店机解压到 `/home/remoteadmin/mesa-on-prem-<ver>/`；**不要**代跑 `sudo upgrade.sh`（店机无免密 sudo）；交还 stamped 路径与升级命令给 Will。

### On-prem pack zip bloat

rsync must exclude `.next` **and** `.next-*` (`.next-uat` / `.next-typecheck`); after pack assert zip ~few MB and no `.next*` in stage — never scp a hundreds-of-MB “source” zip (see `pack-release.sh` fail-closed gate).

## 平台 / Realtime / PWA / 其它

### Pro commercial (pricing + grants)

sole base price `subscription_base_product` + Pro catalog `pro_feature_products` + entitlements `restaurant_pro_feature_grants` (persist via `sanitizePremiumKeyGrants` — list video grant requires dish-video parent); sole gate `canUsePremiumFeature` / `resolvePremiumGate` = effective Pro × grant (never `platform_pro_settings.premium_keys`); sole store quote `quoteRestaurantSubscriptionEur` = base + `quoteProFeaturesEur`; Ops `/ops/settings/pro` edits base+Pro prices; restaurant Pro panel = one save (`plan` + grants when pro) gated by `plan` (basic hides Pro UI; unexpired Pro→basic needs `confirmDowngradeFromActivePro` / `isProMembershipUnexpired`); sole grants write `replaceRestaurantProFeatureGrants` — never stuff base into `pro_feature_products` / `PremiumKey`.

### LAN HTTP UUID

sole `mintBrowserUuid`; do not mint guest ids with `Date.now().toString(16)` beside the append getRandomValues path.

### Client IP for rate limits

sole `clientIpFromRequest` — prefer `CF-Connecting-IP`, else rightmost `X-Forwarded-For` hop, never leftmost-spoofable-first as the trusted visitor.

### Realtime RLS + 嵌套 EXISTS

顾客 anon 的 `postgres_changes` 若策略 `EXISTS (SELECT … FROM table_sessions …)`，会被 `table_sessions` 自身 RLS 挡成永远不可见 → 订阅成功但无 CDC 载荷；须 `SECURITY DEFINER` 会话态检查（如 `table_session_is_open_or_billing`），勿直接 EXISTS 读 sessions。

### PWA shell SW

sole script `buildPwaShellServiceWorkerScript` + route `/mesa-pwa-shell-sw.js` + `PwaShellSwRegister`; cache version only via `getWebAppBuildInfo()` (never a parallel MESA_PWA_* version); never cache `/api/*`; not offline POS.

账号边界（登录成功 / 登出）sole `clearPwaShellCaches` —— `useAuthLogin` 跳转前与 `signOutAndRedirect` 各调一次；否则导航先画上个账号的缓存页（旧 slug → 401 → auto-exit 把新登录踢掉，2026-10-31 luckytee 登录两次）。

### Sign-out scope

sole `signOutThisDevice`（`scope:'local'`）；never bare `auth.signOut()`（auth-js 默认 global，会踢掉共用账号的其他设备）。踢全部会话只走 admin `kickStaffUserSessions`。

### PWA guest table install

sole JSON shape `buildGuestTableManifest` in `site-manifest.ts`; sole path + URL builders `PWA_GUEST_TABLE_MANIFEST_PATH` / `guestTableMenuStartUrl` / `guestTableManifestHref` in `guest-table-pwa-manifest.ts` (middleware + menu/route — keep out of client shell SW); sole HTTP `mesa-pwa-guest-table.webmanifest`; menu `generateMetadata` points install at that href — never a second start_url builder or client-supplied start_url.

### PWA guest window title

sole label `formatGuestTableWindowTitle` (`店名 · 桌号` / no table → 店名) for menu `document.title` + guest manifest `name`; never append `— 菜单`; standalone clears `document.title` via sole `GuestTableStandaloneTitle` so Chrome does not show `name - title` twice.
