# AI Compact Schema

Purpose: fast database reference for AI coding agents.  
SQL source of truth: `supabase/migrations/20240101000000_initial_schema.sql` (squashed baseline from linked project dump, May 2026). Keep this file aligned when the schema changes.

## Tables

abnormal_operations (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, type: text [DISCOUNT_APPLIED|ITEM_DELETED|UNPAID_TABLE_CLOSED], risk_level: text [LOW|MEDIUM|HIGH], status: text [PENDING|CONFIRMED|IGNORED] default PENDING, order_id: uuid FK -> orders.id nullable, session_id: uuid FK -> table_sessions.id nullable, table_id: uuid FK -> restaurant_tables.id nullable, table_name: text nullable, operator_id: uuid FK -> auth.users.id, operator_name: text, operator_role: text, amount_impact: numeric default 0, reason: text, reason_detail: text nullable, before_data: jsonb default {}, after_data: jsonb default {}, owner_note: text nullable, confirmed_by: uuid FK -> auth.users.id nullable, confirmed_at: timestamptz nullable, source_action_id: uuid FK -> operation_logs.id nullable, created_at: timestamptz, updated_at: timestamptz)

operation_logs (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, action_type: text, entity_type: text, entity_id: uuid, operator_id: uuid FK -> auth.users.id, operator_name: text, operator_role: text, before_data: jsonb default {}, after_data: jsonb default {}, reason: text nullable, reason_detail: text nullable, ip_address: text nullable, device_info: text nullable, created_at: timestamptz)

bill_splits (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, order_ids: uuid[], split_mode: text [even|by_item|custom], persons: jsonb, result: jsonb, total_amount: numeric, status: text [pending|confirmed|requested|paid|cancelled], created_at: timestamptz, session_id: uuid FK -> table_sessions.id nullable, table_id: uuid FK -> restaurant_tables.id, display_name: text, customer_nif: text nullable, discount_rate: numeric default 0, discount_reason: text nullable, discount_reason_detail: text nullable)

session_collected_payments (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, session_id: uuid FK -> table_sessions.id, person_name: text, amount: numeric, bill_split_id: uuid FK -> bill_splits.id nullable, created_by_user_id: uuid FK -> auth.users.id nullable, created_at: timestamptz)

buffet_calendar_overrides (restaurant_id: uuid PK FK -> restaurants.id, on_date: date PK, kind: text [holiday|special])

buffet_price_rules (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, buffet_id: uuid FK -> buffets.id, time_slot_id: uuid FK -> buffet_time_slots.id, calendar_kind: text [weekday|weekend|holiday|special], valid_from: date, valid_to: date, adult_price: numeric, child_price: numeric, priority: integer, is_active: boolean, note: text nullable, created_at: timestamptz)

buffet_time_slots (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, name: text, start_time: time, end_time: time, weekdays: integer[], sort_order: integer, created_at: timestamptz)

buffets (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, name: text, is_active: boolean, description: text nullable, created_at: timestamptz, updated_at: timestamptz)

dish_feedback (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, session_id: uuid FK -> table_sessions.id, order_id: uuid FK -> orders.id, menu_item_id: uuid FK -> menu_items.id, vote: text [up|down], reasons: text[], comment: text nullable, created_at: timestamptz, updated_at: timestamptz)

feedback_sessions (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, session_id: uuid FK -> table_sessions.id, source: text, shown_at: timestamptz, completed_at: timestamptz nullable, skipped_at: timestamptz nullable, created_at: timestamptz)

menu_categories (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, parent_id: uuid FK -> menu_categories.id nullable, name_pt: text, name_en: text nullable, name_zh: text nullable, sort_order: integer, active: boolean, created_at: timestamptz, print_station_id: uuid FK -> print_stations.id nullable, item_code: varchar nullable)

menu_items (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, name_pt: text, name_en: text nullable, name_zh: text nullable, description_pt: text nullable, description_en: text nullable, price: numeric, vat_rate: numeric NOT NULL, category: text, emoji: text, available: boolean, sort_order: integer, created_at: timestamptz, image_url: text nullable, note_preset_keys: text[], category_en: text nullable, category_zh: text nullable, category_id: uuid FK -> menu_categories.id nullable, print_station_id: uuid FK -> print_stations.id nullable, item_code: varchar nullable)

