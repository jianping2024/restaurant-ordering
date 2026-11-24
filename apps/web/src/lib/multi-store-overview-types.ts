import type { DashboardTodayKpis } from '@/lib/dashboard-overview';

/** One store row of the multi-store overview (plan §8.4). Client-safe (types only). */
export type MultiStoreOverviewRow = {
  restaurantId: string;
  slug: string;
  name: string;
  /** From the store address (empty when unknown) — `restaurantCityFromAddress`. */
  city: string;
  /** 「已暂停」: excluded from totals. */
  suspended: boolean;
  /**
   * Same fields as the single-store home (`todayRevenue`, `diningUncollectedAmount`,
   * `todayTableCount`/`todayGuests`, `diningTableCount`/`diningGuests`); `revenueAvailable`
   * false → show「—」for revenue. Null when this account may not read the store's numbers
   * (staff on a suspended store).
   */
  kpis: DashboardTodayKpis | null;
};

export type MultiStoreOverview = {
  /** Lisbon business day the numbers belong to (YYYY-MM-DD). */
  todayDateKey: string;
  /** When the KPI numbers were computed (cached up to ~30 s). */
  generatedAt: string;
  rows: MultiStoreOverviewRow[];
};
