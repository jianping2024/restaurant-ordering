# Table session close — server-side payment / kitchen guards (phased fix plan)

**Issue (medium):** Waiter and owner session closing can close `open` / `billing` sessions without server-side checks for unpaid bill splits or in-progress kitchen work.

**Root cause:** `closeActiveTableSessionWithOperationalCleanup` always performs forced operational cleanup (cancel unpaid splits, void lines, close session). Callers only pass `table_id`; there is no preflight validation. UI hides or disables the close button in some cases, but the API accepts any authenticated request.

**Primary files:**

| File | Role |
|------|------|
| `src/lib/close-active-table-session-with-cleanup.ts` | Shared forced-close implementation (no guards today) |
| `src/app/api/restaurants/[slug]/staff/waiter/sessions/close/route.ts` | Waiter close API |
| `src/app/api/dashboard/close-table-session/route.ts` | Owner close API |

**Note:** The audit referenced `src/lib/close-table-session.ts`; that path does not exist. The live helper is `close-active-table-session-with-cleanup.ts`. See `docs/table-session-close.zh.md` for product semantics.

**Suggested fix (medium confidence):** Add a shared server-side preflight that blocks close when unpaid bill splits or active kitchen lines exist; allow owner override only with explicit `force` + non-empty reason. Waiter close remains hard-blocked.

**Product rule (2026-05-29, confirmed):**

- **所有手动关台**（服务员/店主）：必须先确认，API 须带 `confirm_close: true`（兼容 `confirm_checkout_close`）；否则 **409** `close_confirm_required`。
- **已呼叫结账**时 UI 可显示更强提示文案（`checkout_requested > 0`），但确认要求相同。
- **夜间自动关台**（`auto_nightly`）：不经过 guard，直接 cleanup。

**Out of scope:** Changing normal checkout (`confirm_bill_split_payment`), RLS/migrations, nightly auto-close product semantics (auto-close may bypass guards by design).

---

## Phase 1 — Confirm vulnerability and document UI vs API gap

### Goal

Prove the API closes sessions today without validating bill splits or order state, and record how UI behavior differs from server behavior.

### Files affected

| File | Role |
|------|------|
| `src/app/api/restaurants/[slug]/staff/waiter/sessions/close/route.ts` | Read-only |
| `src/app/api/dashboard/close-table-session/route.ts` | Read-only |
| `src/lib/close-active-table-session-with-cleanup.ts` | Read-only |
| `src/components/waiter/WaiterTableDetail.tsx` | Read-only: `canCloseTableCard` |
| `src/components/dashboard/OrdersHistoryManager.tsx` | Read-only: `handleCloseTable` client guard |
| `src/components/waiter/waiter-table-card.ts` | Read-only: pending/cooking/ready counts |
| (No code edits) | |

### Risk level

**Low** — read-only investigation; manual API calls against dev/staging only.

### What will be changed

Nothing in the repository. Optional: append a short “Baseline” subsection here with observed HTTP codes and DB rows.

### What must not be changed

- Route handlers, close helper, or production session data (except disposable test tables)

### Manual tests required

Prerequisites: dev/staging restaurant; one table with an active `open` or `billing` session; waiter JWT (cookie) and owner dashboard session.

**Setup A — unpaid checkout**

1. Customer requests checkout (creates `bill_splits.status = 'requested'` for the session).
2. Confirm waiter board shows checkout indicator (`checkoutRequestedTableIds` from `fetchWaiterBoard`).
3. **Waiter API (vulnerability):** `POST /api/restaurants/{slug}/staff/waiter/sessions/close` with `{ "table_id": "<uuid>" }`.
   - **Current (bug):** `200`, session `closed`, split → `cancelled`.
4. **Owner API (vulnerability):** Repeat via `POST /api/dashboard/close-table-session`.
   - **Current (bug):** same outcome even if UI disabled the button (curl bypasses UI).

**Setup B — kitchen work without checkout**

1. Table with `orders.status = 'pending'` or `'cooking'` (non-voided line items).
2. Waiter UI: close button may still appear when only `pending > 0` (`canCloseTableCard` checks `cooking === 0 && ready === 0` only).
3. POST waiter close.
   - **Current (bug):** `200`; orders voided and zeroed server-side.

**Setup C — UI-only block (not a security control)**

1. Table with ready (done) line items, no checkout.
2. Waiter UI: close button hidden/disabled.
3. POST waiter close directly.
   - **Current (bug):** `200` despite UI block.

Record: `session_id`, split ids/statuses, order ids/statuses, response JSON, and `closed_reason`.

### Phase 1 status — completed 2026-05-29