orders (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, status: text [pending|cooking|done], items: jsonb, total_amount: numeric, created_at: timestamptz, updated_at: timestamptz, session_id: uuid FK -> table_sessions.id nullable, table_id: uuid FK -> restaurant_tables.id, display_name: text)

print_agent_devices (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, pairing_id: uuid FK -> print_agent_pairings.id nullable, label: text nullable, paired_at: timestamptz, valid_until: timestamptz, revoked_at: timestamptz nullable, last_seen: timestamptz nullable, routing_snapshot: jsonb nullable, agent_version: text nullable, mapped_station_count: integer nullable, last_print_at: timestamptz nullable, last_print_status: text nullable, schedule_open: boolean nullable)

print_agent_support_tokens (id: uuid PK, device_id: uuid FK -> print_agent_devices.id, restaurant_id: uuid FK -> restaurants.id, actor_user_id: uuid FK -> auth.users.id, expires_at: timestamptz, consumed_at: timestamptz nullable, created_at: timestamptz)

print_agent_pairings (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, code: text check six_digits, expires_at: timestamptz, consumed_at: timestamptz nullable, created_by: uuid FK -> auth.users.id nullable, created_at: timestamptz, revoked_at: timestamptz nullable)

print_jobs (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, type: text [order_receipt|station_ticket|pre_bill], payload: jsonb, status: text [pending|processing|done|failed], claimed_by: text nullable, attempts: integer, error_message: text nullable, created_at: timestamptz, updated_at: timestamptz, table_display: text generated_from_payload nullable, table_id: uuid generated_from_payload nullable)

print_stations (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, name_pt: text, name_en: text nullable, name_zh: text nullable, sort_order: integer, ticket_layout: text [kitchen|beverage|standard], created_at: timestamptz)

restaurant_staff_accounts (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, user_id: uuid unique FK -> auth.users.id, role: text [kitchen|waiter|cashier|frontdesk], display_name: text, login_name: text, email: text unique, created_by: uuid FK -> auth.users.id nullable, created_at: timestamptz, updated_at: timestamptz, disabled_at: timestamptz nullable)

platform_admin_accounts (id: uuid PK, user_id: uuid unique FK -> auth.users.id, role: text [support|admin], display_name: text, disabled_at: timestamptz nullable, created_at: timestamptz)

platform_admin_audit_log (id: uuid PK, actor_user_id: uuid FK -> auth.users.id nullable, action: text, target_type: text, target_id: text, restaurant_id: uuid FK -> restaurants.id nullable, metadata: jsonb default {}, created_at: timestamptz)

restaurant_tables (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, display_name: text length 1..16, sort_order: integer, deleted_at: timestamptz nullable, created_at: timestamptz)
restaurant_table_groups (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, name: text length 1..32 unique per restaurant, remarks: text nullable, sort_order: integer, created_at: timestamptz)
restaurant_table_group_members (group_id: uuid FK -> restaurant_table_groups.id, table_id: uuid FK -> restaurant_tables.id, restaurant_id: uuid FK -> restaurants.id; PK (group_id, table_id); UNIQUE (restaurant_id, table_id))

restaurants (id: uuid PK, name: text, slug: text unique, owner_id: uuid FK -> auth.users.id, logo_url: text nullable, address: text nullable, phone: text nullable, plan: text [free|pro], kitchen_password: text, waiter_password: text, geo_latitude: double precision nullable, geo_longitude: double precision nullable, print_locale: text [zh|en|pt], country_code: char(2) not null default PT, print_agent_config: jsonb, feature_flags: jsonb default {}, kitchen_password_version: integer, waiter_password_version: integer, order_radius_meters: integer range 10..10000, buffet_friday_weekend_from: time nullable, suspended_at: timestamptz nullable, suspension_reason: text nullable, created_at: timestamptz)

table_sessions (id: uuid PK, restaurant_id: uuid FK -> restaurants.id, status: text [open|billing|closed], opened_at: timestamptz, closed_at: timestamptz nullable, merge_into_session_id: uuid FK -> table_sessions.id nullable, closed_reason: text nullable, closed_by_user_id: uuid FK -> auth.users.id nullable, opened_by_user_id: uuid FK -> auth.users.id nullable, table_id: uuid FK -> restaurant_tables.id)

## Relationships

