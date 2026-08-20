/** Bump when sealed daily metrics shape, seal rules, top-items contract, or grain change. */
export const ANALYTICS_DAILY_SCHEMA_VERSION = 4;

export type AnalyticsRange = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const ANALYTICS_RANGES: readonly AnalyticsRange[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;

/** Dish ranking payload for value-analytics (same date window as value-overview). */
export type MenuItemConsumptionRankRow = {
  rank: number;
  menuItemId: string;
  itemCode: string | null;
  namePt: string;
  nameEn: string | null;
  nameZh: string | null;
  consumedQuantity: number;
  amount: number;
};

export type MenuItemConsumptionResponse = {
  range: AnalyticsRange;
  schemaVersion: number;
  startDate: string;
  endDate: string;
  /** Top slice of the full ranking (for bar chart); same sort as `items`. */
  topItems: MenuItemConsumptionRankRow[];
  items: MenuItemConsumptionRankRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type RevenueTrendPoint = {
  /** Period key: YYYY-MM-DD | YYYY-Www | YYYY-MM | YYYY-Qn */
  date: string;
  revenue: number;
};

export type CustomerTrendPoint = {
  date: string;
  customerCount: number;
  adultCount: number;
  childCount: number;
};

export type ValueOverviewResponse = {
  range: AnalyticsRange;
  schemaVersion: number;
  revenueTrend: RevenueTrendPoint[];
  customerTrend: CustomerTrendPoint[];
};

export type AnalyticsDateWindow = {
  range: AnalyticsRange;
  today: string;
  startDate: string;
  endDate: string;
  startUtc: string;
  endExclusiveUtc: string;
  /** Calendar day keys for the max fetch/seal window (not always chart points). */
  dateKeys: string[];
};

export type ClosedSessionRow = {
  id: string;
  closed_at: string;
  /** Used to exclude operational / force / nightly closes from revenue. */
  closed_reason?: string | null;
  /** Settled checkout close billable payable snapshot. */
  settled_payable_amount?: number | null;
};

export type AnalyticsDailyRestaurantStatRow = {
  restaurant_id: string;
  business_date: string;
  revenue: number;
  adult_count: number;
  child_count: number;
  customer_count: number;
  qualifying_session_count: number;
  sealed_at: string;
  computed_at: string;
};

export type MenuCategoryRow = {
  id: string;
  category: string;
  category_en?: string | null;
  category_zh?: string | null;
};

export const ANALYTICS_MAX_CLOSED_SESSIONS = 2000;
export const ANALYTICS_QUERY_TIMEOUT_MS = 8_000;

/** Pirata production restaurant — optional backfill target. */
export const PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID =
  '19ad30c9-6c10-4845-8c89-583f3898274d';
