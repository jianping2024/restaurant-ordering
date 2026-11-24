import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DashboardTodayKpis } from '@/lib/dashboard-overview';
import type { MultiStoreOverviewRow } from '@/lib/multi-store-overview-types';
import {
  OVERVIEW_DEFAULT_SORT,
  overviewCities,
  overviewRowView,
  overviewTotals,
  rowInScope,
  rowMatchesSearch,
  sortOverviewRows,
} from '@/components/multi-store-overview/multi-store-overview-table';

function kpis(over: Partial<DashboardTodayKpis> = {}): DashboardTodayKpis {
  return {
    todayTableCount: 2,
    todayRevenue: 100,
    revenueAvailable: true,
    todayGuests: { adults: 4, children: 1 },
    diningTableCount: 1,
    diningGuests: { adults: 2, children: 0 },
    diningUncollectedAmount: 30,
    revenueByChannel: null,
    ...over,
  };
}

function row(id: string, name: string, city: string, over: Partial<MultiStoreOverviewRow> = {}): MultiStoreOverviewRow {
  return { restaurantId: id, slug: `s-${id}`, name, city, suspended: false, kpis: kpis(), ...over };
}

describe('multi-store overview table', () => {
  it('revenue unreadable → revenue + today cells empty, floor kept; no kpis → all empty', () => {
    const v = overviewRowView(row('a', 'A', 'Lisboa', { kpis: kpis({ revenueAvailable: false }) }));
    assert.deepEqual(
      [v.collected, v.uncollected, v.todayTables, v.todayGuests, v.diningTables, v.diningGuests],
      [null, null, null, null, 1, 2],
    );
    const n = overviewRowView(row('b', 'B', 'Porto', { suspended: true, kpis: null }));
    assert.equal(n.diningTables, null);
    assert.equal(n.collected, null);
  });

  it('totals: filter result only, suspended and unreadable revenue excluded', () => {
    const views = [
      row('a', 'A', 'Lisboa', { kpis: kpis({ todayRevenue: 10.1 }) }),
      row('b', 'B', 'Lisboa', { kpis: kpis({ todayRevenue: 20.2 }) }),
      row('c', 'C', 'Lisboa', { kpis: kpis({ revenueAvailable: false }) }),
      row('d', 'D', 'Lisboa', { suspended: true, kpis: kpis({ todayRevenue: 999 }) }),
      row('e', 'E', 'Porto', { kpis: kpis({ todayRevenue: 5 }) }),
    ]
      .filter((r) => rowInScope(r, { kind: 'city', cities: ['Lisboa'] }))
      .map(overviewRowView);
    const t = overviewTotals(views);
    assert.equal(t.storeCount, 3);
    assert.equal(t.collected, 30.3);
    assert.equal(t.uncollected, 60);
    assert.equal(t.todayTables, 4);
    assert.equal(t.todayGuests, 10);
    assert.equal(t.diningTables, 3);
    assert.equal(t.diningGuests, 6);
    assert.equal(t.revenueMissing, 1);
  });

  it('default sort: collected desc; empty cells and suspended last both ways', () => {
    const views = [
      row('a', 'A', '', { kpis: kpis({ todayRevenue: 5 }) }),
      row('b', 'B', '', { suspended: true, kpis: null }),
      row('c', 'C', '', { kpis: kpis({ revenueAvailable: false }) }),
      row('d', 'D', '', { kpis: kpis({ todayRevenue: 50 }) }),
    ].map(overviewRowView);
    const ids = (s: typeof OVERVIEW_DEFAULT_SORT) => sortOverviewRows(views, s).map((v) => v.row.restaurantId);
    assert.deepEqual(ids(OVERVIEW_DEFAULT_SORT), ['d', 'a', 'c', 'b']);
    assert.deepEqual(ids({ key: 'collected', dir: 1 }), ['a', 'd', 'c', 'b']);
    assert.deepEqual(ids({ key: 'name', dir: -1 }), ['d', 'c', 'a', 'b']);
  });

  it('cities: unknown last; scope pick + accent-insensitive search', () => {
    const rows = [row('a', 'Évora Sul', 'Évora'), row('b', 'B', ''), row('c', 'C', 'Braga')];
    assert.deepEqual(overviewCities(rows), ['Braga', 'Évora', '']);
    assert.equal(rowInScope(rows[0], { kind: 'pick', ids: ['c'] }), false);
    assert.equal(rowMatchesSearch(rows[0], 'evora'), true);
    assert.equal(rowMatchesSearch(rows[2], 'evora'), false);
  });
});