abnormal_operations.restaurant_id -> restaurants.id  
abnormal_operations.order_id -> orders.id  
abnormal_operations.session_id -> table_sessions.id  
abnormal_operations.table_id -> restaurant_tables.id  
abnormal_operations.operator_id -> auth.users.id  
abnormal_operations.confirmed_by -> auth.users.id

restaurants.owner_id -> auth.users.id

restaurant_tables.restaurant_id -> restaurants.id  
table_sessions.restaurant_id -> restaurants.id  
table_sessions.table_id -> restaurant_tables.id  
table_sessions.merge_into_session_id -> table_sessions.id  
table_sessions.closed_by_user_id -> auth.users.id
table_sessions.opened_by_user_id -> auth.users.id

orders.restaurant_id -> restaurants.id  
orders.session_id -> table_sessions.id  
orders.table_id -> restaurant_tables.id

bill_splits.restaurant_id -> restaurants.id  
bill_splits.session_id -> table_sessions.id  
bill_splits.table_id -> restaurant_tables.id

menu_categories.restaurant_id -> restaurants.id  
menu_categories.parent_id -> menu_categories.id  
menu_categories.print_station_id -> print_stations.id

menu_items.restaurant_id -> restaurants.id  
menu_items.category_id -> menu_categories.id  
menu_items.print_station_id -> print_stations.id

dish_feedback.restaurant_id -> restaurants.id  
dish_feedback.session_id -> table_sessions.id  
dish_feedback.order_id -> orders.id  
dish_feedback.menu_item_id -> menu_items.id

feedback_sessions.restaurant_id -> restaurants.id  
feedback_sessions.session_id -> table_sessions.id

buffets.restaurant_id -> restaurants.id  
buffet_time_slots.restaurant_id -> restaurants.id  
buffet_calendar_overrides.restaurant_id -> restaurants.id  
buffet_price_rules.restaurant_id -> restaurants.id  
buffet_price_rules.buffet_id -> buffets.id  
buffet_price_rules.time_slot_id -> buffet_time_slots.id

print_stations.restaurant_id -> restaurants.id  
print_jobs.restaurant_id -> restaurants.id  
print_agent_pairings.restaurant_id -> restaurants.id  
print_agent_pairings.created_by -> auth.users.id  
print_agent_devices.restaurant_id -> restaurants.id
print_agent_devices.pairing_id -> print_agent_pairings.id
print_agent_support_tokens.device_id -> print_agent_devices.id
print_agent_support_tokens.restaurant_id -> restaurants.id
print_agent_support_tokens.actor_user_id -> auth.users.id

platform_admin_accounts.user_id -> auth.users.id  
platform_admin_audit_log.actor_user_id -> auth.users.id  
platform_admin_audit_log.restaurant_id -> restaurants.id

restaurant_staff_accounts.restaurant_id -> restaurants.id  
restaurant_staff_accounts.user_id -> auth.users.id  
restaurant_staff_accounts.created_by -> auth.users.id

## Views

restaurants_public — security definer view; public menu/geo fields for customer ordering (no passwords).

## RPC / Functions (public)

| Function | Role | Notes |
|----------|------|-------|
| `confirm_bill_split_payment(restaurant_id, bill_split_id, person_index, collected_amount?, created_by_user_id?)` | authenticated, service_role | SECURITY DEFINER checkout; reads `bill_splits.discount_rate`; appends `session_collected_payments`; advisory lock per session; rejects `cancelled` splits; not anon |
| `resume_table_session_ordering(restaurant_id, table_id)` | authenticated, service_role | Set session `billing` → `open`; blocks whole-table when paid or ledger non-empty; `by_item` split always `confirmed`; even/custom `confirmed` when partial pay else `cancelled` |
| `upsert_bill_split_request(restaurant_id, session_id, table_id, display_name, order_ids, split_mode, persons, result, total_amount, customer_nif)` | authenticated, service_role | Atomic checkout request; merges `paid` under lock; not anon |
| `close_table_session_operational(restaurant_id, table_id, closed_reason, closed_by_user_id?)` | authenticated, service_role | Atomic operational close: cancel splits, void orders, close session; not anon |
| `compute_session_payment_gap(restaurant_id, session_id)` | authenticated, service_role | Returns payable/paid/gap + `is_unpaid_close` for an active session |
| `close_table_session_manual(restaurant_id, table_id, operator_user_id, closed_reason, confirm_close, unpaid_reason?, unpaid_reason_detail?)` | authenticated, service_role | Owner/frontdesk manual close; validates unpaid reason; returns audit snapshot (audit rows written in app via `recordAudit`) |
| `transfer_table_session(restaurant_id, from_table_id, to_table_id)` | authenticated, service_role | Move open session between tables |
| `merge_table_sessions(restaurant_id, source_table_id, target_table_id)` | authenticated, service_role | Merge two table sessions |
| `merge_multiple_table_sessions(restaurant_id, source_table_ids[], target_table_id)` | authenticated, service_role | Multi-source merge |
| `resolve_buffet_prices(restaurant_id, buffet_id, at?)` | (see grants in SQL) | Buffet price resolution |
| `get_active_restaurant_table(restaurant_id, table_id)` | — | Resolve non-deleted table row |
| `auth_owned_restaurant_ids()` | — | SECURITY DEFINER helper for owner RLS |
| `auth_staff_restaurant_ids()` | — | SECURITY DEFINER helper for staff RLS |
| `is_active_restaurant_staff(restaurant_id, roles?)` | — | Staff role check (default kitchen+waiter) |

