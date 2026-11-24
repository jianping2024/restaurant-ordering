'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { MultiStoreScopeMenu } from '@/components/multi-store-overview/MultiStoreScopeMenu';
import {
  OVERVIEW_DEFAULT_SORT,
  OVERVIEW_PAGE_SIZE,
  overviewRowView,
  overviewTotals,
  rowInScope,
  rowMatchesSearch,
  sortOverviewRows,
  type OverviewScope,
  type OverviewSort,
  type OverviewSortKey,
} from '@/components/multi-store-overview/multi-store-overview-table';
import { StoreLessHeader } from '@/components/store-picker/StoreLessHeader';
import { StoreSwitcher } from '@/components/store-picker/StoreSwitcher';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { DASHBOARD_METRIC_TYPE } from '@/lib/dashboard-metric-type';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { formatOverviewDate } from '@/lib/format-dashboard-date';
import { MULTI_STORE_OVERVIEW_MESSAGES } from '@/lib/i18n/multi-store-overview-messages';
import { STORE_PICKER_MESSAGES } from '@/lib/i18n/store-picker-messages';
import type { MultiStoreOverview } from '@/lib/multi-store-overview-types';
import { paginateList, type ListPageSize } from '@/lib/paginate-list';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';

const DASH = '—';
const eur = (n: number | null) => (n == null ? DASH : `€${n.toFixed(2)}`);
const pair = (a: number | null, b: number | null) => (a == null ? DASH : `${a} / ${b ?? 0}`);

const TH = 'border-b border-brand-border bg-brand-card px-3 py-0 text-left font-normal';
const TD = 'border-b border-brand-border/60 px-3 py-2.5 tabular-nums';
const TF = 'border-t border-brand-border bg-brand-card px-3 py-3 font-medium tabular-nums';
const NUM = 'text-right';

/**
 * Multi-store overview body (plan §8.4): scope dropdown + name search → sortable table with
 * sticky header and sticky totals (filter result only, suspended excluded) → pagination above
 * {@link OVERVIEW_PAGE_SIZE}. Loaded once; «刷新» re-reads the API — no polling.
 */
