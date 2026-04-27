# Table Transfer / Merge Acceptance Checklist

## Transfer table

1. Prepare an active session on source table (e.g. table 5), target table has no active session.
2. Run transfer from table manager.
3. Verify:
   - `table_sessions.table_number` is updated to target table.
   - `orders.table_number` under the moved session are updated.
   - Active `bill_splits.table_number` under the moved session are updated.
   - Customer page on target table can continue checkout flow.

## Merge tables

1. Prepare active sessions on source and target tables.
2. Submit orders on both tables.
3. Run merge from table manager.
4. Verify:
   - Source orders move to target `session_id`.
   - Source session becomes `closed` with `closed_reason = merged`.
   - Source session has `merge_into_session_id = target session`.
   - Only one active bill flow remains for the target session.

## Concurrency

1. Open two browser tabs on table manager.
2. In tab A, transfer or merge a source table.
3. In tab B, execute another operation on the same source table.
4. Verify:
   - Tab B receives failure prompt and refresh hint.
   - No duplicate active session is created for one table.

## Cross-page consistency

1. After transfer/merge, refresh:
   - Customer menu/bill pages
   - Kitchen board
   - Waiter board
2. Verify table numbers and order grouping are consistent.

## Waiter closes table (no cooking / no ready-to-serve)

1. Open a session on a table with only **pending** items, or only **voided** items, or both — and **no** item in **cooking** or **done** (ready) on the waiter card.
2. Confirm **Close table** is visible on the waiter board; click it.
3. Verify:
   - Active `table_sessions` for that table is `closed` with `closed_reason = waiter_closed`.
   - The table card disappears from the waiter board without a full page reload.
   - The same orders no longer appear on the **kitchen** board (kitchen uses the same active-session filter).
4. Open the customer menu for that table again and confirm a **new** order can start (new session).