Triggers / internal: `handle_updated_at`, `enforce_print_station_same_restaurant`, `seed_default_print_stations_for_restaurant`, `seed_default_restaurant_tables_for_restaurant`, `recalc_order_total_from_items`, `void_active_buffet_lines_in_items`, `void_all_line_items_for_forced_close`, `merge_split_result_paid`, `rls_auto_enable`.

## Storage

Bucket `menu-images` (public read). Owner- and frontdesk-scoped write policies on `storage.objects`; path `{restaurant_id}/{menu_item_id}.{ext}`.

## Realtime (`supabase_realtime` publication)

Tables with `REPLICA IDENTITY FULL` where filtered subscriptions need it: `orders`, `table_sessions`, `bill_splits`, `print_jobs`, buffet tables (`buffets`, `buffet_time_slots`, `buffet_price_rules`, `buffet_calendar_overrides`).

## Domain Values / Check Constraints

bill_splits.split_mode: even | by_item | custom  
bill_splits.status: pending | confirmed | requested | paid | cancelled  
buffet_calendar_overrides.kind: holiday | special  
buffet_price_rules.calendar_kind: weekday | weekend | holiday | special  
dish_feedback.vote: up | down  
orders.status: pending | cooking | done  
print_jobs.type: order_receipt | station_ticket | pre_bill  
print_jobs.status: pending | processing | done | failed  
print_stations.ticket_layout: kitchen | beverage | standard  
platform_admin_accounts.role: support | admin  
restaurant_staff_accounts.role: kitchen | waiter | cashier | frontdesk  
restaurants.plan: free | pro  
restaurants.print_locale: zh | en | pt
restaurants.country_code: ISO 3166-1 alpha-2 (e.g. PT, CN)  
restaurants.order_radius_meters: 10..10000  
table_sessions.status: open | billing | closed

## Indexes

abnormal_operations:

- abnormal_operations_pkey: PK btree(id)
- idx_abnormal_operations_restaurant_created: btree(restaurant_id, created_at DESC)
- idx_abnormal_operations_restaurant_status: btree(restaurant_id, status)

operation_logs:

- operation_logs_pkey: PK btree(id)
- idx_operation_logs_restaurant_created: btree(restaurant_id, created_at DESC)

bill_splits:

- bill_splits_pkey: PK btree(id)
- idx_bill_splits_restaurant: btree(restaurant_id)
- idx_bill_splits_session: btree(session_id)
- idx_bill_splits_one_active_per_session: unique btree(session_id) WHERE session_id IS NOT NULL AND status IN (pending, confirmed, requested)

buffet_calendar_overrides:

- buffet_calendar_overrides_pkey: PK btree(restaurant_id, on_date)

buffet_price_rules:

- buffet_price_rules_pkey: PK btree(id)
- idx_buffet_price_rules_lookup: btree(restaurant_id, buffet_id, time_slot_id, calendar_kind) WHERE is_active = true

buffet_time_slots:

- buffet_time_slots_pkey: PK btree(id)
- idx_buffet_time_slots_restaurant: btree(restaurant_id)

buffets:

- buffets_pkey: PK btree(id)
- idx_buffets_restaurant: btree(restaurant_id)

dish_feedback:

