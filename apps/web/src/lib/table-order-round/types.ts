import type { SushiRoundSettings } from '@/lib/table-order-round/settings';

export type TableOrderRoundStatus =
  | 'collecting'
  | 'pending_confirm'
  | 'cooldown'
  | 'closed'
  | 'finalize_failed';

export type TableOrderRoundRow = {
  id: string;
  restaurant_id: string;
  session_id: string;
  table_id: string;
  status: TableOrderRoundStatus;
  guest_count_snapshot: number;
  per_person_cap: number;
  submit_request_id: string | null;
  submit_requested_at: string | null;
  submit_deadline_at: string | null;
  cooldown_until: string | null;
  append_client_request_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TableOrderRoundLineRow = {
  id: string;
  round_id: string;
  menu_item_id: string;
  qty: number;
  guest_client_id: string;
  note: string;
  added_at: string;
};

/** API GET / snapshot response shape. */
export type RoundSnapshot = {
  round: TableOrderRoundRow | null;
  lines: TableOrderRoundLineRow[];
  settings: SushiRoundSettings;
  /** Live headcount used for collecting-phase cap (not frozen). */
  live_guest_count: number;
  /** Cap for collecting: per_person_cap × live_guest_count (or round.per_person_cap × snapshot when pending). */
  round_cap_total: number;
  lines_qty_total: number;
};

export type TableOrderRoundErrorCode =
  | 'round_not_collecting'
  | 'round_basket_locked'
  | 'round_cap_exceeded'
  | 'guest_count_required'
  | 'round_empty'
  | 'round_confirm_pending'
  | 'round_cooldown_active'
  | 'session_billing'
  | 'guest_client_limit'
  | 'per_person_limit_exceeded'
  | 'over_limit_price_missing'
  | 'limited_item_requires_headcount'
  | 'sushi_round_required'
  | 'sushi_round_disabled'
  | 'round_not_found'
  | 'line_not_found'
  | 'line_not_owned'
  | 'invalid_guest_client_id'
  | 'invalid_menu_item'
  | 'menu_item_not_free'
  | 'menu_item_unavailable'
  | 'finalize_not_ready'
  | 'append_failed'
  | 'round_not_pending_confirm';