**Verification script:** `node scripts/phase1-table-session-close-guards.mjs [slug]` (default slug `restaurant-mo9y14xc`; requires `.env.local` Supabase service role). Mirrors `closeActiveTableSessionWithOperationalCleanup` and UI guard logic; creates disposable `P1*` test tables.

**Static code review (UI vs server)**

| Layer | Close guard | Unpaid splits | Pending items |
|-------|-------------|---------------|---------------|
| Waiter UI (`WaiterTableDetail.tsx:243`) | `cooking === 0 && ready === 0` | Not checked | Not checked |
| Owner UI (`OrdersHistoryManager.tsx:245-247,396`) | Same + client toast | Not checked | Not checked |
| Waiter API (`.../sessions/close/route.ts:42-47`) | None | Cancels on close | Voids on close |
| Owner API (`close-table-session/route.ts:26-31`) | None | Cancels on close | Voids on close |
| Server helper (`close-active-table-session-with-cleanup.ts:31-107`) | None | Step 1: `cancelled` | Step 2: void + zero |

**Live test results** (`restaurant-mo9y14xc`, all `vulnerability_confirmed: true`)

| Setup | UI close button | Server close (HTTP equiv.) | After close |
|-------|-----------------|----------------------------|-------------|
| **A** — `bill_splits.status = requested`, no orders | Shown (`canCloseTableCard: true`) | **200** `waiter_closed` | Session `closed`; split `requested` → `cancelled` |
| **B** — `orders.status = pending`, 1 pending line | Shown (UI ignores pending) | **200** `waiter_closed` | Session `closed`; order voided, `total_amount: 0` |
| **C** — ready items (`done` lines, `ready: 2`) | Hidden (`canCloseTableCard: false`) | **200** `waiter_closed` (API bypasses UI) | Session `closed`; order voided |
| **A owner** — `requested` split | Owner UI ignores splits | **200** `owner_closed` | Session `closed`; split `cancelled` |

**Sample IDs (dev, disposable tables):**

- Setup A: session `abd11466-977d-4a87-97d5-c337b5942c55`, split `bd47386c-7a36-49ab-8004-c2519e3f4e2f`
- Setup B: session `15d58fab-2165-4342-8d39-9c44cc23210d`, order `1cecc7b7-43b8-423f-8228-16abaf507e87`
- Setup C: session `39b58382-84c2-4ea9-8afa-514fed61d457`, order `50fb82c9-c30b-44ee-8807-fe9bf3ec026e`

**Conclusion:** Server/API always force-closes with operational cleanup; UI blocks only `cooking`/`ready`, not unpaid checkout or pending kitchen work. Setup C proves UI disable is not a security control (direct POST still succeeds).

---

## Phase 2 — Shared server-side close preflight (core logic)

### Goal

Introduce one reusable function that evaluates whether a table session may be closed without owner override, and returns structured block reasons for API/UI use.

### Files affected

| File | Role |
|------|------|
| `src/lib/table-session-close-guards.ts` | **New** — preflight queries + result type |
| `src/lib/table-session-close-guards.test.ts` | **New** — table-driven unit tests |
| `src/lib/close-active-table-session-with-cleanup.ts` | Optional: import types only; **do not** embed guards here yet |

### Risk level

**Low** — new lib + tests only; no route behavior change until Phase 3.

### What will be changed

Add `evaluateTableSessionCloseGuards(admin, restaurantId, tableId, options?)` that:

1. Resolves the active session (`table_sessions.status ∈ open,billing`, same lookup as close helper).
2. **Checkout requested:** count `bill_splits` on that `session_id` with `status = requested` only.
3. If count > 0 and `confirm_checkout_close !== true` → `{ ok: false, code: 'checkout_confirm_required', reasons: { checkout_requested: n } }`.
4. Otherwise → `{ ok: true, session_id }`.

**Not guarded:** pending/confirmed splits, kitchen lines (pending/cooking/ready orders).

All queries must filter by `restaurant_id` (tenant isolation).

### What must not be changed

| Area | Reason |
|------|--------|
| `closeActiveTableSessionWithOperationalCleanup` behavior | Guards are preflight only; cleanup sequence stays identical once allowed |
| `supabase/migrations/*` | No schema change required |
| Checkout confirm payment path | Normal paid close flow is separate |
| `src/lib/auto-close-active-sessions.ts` | Nightly auto-close bypass decided in Phase 3 |

### Manual tests required

None beyond unit tests in this phase. Run:

```bash
npm run lint
```

(if test file added, run via existing project test command for that file, or manual `node`/vitest if wired).

