// ============================================================
// 全局类型定义
// ============================================================

export type { RestaurantTable, RestaurantTableRow } from '@/lib/restaurant-tables';
import type { BuffetServiceMode } from '@mesa/shared';
export type { BuffetServiceMode };

export type Plan = 'basic' | 'pro';
export type OrderStatus = 'pending' | 'cooking' | 'done';
/** pending→cooking(备餐)→ready(已出餐, often display-only)→done(已上桌); voided */
export type OrderItemStatus = 'pending' | 'cooking' | 'ready' | 'done' | 'voided';
export type SessionStatus = 'open' | 'billing' | 'closed';
export type Category = string;
export type SplitMode = 'whole_table' | 'even' | 'by_item' | 'custom';
export type BillStatus = 'pending' | 'confirmed' | 'requested' | 'paid' | 'cancelled';
/** Customer/menu UI language — same set as dashboard {@link UILanguage}. */
export type Language = 'pt' | 'en' | 'zh' | 'es' | 'fr' | 'de';
export type DishFeedbackVote = 'up' | 'down';
export type StaffAccountRole = 'kitchen' | 'waiter' | 'cashier' | 'frontdesk' | 'owner' | 'custom';

export interface RestaurantStaffAccount {
  id: string;
  restaurant_id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  /** RLS coarse label (preset key or `custom`). */
  role: string;
  display_name: string;
  login_name: string;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
}

export type PrintJobType = 'order_receipt' | 'station_ticket' | 'pre_bill';
export type PrintJobStatus = 'pending' | 'processing' | 'done' | 'failed';

/** Dashboard / API list row (no full payload). */
export interface PrintJobSummary {
  id: string;
  type: PrintJobType;
  status: PrintJobStatus;
  created_at: string;
  error_message: string | null;
  /** From generated column `table_display` when present. */
  table_display?: string | null;
  table_id?: string | null;
}

export interface PrintStation {
  id: string;
  restaurant_id: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  sort_order: number;
  created_at: string;
  /** Kitchen screen workflow for this station (plan: station-kitchen-screens). */
  kitchen_enabled?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  /** Max distance (m) from restaurant coords for customer orders; default 50. */
  order_radius_meters?: number;
  /** Min seconds between two customer add-to-cart submissions; default 5. */
  order_cooldown_seconds?: number;
  /** Operation log retention in calendar days; default 7, range 7-90. */
  operation_log_retention_days?: number;
  plan: Plan;
  /** Pro membership expiry (UTC); null with plan=pro means no pro expiry. */
  pro_valid_until?: string | null;
  /** bcrypt hash; never send to browser */
  kitchen_password?: string;
  waiter_password?: string;
  /** Ticket / station_ticket payload locale (pt = pt-PT semantics); default pt */
  print_locale?: 'zh' | 'en' | 'pt';
  country_code?: string;
  /** Lisbon local time: Friday at/after this → weekend buffet pricing; null = off. */
  buffet_friday_weekend_from?: string | null;
  /**
   * classic = unlimited menu after open; sushi = optional per-person limits + overage price.
   * Set only via Ops (create / restaurant edit); dashboard is read-only.
   * See `@mesa/shared` buffet-service-mode.
   */
  buffet_service_mode?: BuffetServiceMode;
  /** Owner toggles for optional product modules; see `src/lib/restaurant-features.ts`. */
  feature_flags?: Record<string, boolean> | null;
  /** Platform license clock (Lisbon end-of-day); null = unlimited. */
  license_valid_until?: string | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  created_at: string;
}

/** Owner settings form (password hashes excluded). */
export type RestaurantSettingsProfile = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'slug'
  | 'address'
  | 'phone'
  | 'geo_latitude'
  | 'geo_longitude'
  | 'order_radius_meters'
  | 'country_code'
  | 'feature_flags'
>;

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name_pt: string;
  name_en?: string;
  name_zh?: string;
  description_pt?: string;
  description_en?: string;
  description_zh?: string;
  price: number;
  /**
   * Sushi mode: max included portions per guest (adult+child). Null = unlimited.
   * Requires `over_limit_unit_price` when set.
   */
  per_person_qty_limit?: number | null;
  /** Unit price beyond free allowance; required when `per_person_qty_limit` is set. */
  over_limit_unit_price?: number | null;
  /** VAT / IVA rate in percent (e.g. 23 for 23%). */
  vat_rate: number;
  category: Category;
  category_id?: string | null;
  /** Optional code (max 10) for thermal ticket prefix. */
  item_code?: string | null;
  print_station_id?: string | null;
  category_en?: Category | null;
  category_zh?: Category | null;
  emoji: string;
  image_url?: string | null;
  note_preset_keys?: string[];
  available: boolean;
  sort_order: number;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  parent_id?: string | null;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  /** Optional code (max 10) for thermal ticket prefix. */
  item_code?: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  print_station_id?: string | null;
}

export type OrderItemKind = 'menu' | 'buffet_base';

