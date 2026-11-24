import { storeMatchesSearch } from '@mesa/shared';
import { totalGuestsFromCounts } from '@/lib/buffet-order';
import type { MultiStoreOverviewRow } from '@/lib/multi-store-overview-types';
import type { ListPageSize } from '@/lib/paginate-list';

/**
 * Pure table model for the multi-store overview page (plan §8.4): scope + search filter,
 * column sort, footer totals. Numbers come only from 3A's `MultiStoreOverviewRow.kpis`.
 */

export type OverviewScope =
  | { kind: 'all' }
  | { kind: 'city'; cities: readonly string[] }
  | { kind: 'pick'; ids: readonly string[] };

export type OverviewSortKey = 'name' | 'collected' | 'uncollected' | 'today' | 'dining';
export type OverviewSort = { key: OverviewSortKey; dir: 1 | -1 };

export const OVERVIEW_DEFAULT_SORT: OverviewSort = { key: 'collected', dir: -1 };
/** Rows per page — paginate only above this many stores. */
export const OVERVIEW_PAGE_SIZE: ListPageSize = 50;

/** One displayed row; `null` = 「—」 (no KPIs for this account, or revenue unreadable). */
export type OverviewRowView = {
  row: MultiStoreOverviewRow;
  collected: number | null;
  uncollected: number | null;
  todayTables: number | null;
  todayGuests: number | null;
  diningTables: number | null;
  diningGuests: number | null;
};

/**
 * Same visibility as the single-store home: `revenueAvailable=false` hides 已收 / 未收 /
 * 今日桌人 (bundle failed — no fake €0); live floor numbers stay.
 */
export function overviewRowView(row: MultiStoreOverviewRow): OverviewRowView {
  const k = row.kpis;
  const revenue = k?.revenueAvailable ? k : null;
  return {
    row,
    collected: revenue ? revenue.todayRevenue : null,
    uncollected: revenue ? revenue.diningUncollectedAmount : null,
    todayTables: revenue ? revenue.todayTableCount : null,
    todayGuests: revenue ? totalGuestsFromCounts(revenue.todayGuests) : null,
    diningTables: k ? k.diningTableCount : null,
    diningGuests: k ? totalGuestsFromCounts(k.diningGuests) : null,
  };
}

/** Distinct cities in display order (`''` = unknown city, last). */
export function overviewCities(rows: readonly MultiStoreOverviewRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.city))).sort((a, b) => {
    if (!a !== !b) return a ? -1 : 1;
    return a.localeCompare(b, 'pt');
  });
}

export function rowInScope(row: MultiStoreOverviewRow, scope: OverviewScope): boolean {
  if (scope.kind === 'city') return scope.cities.includes(row.city);
  if (scope.kind === 'pick') return scope.ids.includes(row.restaurantId);
  return true;
}

export function rowMatchesSearch(row: MultiStoreOverviewRow, query: string): boolean {
  return storeMatchesSearch({ name: row.name, city: row.city, slug: row.slug }, query);
}

function sortValue(view: OverviewRowView, key: Exclude<OverviewSortKey, 'name'>): [number | null, number] {
  switch (key) {
    case 'collected':
      return [view.collected, 0];
    case 'uncollected':
      return [view.uncollected, 0];
    case 'today':
      return [view.todayTables, view.todayGuests ?? 0];
    case 'dining':
      return [view.diningTables, view.diningGuests ?? 0];
  }
}

/**
 * Column sort. Suspended stores and 「—」 cells stay at the bottom in both directions;
 * ties fall back to store name.
 */
export function sortOverviewRows(views: readonly OverviewRowView[], sort: OverviewSort): OverviewRowView[] {
  const byName = (a: OverviewRowView, b: OverviewRowView) => a.row.name.localeCompare(b.row.name, 'pt');
  return [...views].sort((a, b) => {
    if (a.row.suspended !== b.row.suspended) return a.row.suspended ? 1 : -1;
    if (sort.key === 'name') return sort.dir * byName(a, b);
    const [a1, a2] = sortValue(a, sort.key);
    const [b1, b2] = sortValue(b, sort.key);
    if ((a1 == null) !== (b1 == null)) return a1 == null ? 1 : -1;
    if (a1 != null && b1 != null && a1 !== b1) return sort.dir * (a1 - b1);
    if (a2 !== b2) return sort.dir * (a2 - b2);
    return byName(a, b);
  });
}

export type OverviewTotals = {
  /** Non-suspended stores in the filter result. */
  storeCount: number;
  /** Null when no counted store has readable revenue. */
  collected: number | null;
  uncollected: number | null;
  todayTables: number | null;
  todayGuests: number | null;
  diningTables: number;
  diningGuests: number;
  /** Counted stores whose revenue was unreadable (left out of the revenue sums). */
  revenueMissing: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Footer totals over the filter result only; suspended stores never counted. */
export function overviewTotals(views: readonly OverviewRowView[]): OverviewTotals {
  const counted = views.filter((v) => !v.row.suspended);
  const withRevenue = counted.filter((v) => v.collected != null);
  const sum = (pick: (v: OverviewRowView) => number | null, from: readonly OverviewRowView[]) =>
    from.reduce((acc, v) => acc + (pick(v) ?? 0), 0);
  const hasRevenue = withRevenue.length > 0;
  return {
    storeCount: counted.length,
    collected: hasRevenue ? round2(sum((v) => v.collected, withRevenue)) : null,
    uncollected: hasRevenue ? round2(sum((v) => v.uncollected, withRevenue)) : null,
    todayTables: hasRevenue ? sum((v) => v.todayTables, withRevenue) : null,
    todayGuests: hasRevenue ? sum((v) => v.todayGuests, withRevenue) : null,
    diningTables: sum((v) => v.diningTables, counted),
    diningGuests: sum((v) => v.diningGuests, counted),
    revenueMissing: counted.length - withRevenue.length,
  };
}