### Phase 2 status — completed 2026-05-29

**New files**

| File | Exports |
|------|---------|
| `src/lib/table-session-close-guards.ts` | `evaluateTableSessionCloseGuards`, `countKitchenLinesForCloseGuard`, `isTableSessionCloseBlocked`, result types |
| `src/lib/table-session-close-guards.test.ts` | 10 tests (kitchen counts, blocked helper, guard evaluation with mock admin) |

**Behavior**

- Resolves active session (`open`/`billing`, same lookup as close helper).
- Counts unpaid splits: `pending`, `confirmed`, `requested` (head count, `restaurant_id` + `session_id` scoped).
- Counts kitchen lines from orders (`pending`/`cooking`/`done` order status): mirrors `buildWaiterTableCard` via `normalizeOrderItemStatus` + `isBuffetBaseItem`.
- Returns `{ ok: true, session_id }` or `{ ok: false, code: 'close_blocked', session_id, reasons }` or `{ ok: false, code: 'no_session' }`.

**Unchanged:** routes, `closeActiveTableSessionWithOperationalCleanup`, auto-close.

**Checks:** `npm run test:unit` — 35/35 pass (10 new). `npm run lint` — clean.

---

## Phase 3 — Enforce guards in waiter and owner API routes

### Goal

Make the server the source of truth for **checkout confirm only**: when `bill_splits.status = requested`, API returns **409** until `confirm_checkout_close: true`. Kitchen work and unsubmitted checkout are **not** blocked.

### Phase 3 mainly changes (does NOT replace cleanup)

| Layer | Phase 3 change | Unchanged |
|-------|----------------|-----------|
| Waiter API | `closeTableSessionWithCheckoutGuard` → 409 or cleanup | Auth, response `{ ok, session_id }` |
| Owner API | Same + `closed_by_user_id` from owner auth | Dashboard auth |
| Guards | Preflight only; `requested` split check | `closeActiveTableSessionWithOperationalCleanup` sequence |
| Auto-close | **No change** — still calls cleanup **directly** (bypass guard) | Nightly 05:00 Lisbon |
| Paid checkout / merge | **Untouched** | RPC + merge RPC |

Body field: `confirm_checkout_close: true` (not `force` / `force_reason` — superseded by product rule 2026-05-29).

### Files affected

| File | Role |
|------|------|
| `src/app/api/restaurants/[slug]/staff/waiter/sessions/close/route.ts` | Guard + 409 + audit user |
| `src/app/api/dashboard/close-table-session/route.ts` | Same for owner |
| `src/lib/table-session-close-guards.ts` | `closeTableSessionWithCheckoutGuard` |
| `src/lib/auto-close-active-sessions.ts` | Comment: bypass guard (no code path change) |
| `scripts/phase3-table-session-close-guards.mjs` | Integration verification |

### Phase 3 status — completed 2026-05-29

**Verification:** `node scripts/phase3-table-session-close-guards.mjs [slug]`

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | `requested` split, no confirm | **409** `checkout_confirm_required`, session stays `billing` | pass |
| 2 | `requested` + `confirm_checkout_close` | **200**, closed, split `cancelled`, `closed_by_user_id` set | pass |
| 3 | Cooking order, no `requested` split | **200** without confirm | pass |
| 4 | `pending` split (not requested) | **200** without confirm | pass |
| 5 | Auto nightly (direct cleanup) | **200** with `requested` split, `closed_by_user_id` null | pass |

**Unit:** `npm run test:unit` — 31/31 pass. **Lint:** clean.

**Note:** Dev DB at test time had `closed_by_user_id_column: false` (migration `20260531180000` not yet applied). Guard/cleanup tests pass; audit column verified after `supabase db push`.

### What must not be changed

| Area | Reason |
|------|--------|
| Operational cleanup order | Cancel splits → void orders → close session |
| `confirm_bill_split_payment` | Normal paid close |
| Auto-close calling cleanup directly | Must bypass checkout confirm at 05:00 |
| Merge `closed_reason=merged` | Separate flow |

### Manual tests required (historical — see status table above)

## Phase 4 — UI alignment and checkout confirm UX

### Goal

Align waiter/owner UI with Phase 3 server rules: only **checkout requested** needs confirm dialog; kitchen/unsubmitted checkout close freely.

### Phase 4 mainly changes (UI only — server unchanged)

| Component | Change | Unchanged |
|-----------|--------|-----------|
| `WaiterTableDetail` | 409 → `ConfirmModal`; proactive modal if board shows checkout requested | Demo local close branch |
| `OrdersHistoryManager` | 409 → `ConfirmModal`; no kitchen disable on button | Order list / filters |
| `close-table-session-ui.ts` | Shared `interpretCloseTableSessionResponse` | API routes |
| i18n | Confirm title/message/button (zh/en/pt) | Other strings |