export interface OrderItem {
  id: string;         // menu_item.id, or synthetic e.g. buffet:<uuid>
  name: string;       // 下单快照：写入时等于 name_pt；屏上显示走 resolveMenuItemLocalizedName
  name_pt: string;
  name_en?: string;
  name_zh?: string;
  qty: number;
  note?: string;
  price: number;
  emoji: string;
  /** 缺省视为普通菜品（加餐） */
  kind?: OrderItemKind;
  buffet_id?: string;
  adult_count?: number;
  child_count?: number;
  adult_unit_price?: number;
  child_unit_price?: number;
  price_rule_id?: string;
  /** Snapshot from menu_items.item_code at append time. */
  item_code?: string | null;
  /** Snapshot: sushi per-person free allowance at append time (limited dishes only). */
  per_person_qty_limit?: number | null;
  /** Snapshot: unit price billed beyond the free allowance (pairs with the limit). */
  over_limit_unit_price?: number | null;
  /** Snapshot: root→leaf category item_code path at append time (print label prefix). */
  category_code_path?: string[];
  item_status?: OrderItemStatus; // 菜品级出餐状态
  batch_id?: string; // 同一餐次内的加单批次
  started_at?: string;
  done_at?: string;
  ready_at?: string;
  added_at?: string;
  voided_at?: string;
  void_reason?: string;
  /**
   * Kitchen remake line: not shown on guest ordered list; not billed.
   * See docs/product/station-kitchen-screens.zh.md §9.
   */
  kitchen_remake?: boolean;
  /** Snapshot station at remake/prep routing time when set. */
  print_station_id?: string | null;
}

export interface KitchenScreen {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  station_ids: string[];
}

/**
 * Client → `POST /api/restaurants/{slug}/orders/append` cart line (trusted fields only).
 * Server resolves `menu_item_id` against `menu_items` and builds {@link OrderItem}.
 */
export interface AppendCartLineInput {
  menu_item_id: string;
  qty: number;
  note?: string;
}

/** Request body for guest/waiter order append (see menu-order-append-price-trust.zh.md). */
export interface OrdersAppendRequestBody {
  table_id: string;
  items: AppendCartLineInput[];
  /** UUID — one submit intent; server dedupes per session. */
  client_request_id: string;
  latitude?: number;
  longitude?: number;
  waiter_flow?: boolean;
}

/** Append cart limits (shared with resolve-append-cart-items in phase 2). */
export const APPEND_CART_MAX_LINES = 80;
export const APPEND_CART_QTY_MIN = 1;
export const APPEND_CART_QTY_MAX = 99;
/** Single dish note max length (UI + API); ~3 station-slip wrap lines. */
export const APPEND_CART_NOTE_MAX_LEN = 120;

export function clampAppendCartNote(note: string): string {
  return note.slice(0, APPEND_CART_NOTE_MAX_LEN);
}

/** Sole same-row note merge (cart presets / second 下单 onto the same guest+item). */
export function mergeAppendCartNotes(a: string, b: string): string {
  const left = clampAppendCartNote(a.trim());
  const right = clampAppendCartNote(b.trim());
  if (!left) return right;
  if (!right || left.includes(right)) return left;
  return clampAppendCartNote(`${left}; ${right}`);
}

export interface Buffet {
  id: string;
  restaurant_id: string;
  name: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuffetTimeSlot {
  id: string;
  restaurant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  sort_order: number;
  created_at: string;
}

export type BuffetCalendarKind = 'weekday' | 'weekend' | 'holiday' | 'special';

export interface BuffetPriceRule {
  id: string;
  restaurant_id: string;
  buffet_id: string;
  time_slot_id: string;
  calendar_kind: BuffetCalendarKind;
  valid_from: string;
  valid_to: string;
  adult_price: number;
  child_price: number;
  priority: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export interface BuffetCalendarOverride {
  restaurant_id: string;
  on_date: string;
  kind: 'holiday' | 'special';
}

export interface Order {
  id: string;
  restaurant_id: string;
  session_id?: string | null;
  table_id: string;
  display_name: string;
  status: OrderStatus;
  items: OrderItem[];
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface SplitPersonItemShare {
  key: string;
  qty_num: number;
  qty_den: number;
  /** Buffet by-item: adult vs child head pricing. */
  guest_type?: 'adult' | 'child';
}

export interface SplitPerson {
  name: string;
  /** @deprecated Legacy by_item: line keys only (equal split). Prefer item_shares. */
  items?: string[];
  item_shares?: SplitPersonItemShare[];
  amount?: number;
}

export interface SplitResult {
  name: string;
  amount: number;
  paid?: boolean;
  items?: { name: string; qty: number; price: number }[];
}

export interface BillSplit {
  id: string;
  restaurant_id: string;
  session_id?: string | null;
  table_id: string;
  display_name: string;
  order_ids: string[];
  split_mode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  total_amount: number;
  status: BillStatus;
  created_at: string;
  /** Optional Portuguese NIF (9 digits) from guest checkout request */
  customer_nif?: string | null;
  /** Checkout discount percent (0–100) for the whole bill */
  discount_rate?: number;
  discount_reason?: string | null;
  discount_reason_detail?: string | null;
}

export interface FeedbackSession {
  id: string;
  restaurant_id: string;
  session_id: string;
  source: string;
  shown_at: string;
  completed_at?: string | null;
  skipped_at?: string | null;
  created_at: string;
}

export interface DishFeedback {
  id: string;
  restaurant_id: string;
  session_id: string;
  order_id: string;
  menu_item_id: string;
  vote: DishFeedbackVote;
  reasons: string[];
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: SessionStatus;
  opened_at: string;
  closed_at?: string | null;
  merge_into_session_id?: string | null;
  closed_reason?: string | null;
  closed_by_user_id?: string | null;
  opened_by_user_id?: string | null;
}

// 购物车条目
export interface CartItem {
  menuItemId: string;
  name_pt: string;
  name_en?: string;
  name_zh?: string;
  price: number;
  emoji: string;
  qty: number;
  note?: string;
  notePresetKeys?: string[];
}
