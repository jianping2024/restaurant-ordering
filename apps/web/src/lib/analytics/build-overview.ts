import { auditMoney } from '@/lib/audit/money';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import type {
  ClosedSessionRow,
  CustomerTrendPoint,
  RevenueTrendPoint,
  StockReferenceItem,
  TopConsumedItem,
} from '@/lib/analytics/analytics.types';
import type { MenuCategoryRow } from '@/lib/analytics/analytics.types';
import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';
import { sessionGuestCounts, sessionRevenue } from '@/lib/analytics/qualifying';
import type { BillSplit, Order } from '@/types';

export function buildRevenueTrend(
  dateKeys: string[],
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, Order[]>,
  splitsBySession: Map<string, BillSplit[]>,
  forcedClosedSessionIds: Set<string> = new Set(),
): RevenueTrendPoint[] {
  const daily = new Map<string, number>();
  for (const key of dateKeys) daily.set(key, 0);

  for (const session of sessions) {
    if (!session.closed_at) continue;
    if (forcedClosedSessionIds.has(session.id)) continue;
    
    const bucket = sessionDateKeyFromIso(session.closed_at);
    const orders = ordersBySession.get(session.id) || [];
    const splits = splitsBySession.get(session.id) || [];
    const revenue = sessionRevenue(orders, splits, true);
    daily.set(bucket, auditMoney((daily.get(bucket) || 0) + revenue));
  }

  return dateKeys.map((date) => ({ date, revenue: daily.get(date) || 0 }));
}

export function buildCustomerTrend(
  dateKeys: string[],
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, Order[]>,
): CustomerTrendPoint[] {
  const adultsByDay = new Map<string, number>();
  const childrenByDay = new Map<string, number>();
  for (const key of dateKeys) {
    adultsByDay.set(key, 0);
    childrenByDay.set(key, 0);
  }

  for (const session of sessions) {
    if (!session.closed_at) continue;
    const bucket = sessionDateKeyFromIso(session.closed_at);
    const orders = ordersBySession.get(session.id) || [];
    const { adults, children } = sessionGuestCounts(orders);
    adultsByDay.set(bucket, (adultsByDay.get(bucket) || 0) + adults);
    childrenByDay.set(bucket, (childrenByDay.get(bucket) || 0) + children);
  }

  return dateKeys.map((date) => {
    const adultCount = adultsByDay.get(date) || 0;
    const childCount = childrenByDay.get(date) || 0;
    return {
      date,
      adultCount,
      childCount,
      customerCount: adultCount + childCount,
    };
  });
}

function localizedCategoryFields(
  cat: MenuCategoryRow | undefined,
): Pick<TopConsumedItem, 'categoryPt' | 'categoryEn' | 'categoryZh'> {
  return {
    categoryPt: cat?.category || '—',
    categoryEn: cat?.category_en ?? null,
    categoryZh: cat?.category_zh ?? null,
  };
}

function baseItemFields(
  row: MenuItemAgg,
  index: number,
  categories: Map<string, MenuCategoryRow>,
) {
  return {
    rank: index + 1,
    itemId: row.itemId,
    namePt: row.namePt,
    nameEn: row.nameEn,
    nameZh: row.nameZh,
    ...localizedCategoryFields(categories.get(row.itemId)),
  };
}

export function mapTopConsumedItems(
  ranked: MenuItemAgg[],
  categories: Map<string, MenuCategoryRow>,
): TopConsumedItem[] {
  return ranked.map((row, index) => ({
    ...baseItemFields(row, index, categories),
    consumedQuantity: row.consumedQuantity,
    amount: row.amount,
  }));
}

export function mapStockReferenceItems(
  ranked: MenuItemAgg[],
  categories: Map<string, MenuCategoryRow>,
): StockReferenceItem[] {
  return ranked.map((row, index) => ({
    ...baseItemFields(row, index, categories),
    consumedQuantity7d: row.consumedQuantity,
    amount7d: row.amount,
    tag: '备货参考' as const,
  }));
}
