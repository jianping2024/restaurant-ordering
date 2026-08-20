'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AnalyticsRange,
  MenuItemConsumptionResponse,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import {
  ANALYTICS_DAILY_SCHEMA_VERSION,
  ANALYTICS_RANGES,
} from '@/lib/analytics/analytics.types';
import { isValueOverviewEmpty } from '@/lib/analytics/period-aggregate';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { ValueAnalyticsConsumptionPanel } from '@/components/dashboard/ValueAnalyticsConsumptionPanel';
import { buildTrendChartPoints } from '@/components/dashboard/ValueAnalyticsTrendChart';
import { getMessages } from '@/lib/i18n/messages';
import { DASHBOARD_METRIC_TYPE } from '@/lib/dashboard-metric-type';
import { type ListPageSize } from '@/lib/paginate-list';
import { useDashboardListQuery } from '@/lib/use-dashboard-list-query';

const ValueAnalyticsTrendChart = dynamic(
  () =>
    import('@/components/dashboard/ValueAnalyticsTrendChart').then(
      (mod) => mod.ValueAnalyticsTrendChart,
    ),
  { ssr: false, loading: () => <div className="h-[240px] animate-pulse rounded-lg bg-brand-border/30" /> },
);

type ViewState = 'ready' | 'empty' | 'error' | 'forbidden';

type Props = {
  initialOverview: ValueOverviewResponse | null;
  initialLoadFailed?: boolean;
};

type ConsumptionFilters = { range: AnalyticsRange };

function resolveViewState(
  overview: ValueOverviewResponse | null,
  loadFailed: boolean,
): ViewState {
  if (loadFailed) return 'error';
  if (!overview) return 'empty';
  return isValueOverviewEmpty(overview) ? 'empty' : 'ready';
}

function formatMoney(value: number): string {
  return `€${value.toFixed(2)}`;
}

function isUsableCache(
  overview: ValueOverviewResponse | null,
  range: AnalyticsRange,
): boolean {
  return (
    overview != null &&
    overview.range === range &&
    overview.schemaVersion === ANALYTICS_DAILY_SCHEMA_VERSION
  );
}

const PRESET_BTN_BASE =
  'text-[13px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap';

function presetBtnClass(active: boolean, disabled: boolean) {
  return `${PRESET_BTN_BASE} ${
    active
      ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
      : 'border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
  } ${disabled ? 'opacity-60 pointer-events-none' : ''}`;
}

function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl px-6 py-14 sm:py-16 text-center shadow-sm">
      {children}
    </div>
  );
}

type KpiItem = {
  label: string;
  value: string;
  color?: string;
  face: keyof typeof DASHBOARD_METRIC_TYPE;
};

