// ============================================================
// 全局类型定义
// ============================================================

export type { RestaurantTable, RestaurantTableRow } from '@/lib/restaurant-tables';

export type Plan = 'free' | 'pro';
export type OrderStatus = 'pending' | 'cooking' | 'done';
export type OrderItemStatus = 'pending' | 'cooking' | 'done' | 'voided';
export type SessionStatus = 'open' | 'billing' | 'closed';
export type Category = string;
export type SplitMode = 'even' | 'by_item' | 'custom';
export type BillStatus = 'pending' | 'confirmed' | 'requested' | 'paid' | 'cancelled';
export type Language = 'pt' | 'en' | 'zh';
export type DishFeedbackVote = 'up' | 'down';
export type PrintStationTicketLayout = 'kitchen' | 'beverage' | 'standard';
export type StaffAccountRole = 'kitchen' | 'waiter' | 'cashier';

export interface RestaurantStaffAccount {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: StaffAccountRole;
  display_name: string;
  login_name: string;
  email: string;
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
  ticket_layout: PrintStationTicketLayout;
  created_at: string;
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
  plan: Plan;
  /** bcrypt hash; never send to browser */
  kitchen_password?: string;
  waiter_password?: string;
  /** Ticket / station_ticket payload locale (pt = pt-PT semantics); default pt */
  print_locale?: 'zh' | 'en' | 'pt';
  /** Lisbon local time: Friday at/after this → weekend buffet pricing; null = off. */
  buffet_friday_weekend_from?: string | null;
  /** Owner toggles for optional product modules; see `src/lib/restaurant-features.ts`. */
  feature_flags?: Record<string, boolean> | null;
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
  name: string;       // 显示名称（根据语言）
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
  /** Snapshot from menu_items.item_code at append time (optional on legacy rows). */
  item_code?: string | null;
  item_status?: OrderItemStatus; // 菜品级出餐状态
  batch_id?: string; // 同一餐次内的加单批次
  started_at?: string;
  done_at?: string;
  added_at?: string;
  voided_at?: string;
  void_reason?: string;
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

/** Request body for guest/waiter order append (see guest-order-append-price-trust.zh.md). */
export interface OrdersAppendRequestBody {
  table_id: string;
  items: AppendCartLineInput[];
  latitude?: number;
  longitude?: number;
  waiter_flow?: boolean;
}

/** Append cart limits (shared with resolve-append-cart-items in phase 2). */
export const APPEND_CART_MAX_LINES = 80;
export const APPEND_CART_QTY_MIN = 1;
export const APPEND_CART_QTY_MAX = 99;
export const APPEND_CART_NOTE_MAX_LEN = 500;

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

export interface SplitPerson {
  name: string;
  items?: string[];  // by_item 模式：菜品 id 列表
  amount?: number;   // custom 模式：手动金额
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