- dish_feedback_pkey: PK btree(id)
- idx_dish_feedback_restaurant_created: btree(restaurant_id, created_at DESC)
- idx_dish_feedback_vote: btree(restaurant_id, vote)
- uniq_dish_feedback_session_item: unique btree(session_id, menu_item_id)

feedback_sessions:

- feedback_sessions_pkey: PK btree(id)
- idx_feedback_sessions_restaurant_created: btree(restaurant_id, created_at DESC)
- uniq_feedback_session: unique btree(session_id)

menu_categories:

- idx_menu_categories_code_per_parent: unique btree(restaurant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim((item_code)::text))) WHERE (item_code IS NOT NULL) AND (btrim((item_code)::text) <> ''::text)
- idx_menu_categories_print_station: btree(print_station_id) WHERE print_station_id IS NOT NULL
- idx_menu_categories_restaurant: btree(restaurant_id, parent_id, sort_order)
- menu_categories_pkey: PK btree(id)

menu_items:

- idx_menu_items_category: btree(restaurant_id, category)
- idx_menu_items_category_id: btree(restaurant_id, category_id)
- idx_menu_items_category_sort_order: unique btree(restaurant_id, category_id, sort_order) WHERE category_id IS NOT NULL
- idx_menu_items_uncategorized_sort_order: unique btree(restaurant_id, sort_order) WHERE category_id IS NULL
- idx_menu_items_code_per_restaurant: unique btree(restaurant_id, lower(btrim((item_code)::text))) WHERE (item_code IS NOT NULL) AND (btrim((item_code)::text) <> ''::text)
- idx_menu_items_note_preset_keys: gin(note_preset_keys)
- idx_menu_items_print_station: btree(restaurant_id, print_station_id) WHERE print_station_id IS NOT NULL
- idx_menu_items_restaurant: btree(restaurant_id)
- menu_items_pkey: PK btree(id)

orders:

- idx_orders_restaurant: btree(restaurant_id)
- idx_orders_restaurant_table_id: btree(restaurant_id, table_id)
- idx_orders_session: btree(session_id)
- idx_orders_status: btree(restaurant_id, status)
- orders_pkey: PK btree(id)

print_agent_devices:

- idx_print_agent_devices_restaurant: btree(restaurant_id)
- print_agent_devices_pkey: PK btree(id)

print_agent_pairings:

- idx_print_agent_pairings_claim_lookup: btree(code) WHERE (consumed_at IS NULL) AND (revoked_at IS NULL)
- idx_print_agent_pairings_restaurant_expires: btree(restaurant_id, expires_at DESC)
- idx_print_agent_pairings_restaurant_pending: btree(restaurant_id, expires_at DESC) WHERE (consumed_at IS NULL) AND (revoked_at IS NULL)
- print_agent_pairings_pkey: PK btree(id)

print_jobs:

- idx_print_jobs_restaurant_status_created: btree(restaurant_id, status, created_at DESC)
- idx_print_jobs_restaurant_table_id: btree(restaurant_id, table_id, created_at DESC) WHERE table_id IS NOT NULL
- print_jobs_pkey: PK btree(id)

print_stations:

- idx_print_stations_restaurant: btree(restaurant_id, sort_order, created_at)
- print_stations_pkey: PK btree(id)

platform_admin_accounts:

- platform_admin_accounts_pkey: PK btree(id)
- platform_admin_accounts_user_id_key: unique btree(user_id)

platform_admin_audit_log:

- idx_platform_admin_audit_log_created: btree(created_at DESC)
- idx_platform_admin_audit_log_restaurant: btree(restaurant_id) WHERE restaurant_id IS NOT NULL
- platform_admin_audit_log_pkey: PK btree(id)

restaurant_staff_accounts:

- restaurant_staff_accounts_email_key: unique btree(email)
- restaurant_staff_accounts_pkey: PK btree(id)
- restaurant_staff_accounts_restaurant_id_idx: btree(restaurant_id)
- restaurant_staff_accounts_user_id_idx: btree(user_id)
- restaurant_staff_accounts_user_id_key: unique btree(user_id)

restaurant_tables:

- idx_restaurant_tables_restaurant_active: btree(restaurant_id, sort_order) WHERE deleted_at IS NULL
- restaurant_tables_active_display_name_unique: unique btree(restaurant_id, display_name) WHERE deleted_at IS NULL
- restaurant_tables_pkey: PK btree(id)

restaurants:

