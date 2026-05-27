# Table Transfer & Merge Plan

> **Identity model:** Stable `table_id` (UUID) + mutable `display_name` (e.g. `A-01`).  
> See [restaurant-tables-design.zh.md](./restaurant-tables-design.zh.md) for the full table model. This doc covers transfer / merge / close-table behaviour under **`table_id`** and required RPC changes. Implement after the table migration.  
> **Forced table close (cancel unpaid splits, void order lines, close session):** see [table-session-close.zh.md](./table-session-close.zh.md) (Chinese; canonical behaviour).

---

## Scope

This document defines the implementation plan for table transfer and table merge:

- Current-state correctness first
- Automatic single bill flow after merge
- Minimal schema changes (RPC params and FK fields only, on top of `table_id` model)
- Atomic backend operations to avoid partial updates

## Business Rules

### Transfer table

- Move one active session from **source table** (`from_table_id`) to **target table** (`to_table_id`).
- Target must not already have an active session (`uniq_active_table_session` on `(restaurant_id, table_id)`).
- Update session, related orders, and active bill splits with **`table_id`**; refresh **`display_name` snapshot** on active rows to the target table’s current display name.

### Merge tables

- Merge source active session into target active session.
- Both tables must have active sessions; **`table_id` must differ**.
- Source orders move to target **`session_id`** with target **`table_id` + `display_name` snapshot**.
- Source session closes with merge metadata.
- Billing converges to one active bill flow on the target session.

### Close table (waiter / owner)

- Resolve active `table_sessions` by **`table_id`**; behaviour unchanged aside from identity field.

---

## Data Model

### Tables

- `restaurant_tables` — validate `table_id` belongs to restaurant and **`deleted_at IS NULL`**
- `table_sessions` — **`table_id` FK** (no `table_number`)
- `orders` — **`table_id` + `display_name` snapshot**
- `bill_splits` — **`table_id` + `display_name` snapshot**

### Session fields (existing)

- `table_sessions.merge_into_session_id` (nullable UUID)
- `table_sessions.closed_reason` (nullable text)

### Typical `closed_reason` values

- `merged`: source session closed during merge.
- `waiter_closed`: closed from waiter board **Close table**.
- Owner confirm-paid may set `status = closed` without relying on `closed_reason`.

### Constraints (after table migration)

- Active session uniqueness: `UNIQUE (restaurant_id, table_id) WHERE status IN ('open', 'billing')`
- RPC must reject soft-deleted tables (`deleted_at IS NOT NULL`)

---

## Backend Operation Design

Three RPC functions as atomic boundaries (**parameters change from text table labels to UUID `table_id`**):

| RPC | Signature (target) |
|-----|-------------------|
| Transfer | `transfer_table_session(p_restaurant_id uuid, p_from_table_id uuid, p_to_table_id uuid) returns uuid` |
| Merge | `merge_table_sessions(p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid) returns uuid` |
| Multi-source merge | `merge_multiple_table_sessions(p_restaurant_id uuid, p_source_table_ids uuid[], p_target_table_id uuid) returns uuid` |

**Grants:** `authenticated` only (staff / owner); **not** `anon`.

### Transfer flow

1. Validate both `table_id`s belong to restaurant and are not soft-deleted; ids differ.
2. Load target `display_name` (`v_target_display`).
3. Lock source active session (`table_id = p_from_table_id`) `FOR UPDATE`.
4. Ensure target has **no** active session.
5. Update session: `table_id = p_to_table_id`.
6. Update active orders: `table_id`, `display_name = v_target_display` (same session / table filters as today).
7. Update active `bill_splits` similarly.
8. Return session id (same session row, now on target table).

### Merge flow

1. Validate table ids; load target `display_name`.
2. Lock source and target active sessions `FOR UPDATE`.
3. Attach orphan bill splits to sessions (unchanged logic).
4. Move source active orders to target session with target `table_id` + `display_name` snapshot.
5. Merge active bill splits; consolidate splits onto target session.
6. Close source session: `closed`, `closed_reason = merged`, `merge_into_session_id = target session id`.
7. Return **target session** id.

