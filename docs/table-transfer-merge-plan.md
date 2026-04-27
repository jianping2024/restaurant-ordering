# Table Transfer & Merge Plan

## Scope

This document defines the implementation plan for table transfer and table merge in a simplified operational model:

- Current-state correctness first
- Automatic single bill flow after merge
- Minimal schema changes
- Atomic backend operations to avoid partial updates

## Business Rules

### Transfer table

- Move one active session from source table to target table.
- Target table must not already have an active session.
- Update session, related orders, and active bill request together.

### Merge tables

- Merge source active session into target active session.
- Source and target must both have active sessions.
- Source orders are reassigned to target session and target table number.
- Source session is closed with merge metadata.
- Billing flow becomes one active bill flow on target session.

## Data Model Changes

### Existing tables reused

- `table_sessions`
- `orders`
- `bill_splits`

### Added fields

- `table_sessions.merge_into_session_id` (nullable UUID)
- `table_sessions.closed_reason` (nullable text)

### Typical `closed_reason` values

- `merged`: source-table session closed during **table merge**.
- `waiter_closed`: session closed from the **waiter board** via **Close table**.
- Owner dashboard “confirm paid” may set `status = closed` without relying on `closed_reason` for behaviour.

## Backend Operation Design

Two RPC functions are used as atomic write boundaries:

- `transfer_table_session(p_restaurant_id, p_from_table, p_to_table)`
- `merge_table_sessions(p_restaurant_id, p_source_table, p_target_table)`

### Transfer flow

1. Lock source active session.
2. Check target table active-session conflict.
3. Update source session table number.
4. Update related orders table number.
5. Update active bill_splits table number.

### Merge flow

1. Lock source and target active sessions.
2. Move source orders to target session/table.
3. Consolidate active billing records into target flow.
4. Close source session with:
   - `status = closed`
   - `closed_reason = merged`
   - `merge_into_session_id = target_session_id`

## Frontend Plan

Primary entry lives in:

- `src/components/dashboard/TablesManager.tsx`

UI interactions:

- Active session list
- `Transfer` action button
- `Merge` action button
- Confirmation modal with source/target selectors
- Clear warnings for irreversible merge semantics

## Consistency Strategy

- Use RPC to avoid front-end multi-step write orchestration.
- Use optimistic failure message when session state changes:
  - "Table status changed, please refresh and retry."
- Refresh active sessions after success.

## Waiter “close table” and board visibility

### Which orders appear on kitchen / waiter boards

- After staff authenticate, both pages subscribe to Supabase Realtime (`orders`, `table_sessions`) and fetch fresh data on entry.
- **Only orders tied to an active session** are shown: sessions with `status` in `open` | `billing` define the allowed `orders.session_id` set. Rows with a null `session_id` are still shown for legacy compatibility.
- When a session closes (checkout, merge source table, waiter close table, etc.), those orders **drop off** the kitchen and waiter boards without requiring a full page reload (Realtime refresh or next fetch).

### Waiter “Close table”

- Entry: **Close table** on each table card on `/[slug]/waiter` (next to transfer / merge).
- **Shown when** the table summary has **no items cooking** and **nothing ready to serve** (kitchen has not advanced any dish to a servable state). In that state, the card may be pending-only, voided-only, or a mix.
- **Hidden when** anything is cooking or ready to serve; finish the kitchen flow or void items first.
- **Effect**: sets the table’s active `table_sessions` row to `closed`, sets `closed_at` and `closed_reason = waiter_closed`. Orders are not moved; the session simply ends. Boards update per the rules above.

## Validation Checklist

Functional checks:

- Transfer updates table number consistently in session/orders/bill request.
- Merge results in one active session and one active bill flow.
- Source session is properly closed and linked to target session.

Concurrency checks:

- Parallel operations on same source table do not create duplicate active states.
- Second conflicting operation fails gracefully with refresh hint.

Cross-page checks:

- Customer menu/bill, kitchen board, and waiter board reflect post-operation table/session state.
- After waiter **Close table**, that table’s orders disappear from waiter and kitchen boards; customers can start a new session and order again.

## Rollout Notes

- Run DB migration before enabling UI operations.
- Keep existing pages unchanged except table manager operation panel.
- If needed, gate operations with feature flag in future phase.

## Future Enhancements (Optional)

- Merge preview (item count + amount delta before confirm)
- Short window undo for latest operation
- Structured operation audit log table