function ValueAnalyticsKpiGrid({ items, dimmed }: { items: KpiItem[]; dimmed?: boolean }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${dimmed ? 'opacity-60' : ''}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-6 shadow-sm"
        >
          <p className="text-brand-text-muted text-[13px] mb-2">{item.label}</p>
          <p
            className={`${DASHBOARD_METRIC_TYPE[item.face]} text-xl sm:text-2xl ${item.color ?? 'text-brand-text'}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ValueAnalyticsPageClient({
  initialOverview,
  initialLoadFailed = false,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).valueAnalytics;

  const [range, setRange] = useState<AnalyticsRange>('day');
  /** One representation: successful DTO per grain for this session. */
  const [byRange, setByRange] = useState<Partial<Record<AnalyticsRange, ValueOverviewResponse>>>(
    () =>
      isUsableCache(initialOverview, 'day') && !initialLoadFailed && initialOverview
        ? { day: initialOverview }
        : {},
  );
  const [viewState, setViewState] = useState<ViewState>(() =>
    resolveViewState(
      isUsableCache(initialOverview, 'day') ? initialOverview : null,
      initialLoadFailed,
    ),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [consumptionError, setConsumptionError] = useState(false);
  const skipInitialFetch = useRef(isUsableCache(initialOverview, 'day') && !initialLoadFailed);
  const byRangeRef = useRef(byRange);
  byRangeRef.current = byRange;

  const data = byRange[range] ?? null;

  const fetchConsumption = useCallback(
    async ({
      filters,
      page,
      pageSize,
      signal,
    }: {
      filters: ConsumptionFilters;
      page: number;
      pageSize: ListPageSize;
      signal: AbortSignal;
    }) => {
      const url = new URL('/api/analytics/menu-item-consumption', window.location.origin);
      url.searchParams.set('range', filters.range);
      url.searchParams.set('page', String(page));
      url.searchParams.set('page_size', String(pageSize));
      try {
        const res = await fetch(url.toString(), { credentials: 'include', signal });
        const json = (await res.json().catch(() => ({}))) as MenuItemConsumptionResponse & {
          error?: string;
        };
        if (res.status === 403) {
          return { ok: false as const, error: 'forbidden' };
        }
        if (!res.ok) {
          return { ok: false as const, error: json.error || 'load_failed' };
        }
        if (json.schemaVersion !== ANALYTICS_DAILY_SCHEMA_VERSION) {
          return { ok: false as const, error: 'schema_mismatch' };
        }
        return { ok: true as const, data: json };
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          return { ok: false as const, error: 'aborted' };
        }
        return { ok: false as const, error: 'network_error' };
      }
    },
    [],
  );

  const {
    replaceDraftFilters,
    query: consumptionQuery,
    data: consumption,
    loading: consumptionLoading,
    setPage: setConsumptionPage,
    setPageSize: setConsumptionPageSize,
    refresh: refreshConsumption,
  } = useDashboardListQuery<ConsumptionFilters, MenuItemConsumptionResponse>({
    initialFilters: { range: 'day' },
    debounceMs: 0,
    fetchList: fetchConsumption,
    onFetchError: (error) => {
      if (error === 'forbidden') {
        setViewState('forbidden');
        return;
      }
      setConsumptionError(true);
    },
    onSuccess: () => setConsumptionError(false),
  });

  useEffect(() => {
    replaceDraftFilters({ range });
  }, [range, replaceDraftFilters]);

  const grainLabel = useCallback(
    (grain: AnalyticsRange) => {
      if (grain === 'day') return t.rangeDay;
      if (grain === 'week') return t.rangeWeek;
      if (grain === 'month') return t.rangeMonth;
      if (grain === 'year') return t.rangeYear;
      return t.rangeQuarter;
    },
    [t],
  );

  const fetchRange = useCallback(
    async (targetRange: AnalyticsRange, options?: { bypassCache?: boolean }) => {
      if (skipInitialFetch.current && targetRange === 'day' && !options?.bypassCache) {
        skipInitialFetch.current = false;
        return;
      }
      if (!options?.bypassCache && isUsableCache(byRangeRef.current[targetRange] ?? null, targetRange)) {
        const cached = byRangeRef.current[targetRange]!;
        setViewState(resolveViewState(cached, false));
        return;
      }

      setIsRefreshing(true);
      setRefreshError(false);
      try {
        const refreshQs = options?.bypassCache ? '&refresh=1' : '';
        const res = await fetch(
          `/api/analytics/value-overview?range=${targetRange}${refreshQs}`,
        );
        if (res.status === 403) {
          setViewState('forbidden');
          return;
        }
        if (!res.ok) {
          if (byRangeRef.current[targetRange] || Object.keys(byRangeRef.current).length > 0) {
            setRefreshError(true);
            return;
          }
          setViewState('error');
          return;
        }
        const json = (await res.json()) as ValueOverviewResponse;
        if (json.schemaVersion !== ANALYTICS_DAILY_SCHEMA_VERSION) {
          setViewState('error');
          return;
        }
        setByRange((prev) => ({ ...prev, [targetRange]: json }));
        setViewState(resolveViewState(json, false));
      } catch {
        if (byRangeRef.current[targetRange] || Object.keys(byRangeRef.current).length > 0) {
          setRefreshError(true);
          return;
        }
        setViewState('error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchRange(range);
  }, [range, fetchRange]);

  const retry = useCallback(() => {
    setRefreshError(false);
    setConsumptionError(false);
    setByRange((prev) => {
      const next = { ...prev };
      delete next[range];
      return next;
    });
    void fetchRange(range, { bypassCache: true });
    refreshConsumption();
  }, [fetchRange, range, refreshConsumption]);

  const revenuePoints = useMemo(
    () =>
      data ? buildTrendChartPoints(data.revenueTrend, range, (row) => row.revenue) : [],
    [data, range],
  );

  const customerPoints = useMemo(
    () =>
      data
        ? buildTrendChartPoints(
            data.customerTrend,
            range,
            (row) => row.customerCount,
            (row) => ({ adultCount: row.adultCount, childCount: row.childCount }),
          )
        : [],
    [data, range],
  );

  const kpiItems = useMemo((): KpiItem[] => {
    if (!data) return [];

    const totalRevenue = data.revenueTrend.reduce((sum, point) => sum + point.revenue, 0);
    const totalGuests = data.customerTrend.reduce((sum, point) => sum + point.customerCount, 0);
    const dayCount = data.revenueTrend.length || 1;
    const avgDaily = totalRevenue / dayCount;

    return [
      {
        label: t.kpiTotalRevenue,
        value: formatMoney(totalRevenue),
        color: 'text-brand-gold',
        face: 'money',
      },
      {
        label: t.kpiTotalGuests,
        value: String(totalGuests),
        color: 'text-brand-text',
        face: 'figure',
      },
      {
        label: t.kpiAvgDailyRevenue,
        value: formatMoney(avgDaily),
        color: 'text-brand-text',
        face: 'money',
      },
    ];
  }, [data, t]);

  const tooltipLabels = useMemo(
    () => ({
      total: t.tooltipTotal,
      adults: t.tooltipAdults,
      children: t.tooltipChildren,
    }),
    [t],
  );

  const consumptionI18n = useMemo(
    () => ({
      topTitle: t.consumptionTopTitle,
      rankingTitle: t.consumptionRankingTitle,
      rankingEmpty: t.consumptionRankingEmpty,
      colRank: t.colRank,
      colCode: t.colCode,
      colDish: t.colDish,
      colQty: t.colQty,
      colAmount: t.colAmount,
    }),
    [t],
  );

  const consumptionTotalPages = Math.max(
    1,
    Math.ceil((consumption?.total ?? 0) / consumptionQuery.pageSize),
  );

  if (viewState === 'forbidden') {
    return (
      <StateCard>
        <p className="text-brand-text-muted">{t.forbidden}</p>
      </StateCard>
    );
  }

  const showContent = viewState === 'ready' && data;

  return (
    <div>
      <header className="mb-5">
        <p className="text-sm text-brand-text-muted">{t.subtitle}</p>
      </header>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden mb-5 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-brand-text">{t.filterTitle}</h2>
            {isRefreshing || consumptionLoading ? (
              <span className="text-[12px] text-brand-text-muted">{t.refreshing}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {ANALYTICS_RANGES.map((grain) => (
              <button
                key={grain}
                type="button"
                className={presetBtnClass(range === grain, isRefreshing)}
                onClick={() => setRange(grain)}
                disabled={isRefreshing}
              >
                {grainLabel(grain)}
              </button>
            ))}
          </div>
        </div>
        {refreshError || consumptionError ? (
          <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border/60">
            <p className="text-[13px] text-brand-text-muted">{t.error}</p>
            <Button type="button" size="sm" onClick={() => retry()}>
              {t.retry}
            </Button>
          </div>
        ) : null}
      </div>

      {viewState === 'error' ? (
        <StateCard>
          <p className="text-brand-text-muted mb-4">{t.error}</p>
          <Button type="button" onClick={() => retry()}>
            {t.retry}
          </Button>
        </StateCard>
      ) : null}

      {viewState === 'empty' ? (
        <StateCard>
          <p className="text-brand-text-muted">{t.empty}</p>
        </StateCard>
      ) : null}

      {showContent ? (
        <div className={`space-y-5 ${isRefreshing ? 'opacity-80' : ''}`}>
          <ValueAnalyticsKpiGrid items={kpiItems} dimmed={isRefreshing} />

          <div className="grid lg:grid-cols-2 gap-4">
            <ValueAnalyticsTrendChart
              title={t.revenueTrend}
              data={revenuePoints}
              yAxisLabel={t.revenueAxis}
              valueFormatter={formatMoney}
              variant="revenue"
              tooltipLabels={tooltipLabels}
            />

            <ValueAnalyticsTrendChart
              title={t.customerTrend}
              data={customerPoints}
              yAxisLabel={t.customerAxis}
              valueFormatter={(value) => String(value)}
              variant="customer"
              tooltipLabels={tooltipLabels}
            />
          </div>

          {consumption ? (
            <div className={consumptionLoading ? 'opacity-80' : ''}>
              <ValueAnalyticsConsumptionPanel
                topItems={consumption.topItems}
                items={consumption.items}
                lang={lang}
                i18n={consumptionI18n}
              />
              <div className="mt-3">
                <ListPaginationBar
                  page={consumptionQuery.page}
                  totalPages={consumptionTotalPages}
                  total={consumption.total}
                  pageSize={consumptionQuery.pageSize}
                  onPageChange={setConsumptionPage}
                  onPageSizeChange={setConsumptionPageSize}
                  labels={{
                    pageInfo: t.pageInfo,
                    pageSizeLabel: t.pageSizeLabel,
                    pagePrev: t.prevPage,
                    pageNext: t.nextPage,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