- idx_restaurants_suspended_at: btree(suspended_at) WHERE suspended_at IS NOT NULL
- restaurants_pkey: PK btree(id)
- restaurants_slug_key: unique btree(slug)

table_sessions:

- idx_table_sessions_merge_into: btree(merge_into_session_id)
- idx_table_sessions_restaurant_table_id: btree(restaurant_id, table_id)
- idx_table_sessions_restaurant_closed_at: btree(restaurant_id, closed_at DESC) WHERE status = 'closed'
- idx_table_sessions_status: btree(restaurant_id, status)
- table_sessions_pkey: PK btree(id)
- uniq_active_table_session: unique btree(restaurant_id, table_id) WHERE status = ANY (ARRAY['open'::text, 'billing'::text])

## RLS / Policies

Common helpers:

- Owner access usually means `restaurant_id IN (SELECT restaurants.id FROM restaurants WHERE restaurants.owner_id = auth.uid())` or `owner_id = auth.uid()`.
- Staff access uses `is_active_restaurant_staff(restaurant_id[, roles])`, `auth_staff_restaurant_ids()`, or `auth_owned_restaurant_ids()`.
- Several policies use role `{public}` but still rely on `auth.uid()` inside the predicate; treat these as auth-dependent owner checks, not necessarily anonymous write access.

abnormal_operations:

- SELECT: authenticated owner by restaurant ownership.
- UPDATE: authenticated owner by restaurant ownership, with matching `WITH CHECK`.
- INSERT: service role only (route handlers via admin client); no authenticated INSERT policy.

operation_logs:

- RLS enabled; no authenticated SELECT/INSERT/UPDATE policies (service role writes only via admin client in P1).

bill_splits:

- SELECT: authenticated cashier via `is_active_restaurant_staff(restaurant_id, ['cashier'])`.
- SELECT: authenticated owner by restaurant ownership.
- UPDATE: authenticated owner by restaurant ownership, with matching `WITH CHECK`.

buffet_calendar_overrides:

- SELECT: public read (`true`).
- INSERT/UPDATE/DELETE: owner by restaurant ownership.

buffet_price_rules:

- SELECT: public read (`true`).
- INSERT/UPDATE/DELETE: owner by restaurant ownership.

buffet_time_slots:

- SELECT: public read (`true`).
- INSERT/UPDATE/DELETE: owner by restaurant ownership.

buffets:

- SELECT: public read (`true`).
- INSERT/UPDATE/DELETE: owner by restaurant ownership.

dish_feedback:

- ALL: public read/write (`USING true`, `WITH CHECK true`). Review carefully if feedback should be restricted.

feedback_sessions:

- ALL: public read/write (`USING true`, `WITH CHECK true`). Review carefully if feedback session writes should be restricted.

menu_categories:

- SELECT: public read (`true`).
- ALL: owner by restaurant ownership.
- ALL: authenticated frontdesk via `is_active_restaurant_staff(restaurant_id, ['frontdesk'])`.

menu_items:

- SELECT: public read (`true`).
- ALL: owner by restaurant ownership.
- ALL: authenticated frontdesk via `is_active_restaurant_staff(restaurant_id, ['frontdesk'])`.

orders:

- INSERT: public insert (`WITH CHECK true`). This is intended for customer ordering but should be protected by app-level validation/rate limits.
- SELECT: authenticated owner by restaurant ownership.
- SELECT: authenticated staff via `is_active_restaurant_staff(restaurant_id)`.
- SELECT: authenticated cashier via `is_active_restaurant_staff(restaurant_id, ['cashier'])`.
- UPDATE: public owner by restaurant ownership.
- UPDATE: authenticated kitchen/waiter via `is_active_restaurant_staff(restaurant_id, ['kitchen','waiter'])`, with matching `WITH CHECK`.

print_agent_devices:

- SELECT: owner by restaurant ownership.

print_agent_pairings:

- SELECT/UPDATE: owner by restaurant ownership.
- INSERT: owner by restaurant ownership, with `WITH CHECK`.

print_jobs:

- SELECT/UPDATE/DELETE: owner by restaurant ownership.
- INSERT: owner by restaurant ownership, with `WITH CHECK`.

print_stations:

- SELECT: public read (`true`).
- ALL: owner by restaurant ownership.
- ALL: authenticated frontdesk via `is_active_restaurant_staff(restaurant_id, ['frontdesk'])`.