export function MultiStoreOverviewScreen({
  initial,
  stores,
  userId,
}: {
  initial: MultiStoreOverview;
  stores: AuthorizedRestaurant[];
  userId: string;
}) {
  const { lang } = useLanguage();
  const t = MULTI_STORE_OVERVIEW_MESSAGES[lang];
  const unknownCity = STORE_PICKER_MESSAGES[lang].unknownCity;

  const [overview, setOverview] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [scope, setScope] = useState<OverviewScope>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OverviewSort>(OVERVIEW_DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ListPageSize>(OVERVIEW_PAGE_SIZE);

  const shown = useMemo(
    () =>
      sortOverviewRows(
        overview.rows.filter((r) => rowInScope(r, scope) && rowMatchesSearch(r, query)).map(overviewRowView),
        sort,
      ),
    [overview.rows, scope, query, sort],
  );
  const totals = useMemo(() => overviewTotals(shown), [shown]);
  const paged = paginateList(shown, page, pageSize);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      const res = await fetch('/api/multi-store/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setOverview((await res.json()) as MultiStoreOverview);
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  };

  const onSort = (key: OverviewSortKey) => {
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }));
    setPage(1);
  };

  const cols: { key: OverviewSortKey; label: string; num: boolean }[] = [
    { key: 'name', label: t.colStore, num: false },
    { key: 'collected', label: t.colCollected, num: true },
    { key: 'uncollected', label: t.colUncollected, num: true },
    { key: 'today', label: t.colToday, num: true },
    { key: 'dining', label: t.colDining, num: true },
  ];

  const dateLabel = formatOverviewDate(lang, new Date(`${overview.todayDateKey}T12:00:00Z`));
  const updated = new Date(overview.generatedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const permittedCount = overview.rows.filter((r) => r.kpis != null).length;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <StoreLessHeader widthClass="max-w-6xl">
        <StoreSwitcher restaurantName={t.title} currentRestaurantId={null} stores={stores} userId={userId} />
      </StoreLessHeader>
      <main className="mx-auto flex min-w-0 max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-medium">{t.title}</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              {t.subtitle.replace('{date}', dateLabel).replace('{count}', String(permittedCount))}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-text-muted" role="status">
              {refreshFailed ? (
                <span className="text-status-danger">{t.refreshFailed}</span>
              ) : (
                t.updatedAt.replace('{time}', updated)
              )}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card px-4 text-sm font-medium hover:border-brand-ink/30 disabled:opacity-60"
            >
              <span aria-hidden>⟳</span>
              {refreshing ? t.refreshing : t.refresh}
            </button>
          </div>
        </div>

        {overview.rows.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-brand-card px-4 py-8 text-center text-sm text-brand-text-muted">
            {t.noStores}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <MultiStoreScopeMenu
                rows={overview.rows}
                scope={scope}
                onChange={(next) => {
                  setScope(next);
                  setPage(1);
                }}
                t={t}
                unknownCity={unknownCity}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="min-h-11 w-full rounded-lg border border-brand-border bg-brand-card px-3 text-sm sm:w-64"
              />
              <span className="text-sm text-brand-text-muted">
                {t.shownCount.replace('{count}', String(shown.length))}
              </span>
            </div>

            <div className="max-h-[calc(100dvh-15rem)] min-h-[14rem] overflow-auto overscroll-contain rounded-2xl border border-brand-border bg-brand-card">
              <table className="w-full min-w-[42rem] border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {cols.map((c) => {
                      const active = sort.key === c.key;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                          className={`${TH} ${c.num ? NUM : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => onSort(c.key)}
                            className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap ${
                              active ? 'font-medium text-brand-text' : 'text-brand-text-muted hover:text-brand-text'
                            }`}
                          >
                            {c.label}
                            {active ? <span aria-hidden>{sort.dir === 1 ? '↑' : '↓'}</span> : null}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((v) => (
                    <tr key={v.row.restaurantId}>
                      <td className={TD}>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {v.row.suspended ? (
                            <span className="text-brand-text-muted">{v.row.name}</span>
                          ) : (
                            <a href={dashboardStoreHref(v.row.slug)} className="font-medium hover:text-brand-gold hover:underline">
                              {v.row.name}
                            </a>
                          )}
                          {v.row.suspended ? (
                            <span className="rounded-full border border-status-danger/40 px-2 py-0.5 text-xs text-status-danger">
                              {t.suspended}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-brand-text-muted">{v.row.city || unknownCity}</span>
                      </td>
                      <td className={`${TD} ${NUM} ${DASHBOARD_METRIC_TYPE.money} text-brand-gold`}>{eur(v.collected)}</td>
                      <td className={`${TD} ${NUM} ${DASHBOARD_METRIC_TYPE.money} text-brand-gold/60`}>{eur(v.uncollected)}</td>
                      <td className={`${TD} ${NUM}`}>{pair(v.todayTables, v.todayGuests)}</td>
                      <td className={`${TD} ${NUM}`}>{pair(v.diningTables, v.diningGuests)}</td>
                    </tr>
                  ))}
                  {paged.rows.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="px-3 py-10 text-center text-brand-text-muted">
                        {t.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr>
                    <td className={TF}>
                      {t.totalRow.replace('{count}', String(totals.storeCount))}
                      {totals.revenueMissing > 0 ? (
                        <span className="block text-xs font-normal text-brand-text-muted">
                          {t.totalRevenueMissing.replace('{count}', String(totals.revenueMissing))}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${TF} ${NUM} ${DASHBOARD_METRIC_TYPE.money} text-brand-gold`}>{eur(totals.collected)}</td>
                    <td className={`${TF} ${NUM} ${DASHBOARD_METRIC_TYPE.money} text-brand-gold/60`}>
                      {eur(totals.uncollected)}
                    </td>
                    <td className={`${TF} ${NUM}`}>{pair(totals.todayTables, totals.todayGuests)}</td>
                    <td className={`${TF} ${NUM}`}>{pair(totals.diningTables, totals.diningGuests)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {shown.length > OVERVIEW_PAGE_SIZE ? (
              <ListPaginationBar
                page={paged.page}
                totalPages={paged.totalPages}
                total={paged.total}
                pageSize={pageSize}
                labels={t.pagination}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            ) : null}
          </>
        )}
        <p className="text-xs text-brand-text-muted">{t.footnote}</p>
      </main>
    </div>
  );
}