### Multi-source merge

- Loop `p_source_table_ids`, call `merge_table_sessions` for each into `p_target_table_id` (same ordering as current impl).
- Any failure rolls back the transaction.

---

## Customer URL after merge

Guests scanning the **source** table QR (`?table_id=source_uuid`) after merge still resolve to that table (same `table_id` / `display_name`). They do **not** follow `merge_into_session_id` to the target.

- No active session on the source table → `active_session` is null; menu shows that table until staff opens a new session / posts buffet.
- Bill page with no session redirects to menu with the **same** `table_id`, not the merge target.
- `merge_into_session_id` is staff/audit only.

---

## Frontend Plan

### Entry points

| Role | File |
|------|------|
| Owner table manager | `src/components/dashboard/TablesManager.tsx` |
| Waiter table detail | `src/components/waiter/WaiterTableDetail.tsx` |
| Waiter API | `src/app/api/restaurants/[slug]/staff/waiter/tables/action/route.ts` |

### UI

- Active session list: show **`display_name`**, carry **`table_id`** internally.
- Transfer / merge selectors: display names; RPC args use **`table_id`**.
- Confirm modals: project-standard **Modal**; merge must warn irreversibility.
- Waiter links: `/{slug}/waiter/[tableId]` (UUID segment).

### Data loading

- Table list from **`restaurant_tables`** (`deleted_at IS NULL`), not `restaurants.table_numbers`.
- Board grouping key: **`table_id`**; labels: **`display_name`**.

---

## Consistency Strategy

- RPC-only writes; no multi-step client orchestration.
- On conflict: “Table status changed, please refresh and retry.”
- Refresh active sessions after success.
- Drop reliance on `orders.session_id IS NULL` legacy path after table migration wipe.

---

## Waiter “close table” and board visibility

### Kitchen / waiter boards

- After staff auth, subscribe to Realtime and fetch on entry.
- Show orders only when tied to active sessions (`open` | `billing`).
- Closed sessions (checkout, merge source, waiter close) drop orders from boards automatically.

### Waiter “Close table”

- Same visibility rules as before (no cooking / no ready-to-serve).
- Closes active session for **`table_id`** with `closed_reason = waiter_closed`.

---

## Validation Checklist

Functional:

- Transfer: consistent **`table_id`** and target **`display_name` snapshot** on session / orders / bill splits.
- Merge: one active session + one bill flow; source `closed_reason = merged`.
- Customer bill on source URL redirects to target **`table_id`**.
- Boards group by **`table_id`**, label by **display_name**.

Concurrency:

- No duplicate active sessions per table; second op fails gracefully.

Cross-page:

- Menu / bill / kitchen / waiter reflect post-op state.
- After waiter close, same QR (`table_id`) allows a **new** session.

Edge cases:

- Soft-deleted table ids rejected by RPC.
- Merged orders show **target display_name** on UI and new prints.
- **Print payload** after transfer/merge: new jobs carry target **`table_id` + `display_name` snapshot**; agent prints **display_name only** (see [restaurant-tables-design.zh.md](./restaurant-tables-design.zh.md) §8). Already-enqueued jobs keep original snapshot.

See [table-transfer-merge-acceptance.md](./table-transfer-merge-acceptance.md) for manual test steps.

---

## Rollout Notes

- Ship with [restaurant-tables-design.zh.md](./restaurant-tables-design.zh.md) migration; drop text-table RPC params and `?table=` URLs.
- Optional feature flag later.

---

## Future Enhancements (Optional)

- Merge preview (item count + amount delta)
- Short undo window
- Audit log with `from_table_id` / `to_table_id` / actor

---

**Version:** 2026-05-26 (aligned with `table_id` + `display_name` table model v2)
