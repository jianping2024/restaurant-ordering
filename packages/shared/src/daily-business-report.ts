/** Sealed Lisbon-day 经营日报 package (store → platform). Sole schema version for upload + Ops view. */
export const ANALYTICS_DAILY_SCHEMA_VERSION = 3;

export type DailyBusinessReportTopItem = {
  rank: number;
  itemId: string;
  namePt: string;
  nameEn: string | null;
  nameZh: string | null;
  consumedQuantity: number;
  amount: number;
};

export type DailyBusinessReport = {
  schemaVersion: number;
  restaurantId: string;
  businessDate: string;
  metrics: {
    revenue: number;
    adultCount: number;
    childCount: number;
    customerCount: number;
    qualifyingSessionCount: number;
  };
  topItems: DailyBusinessReportTopItem[];
};

export function parseDailyBusinessReport(body: unknown): DailyBusinessReport | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (o.schemaVersion !== ANALYTICS_DAILY_SCHEMA_VERSION) return null;
  if (typeof o.restaurantId !== 'string' || !o.restaurantId) return null;
  if (typeof o.businessDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.businessDate)) return null;
  const metrics = o.metrics;
  if (!metrics || typeof metrics !== 'object') return null;
  const m = metrics as Record<string, unknown>;
  for (const key of [
    'revenue',
    'adultCount',
    'childCount',
    'customerCount',
    'qualifyingSessionCount',
  ] as const) {
    if (typeof m[key] !== 'number' || !Number.isFinite(m[key] as number)) return null;
  }
  if (!Array.isArray(o.topItems) || o.topItems.length > 10) return null;
  const topItems: DailyBusinessReportTopItem[] = [];
  for (let i = 0; i < o.topItems.length; i += 1) {
    const item = o.topItems[i];
    if (!item || typeof item !== 'object') return null;
    const t = item as Record<string, unknown>;
    if (typeof t.rank !== 'number' || t.rank !== i + 1) return null;
    if (typeof t.itemId !== 'string' || !t.itemId) return null;
    if (typeof t.namePt !== 'string') return null;
    if (typeof t.consumedQuantity !== 'number' || typeof t.amount !== 'number') return null;
    topItems.push({
      rank: t.rank,
      itemId: t.itemId,
      namePt: t.namePt,
      nameEn: typeof t.nameEn === 'string' ? t.nameEn : null,
      nameZh: typeof t.nameZh === 'string' ? t.nameZh : null,
      consumedQuantity: t.consumedQuantity,
      amount: t.amount,
    });
  }
  return {
    schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
    restaurantId: o.restaurantId,
    businessDate: o.businessDate,
    metrics: {
      revenue: m.revenue as number,
      adultCount: m.adultCount as number,
      childCount: m.childCount as number,
      customerCount: m.customerCount as number,
      qualifyingSessionCount: m.qualifyingSessionCount as number,
    },
    topItems,
  };
}
