'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnalyticsRange, ValueOverviewResponse } from '@/lib/analytics/analytics.types';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { buildTrendChartPoints } from '@/components/dashboard/ValueAnalyticsTrendChart';
import { getMessages } from '@/lib/i18n/messages';

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

function isOverviewEmpty(data: ValueOverviewResponse): boolean {
  return (
    !data.revenueTrend.some((point) => point.revenue > 0) &&
    !data.customerTrend.some((point) => point.customerCount > 0)
  );
}

function resolveViewState(
  overview: ValueOverviewResponse | null,
  loadFailed: boolean,
): ViewState {
  if (loadFailed) return 'error';
  if (!overview) return 'empty';
  return isOverviewEmpty(overview) ? 'empty' : 'ready';
}

function formatMoney(value: number): string {
  return `€${value.toFixed(2)}`;
}

function sliceOverviewForRange(
  overview: ValueOverviewResponse,
  range: AnalyticsRange,
): ValueOverviewResponse {
  const dayCount = range === '7d' ? 7 : 30;
  return {
    ...overview,
    range,
    revenueTrend: overview.revenueTrend.slice(-dayCount),
    customerTrend: overview.customerTrend.slice(-dayCount),
  };
}

function isUsableHistoryCache(overview: ValueOverviewResponse | null): boolean {
  return (
    overview != null &&
    overview.schemaVersion === ANALYTICS_DAILY_SCHEMA_VERSION &&
    overview.revenueTrend.length >= 30
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
          <p className={`font-heading text-xl sm:text-2xl ${item.color ?? 'text-brand-text'}`}>
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

  const [range, setRange] = useState<AnalyticsRange>('7d');
  /** One representation: full 30d sealed+today payload; UI range only slices. */
  const [history30d, setHistory30d] = useState<ValueOverviewResponse | null>(() =>
    isUsableHistoryCache(initialOverview) && !initialLoadFailed ? initialOverview : null,
  );
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (initialLoadFailed) return 'error';
    if (!initialOverview) return 'empty';
    const sliced = sliceOverviewForRange(initialOverview, '7d');
    return resolveViewState(sliced, false);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const skipInitialFetch = useRef(isUsableHistoryCache(initialOverview) && !initialLoadFailed);
  const historyRef = useRef(history30d);
  historyRef.current = history30d;

  const data = useMemo(() => {
    if (!history30d) return null;
    return sliceOverviewForRange(history30d, range);
  }, [history30d, range]);

  const fetchHistory30d = useCallback(async (options?: { bypassCache?: boolean }) => {
    if (skipInitialFetch.current && !options?.bypassCache) {
      skipInitialFetch.current = false;
      return;
    }
    if (!options?.bypassCache && isUsableHistoryCache(historyRef.current)) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError(false);
    try {
      const refreshQs = options?.bypassCache ? '&refresh=1' : '';
      const res = await fetch(`/api/analytics/value-overview?range=30d${refreshQs}`);
      if (res.status === 403) {
        setViewState('forbidden');
        return;
      }
      if (!res.ok) {
        if (historyRef.current) {
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
      setHistory30d(json);
    } catch {
      if (historyRef.current) {
        setRefreshError(true);
        return;
      }
      setViewState('error');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory30d();
  }, [fetchHistory30d]);

  useEffect(() => {
    if (!history30d) return;
    setViewState((prev) => {
      if (prev === 'forbidden') return prev;
      return resolveViewState(sliceOverviewForRange(history30d, range), false);
    });
  }, [history30d, range]);

  const retry = useCallback(() => {
    setRefreshError(false);
    setHistory30d(null);
    void fetchHistory30d({ bypassCache: true });
  }, [fetchHistory30d]);

  const revenuePoints = useMemo(
    () => (data ? buildTrendChartPoints(data.revenueTrend, (row) => row.revenue) : []),
    [data],
  );

  const customerPoints = useMemo(
    () =>
      data
        ? buildTrendChartPoints(
            data.customerTrend,
            (row) => row.customerCount,
            (row) => ({ adultCount: row.adultCount, childCount: row.childCount }),
          )
        : [],
    [data],
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
      },
      {
        label: t.kpiTotalGuests,
        value: String(totalGuests),
        color: 'text-brand-text',
      },
      {
        label: t.kpiAvgDailyRevenue,
        value: formatMoney(avgDaily),
        color: 'text-brand-text',
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

  if (viewState === 'forbidden') {
    return (
      <div className="max-w-6xl">
        <StateCard>
          <p className="text-brand-text-muted">{t.forbidden}</p>
        </StateCard>
      </div>
    );
  }

  const showContent = viewState === 'ready' && data;

  return (
    <div className="max-w-6xl">
      <header className="mb-5">
        <p className="text-sm text-brand-text-muted">{t.subtitle}</p>
      </header>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden mb-5 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-brand-text">{t.filterTitle}</h2>
            {isRefreshing ? (
              <span className="text-[12px] text-brand-text-muted">{t.refreshing}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className={presetBtnClass(range === '7d', isRefreshing)}
              onClick={() => setRange('7d')}
              disabled={isRefreshing}
            >
              {t.range7d}
            </button>
            <button
              type="button"
              className={presetBtnClass(range === '30d', isRefreshing)}
              onClick={() => setRange('30d')}
              disabled={isRefreshing}
            >
              {t.range30d}
            </button>
          </div>
        </div>
        {refreshError ? (
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
        </div>
      ) : null}
    </div>
  );
}
