# Table Transfer / Merge Acceptance Checklist

> Requires [restaurant-tables-design.zh.md](./restaurant-tables-design.zh.md) migration: tables identified by **`table_id`**, UI shows **`display_name`** (e.g. `A-05`).  
> Replace example “table 5” with actual **`table_id` UUIDs** and display names when executing tests.

## Transfer table

1. Prepare an active session on source table (e.g. display **A-05**), target table has no active session (e.g. **A-08**).
2. Run transfer from table manager (or waiter detail); selectors show **display_name**, RPC uses **`table_id`**.
3. Verify:
   - `table_sessions.table_id` is the **target** table id (same session row id as before).
   - `orders.table_id` and **`orders.display_name` snapshot** match target table under the moved session.
   - Active `bill_splits.table_id` and **`display_name` snapshot** match target table.
   - Customer page at `/{slug}/menu?table_id={target_uuid}` can continue checkout flow.
   - Kitchen / waiter boards show orders under **target display_name**, not source.

## Merge tables

1. Prepare active sessions on source and target tables (different **`table_id`**).
2. Submit orders on both tables.
3. Run merge from table manager (or waiter); note source and target **display_name** values.
4. Verify:
   - Source orders move to target `session_id`.
   - Source orders’ **`table_id`** and **`display_name` snapshot** = target table current values.
   - Source session becomes `closed` with `closed_reason = merged`.
   - Source session has `merge_into_session_id = target session id`.
   - Only one active bill flow remains for the target session.
   - Customer on source URL `?table_id={source_uuid}` on **bill page** redirects to **`table_id={target_uuid}`**.

## Multi-source merge (owner table manager)

1. Active sessions on tables A, B, C; merge A + B into C.
2. Verify sequential merge completes; final state same as two single merges into C.

## Concurrency

1. Open two browser tabs on table manager.
2. In tab A, transfer or merge using a source **`table_id`**.
3. In tab B, execute another operation on the same source **`table_id`**.
4. Verify:
   - Tab B receives failure prompt and refresh hint.
   - No duplicate active session for one **`table_id`**.

## Cross-page consistency

1. After transfer/merge, check without manual full reload where Realtime applies:
   - Customer menu/bill pages (`?table_id=`)
   - Kitchen board
   - Waiter board
2. Verify grouping by **`table_id`** and labels by **display_name** are consistent everywhere.

## Soft-deleted table

1. Soft-delete a table with no active session (`deleted_at` set).
2. Verify:
   - Table hidden from settings active list.
   - RPC transfer/merge involving that **`table_id`** fails.
   - Old QR (`?table_id={deleted_uuid}`) returns table-not-available on menu/append.

## Waiter closes table (no cooking / no ready-to-serve)

1. Open a session on a table with only **pending** items, or only **voided** items, or both — and **no** item in **cooking** or **done** on the waiter card.
2. Confirm **Close table** is visible; click it.
3. Verify:
   - Active `table_sessions` for that **`table_id`** is `closed` with `closed_reason = waiter_closed`.
   - The table card disappears from the waiter board without a full page reload.
   - The same orders no longer appear on the **kitchen** board.
4. Open `/{slug}/menu?table_id={same_uuid}` and confirm a **new** order can start (new session).

## Print payload (`table_id` + `display_name`)

1. Place an order; verify enqueued **`station_ticket`** (and manual **`order_receipt` / `pre_bill`** if applicable) payload contains **both** `table_id` and `display_name`.
2. Run print-agent or `npm run printlog` in dev: ticket shows **`display_name`** (e.g. `A-05`); **must not** show UUID.
3. After **transfer** to another table, enqueue a new receipt: payload **`table_id`** = target table; **`display_name`** = target current display name.

---

## Display name rename (regression)

1. Rename target table **display_name** in settings (e.g. `A-08` → `窗边 8`) **without** changing **`table_id`**.
2. Verify:
   - QR URL unchanged (`table_id` same).
   - Transfer/merge selectors show new name.
   - **Historical** closed orders keep old **display_name snapshot**; **new** orders after rename use new snapshot.
   - Reprint / new **`print_jobs`** after rename: payload **`display_name`** matches new name; **`table_id`** unchanged; thermal output shows **display_name only** (no UUID).

---

**Version:** 2026-05-26 (aligned with `table_id` table model + print payload v3)