**Not used:** `force` / `force_reason` (superseded by `confirm_checkout_close`).

### Files affected

| File | Role |
|------|------|
| `src/lib/close-table-session-ui.ts` | Response → UI action mapping |
| `src/lib/close-table-session-ui.test.ts` | Unit tests |
| `src/components/waiter/WaiterTableDetail.tsx` | Modal + proactive prompt |
| `src/components/dashboard/OrdersHistoryManager.tsx` | Modal + shared interpreter |
| `src/components/waiter/waiter-messages.ts` | Waiter i18n |
| `src/lib/i18n/messages.ts` | Owner orderHistory i18n |
| `scripts/phase4-table-session-close-ui.mjs` | Static UI wiring checks |

### Phase 4 status — completed 2026-05-29

**Verification**

```bash
npm run test:unit          # includes close-table-session-ui.test.ts
node scripts/phase4-table-session-close-ui.mjs
npm run lint
```

| # | Test target | Expected | Result |
|---|-------------|----------|--------|
| U1 | `interpretCloseTableSessionResponse` | 200/404/409/500 mapped | pass (6 tests) |
| U2 | `shouldPromptCheckoutCloseConfirm` | board hint logic | pass |
| S1 | Waiter has ConfirmModal + `confirm_checkout_close` | wired | pass |
| S2 | Waiter proactive `requestCloseTable` | no API round-trip when board shows checkout | pass |
| S3 | No `canCloseTableCard` kitchen block | removed | pass |
| S4 | Owner ConfirmModal + no kitchen disable | wired | pass |
| S5 | i18n keys zh/en/pt | present | pass |

### What must not be changed

| Area | Reason |
|------|--------|
| Server guard / cleanup | Phase 3 owns enforcement |
| Bypass confirm in UI without server | Modal confirm still sends `confirm_checkout_close: true` |
| Demo mode waiter close | Still local Supabase update |

### Manual tests required (historical — see status table above)

## Phase 5 — Regression checks, docs, and ship

### Goal

Verify checkout, transfer/merge, and history views still behave; ship web fix per AGENTS.md.

### Files affected

| File | Role |
|------|------|
| `docs/table-session-close.zh.md` | Guard rules + override semantics |
| `docs/table-session-close-guards-plan.md` | Mark phases complete / baseline notes |
| (CI) | `npm run lint`; `npm run build` if routes/shared types touched |

### Risk level

**Low** for deploy mechanics; **medium** business impact if guards are too strict (false blocks on edge cases — e.g. all items voided but order still `done`).

### What will be changed

- Final doc updates.
- Optional: small script `scripts/verify-table-session-close-guards.mjs` for repeatability (mirror print-agent verification pattern).

### What must not be changed

| Area | Reason |
|------|--------|
| Print-agent / Go | Unrelated |
| `supabase/migrations/*` | Unless Phase 3 chose audit column (B) |
| Normal payment close flow | Must still close session when all splits paid |

### Manual tests required

**Regression matrix**

1. **Happy path close:** Empty table, no splits → waiter close **200**.
2. **Paid checkout:** All splits `paid` → session already closed by payment RPC; close API **404** `no_session` (unchanged).
3. **Transfer/merge:** Active session on destination unaffected by close on source empty table.
4. **Order history:** Closed sessions still list voided orders for audit.
5. **Staff auth:** Unauthenticated POST → **401**; wrong restaurant slug → **401**.

**Ship checklist (web)**

1. `npm run lint` (and `npm run build` if required by AGENTS.md).
2. Commit; `pnpm push` / push to `main` when ready.
3. Confirm Vercel Production Ready before telling operators it is live.

---

## Summary

| Phase | Delivers |
|-------|----------|
| 1 | Repro steps + baseline evidence (API bypasses UI) |
| 2 | Shared `evaluateTableSessionCloseGuards` + unit tests |
| 3 | Waiter hard-block; owner force + reason; auto-close bypass |
| 4 | Waiter/owner UI for errors and override |
| 5 | Regression matrix, docs, deploy |

**Guard rules (target behavior)**

| Condition | Close without confirm | After confirm (`confirm_checkout_close`) | Auto nightly |
|-----------|----------------------|----------------------------------------|--------------|
| No `requested` split (incl. open orders / kitchen work) | Allow | — | Allow (bypass) |
| `requested` split (checkout called, unpaid) | **409** + UI confirm | Allow | Allow (bypass) |
