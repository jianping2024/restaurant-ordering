export type AnalyticsRange = '7d' | '30d';

export type RevenueTrendPoint = {
  date: string;
  revenue: number;
};

export type CustomerTrendPoint = {
  date: string;
  customerCount: number;
  adultCount: number;
  childCount: number;
};

export type TopConsumedItem = {
  rank: number;
  itemId: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  categoryPt: string;
  categoryEn?: string | null;
  categoryZh?: string | null;
  consumedQuantity: number;
  amount: number;
};

export type StockReferenceItem = {
  rank: number;
  itemId: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  categoryPt: string;
  categoryEn?: string | null;
  categoryZh?: string | null;
  consumedQuantity7d: number;
  amount7d: number;
  tag: '备货参考';
};

export type ValueOverviewResponse = {
  range: AnalyticsRange;
  revenueTrend: RevenueTrendPoint[];
  customerTrend: CustomerTrendPoint[];
  topConsumedItems: TopConsumedItem[];
  stockReferenceItems: StockReferenceItem[];
  disclaimer: string;
};

export type AnalyticsDateWindow = {
  range: AnalyticsRange;
  today: string;
  startDate: string;
  endDate: string;
  startUtc: string;
  endExclusiveUtc: string;
  dateKeys: string[];
};

export type ClosedSessionRow = {
  id: string;
  closed_at: string;
  /** Used to exclude operational / force / nightly closes from revenue. */
  closed_reason?: string | null;
};

export type MenuCategoryRow = {
  id: string;
  category: string;
  category_en?: string | null;
  category_zh?: string | null;
};

export const STOCK_REFERENCE_DISCLAIMER_ZH =
  '备货参考仅根据最近 7 天订单消耗生成，不等同于实际库存建议。';

export const ANALYTICS_MAX_CLOSED_SESSIONS = 2000;
export const ANALYTICS_QUERY_TIMEOUT_MS = 8_000;