platform_admin_accounts:

- RLS enabled; **no policies** — `@mesa/ops` uses service role after session check.

platform_admin_audit_log:

- RLS enabled; **no policies** — `@mesa/ops` uses service role after session check.

restaurant_staff_accounts:

- ALL: authenticated owner through `auth_owned_restaurant_ids()`, with matching `WITH CHECK`.
- SELECT: authenticated staff can select own active staff account where `user_id = auth.uid()` and `disabled_at IS NULL`.

restaurant_tables:

- ALL: owner by restaurant ownership.
- SELECT: authenticated active staff kitchen/waiter/cashier can read non-deleted tables where `deleted_at IS NULL`.

restaurants:

- SELECT/INSERT/UPDATE/DELETE: owner where `owner_id = auth.uid()`; insert requires `owner_id = auth.uid()`.
- SELECT: authenticated staff can select restaurants from `auth_staff_restaurant_ids()`.

table_sessions:

- SELECT: authenticated owner by restaurant ownership.
- UPDATE: authenticated owner by restaurant ownership, with matching `WITH CHECK`.
- SELECT: authenticated staff via `is_active_restaurant_staff(restaurant_id)`.

## Important Notes

- Multi-tenant root entity is `restaurants`; most business tables reference `restaurant_id`.
- Auth ownership/staff users are linked through `auth.users`.
- Table lifecycle: `restaurant_tables` defines physical/logical tables; `table_sessions` tracks open/billing/closed dining sessions.
- Ordering flow: `orders` stores item payloads in `items` jsonb and links to restaurant/table/session. Each line snapshots `item_code` and `category_code_path` (root→leaf category codes) at append time for print labels.
- Billing flow: `bill_splits` supports even/by-item/custom splits and stores calculated result in jsonb. At most one active (`pending`/`confirmed`/`requested`) row per `session_id` (partial unique index).
- Checkout request: `upsert_bill_split_request(...)` — advisory lock per session; `FOR UPDATE` on active split; merges `paid` flags; sets `table_sessions` to `billing`.
- Checkout confirm payment: `confirm_bill_split_payment(...)` — advisory lock per session when `session_id` set; `FOR UPDATE` on `bill_splits`; rejects `cancelled`; appends `session_collected_payments` per confirm; closes `table_sessions` when all rows paid.
- Resume ordering: `resume_table_session_ordering(...)` — sets session `open`; ledger unchanged; whole-table blocked if paid or ledger has rows; **`by_item` always `confirmed`**; even/custom `confirmed` when partial pay else `cancelled`. Product rules: `docs/checkout-resume-ordering.zh.md`.
- Operational close: `close_table_session_operational(...)` — advisory lock; locks active `bill_splits` then `table_sessions`; cancels splits, voids order lines, closes session.
- Menu routing: `menu_categories` and `menu_items` can each map to `print_stations`.
- Print agent flow: `print_agent_pairings` issues six-digit pairing codes; `print_agent_devices` stores paired agent state; `print_jobs` stores queued print work.
- `restaurants.print_agent_config` JSON: `{ schedule?, poll?, credential_ttl_days? }` — agent poll/schedule; `credential_ttl_days` integer **1–365** (default **365**) sets JWT `exp` and `print_agent_devices.valid_until` on the next successful `claim` (editable in dashboard **功能管理**).
- Platform ops (`@mesa/ops`): `platform_admin_accounts` links Mesa staff to `auth.users`; `platform_admin_audit_log` records cross-tenant actions. **No RLS policies** — accessed via service role only after session check in ops API. Restaurant suspend/resume sets `restaurants.suspended_at` + `suspension_reason` (null on resume).
- Buffet pricing: `buffets` + `buffet_time_slots` + `buffet_calendar_overrides` + `buffet_price_rules` model time/calendar-sensitive prices.
- Soft deletion appears only on `restaurant_tables.deleted_at` in this schema extract.
- Indexes and RLS summaries below match the squashed baseline; verify against the SQL file when in doubt.

## When To Read Full SQL

Read `supabase/migrations/20240101000000_initial_schema.sql` when:

- changing constraints, generated columns, defaults, or check expressions
- debugging RLS, grants, storage policies, or security behavior
- adding/removing indexes or RPC definitions
- changing foreign keys

After schema edits: append a new timestamped migration (do not edit the baseline in place unless squashing again).

