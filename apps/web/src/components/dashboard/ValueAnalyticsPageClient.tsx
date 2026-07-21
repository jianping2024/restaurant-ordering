'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AnalyticsRange,
  StockReferenceItem,
  TopConsumedItem,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ValueAnalyticsTopTable } from '@/components/dashboard/ValueAnalyticsTopTable';
import { buildTrendChartPoints } from '@/components/dashboard/ValueAnalyticsTrendChart';
import { getMessages } from '@/lib/i18n/messages';
import type { UILanguage } from '@/lib/i18n';

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

function localizedName(
  row: { namePt: string; nameEn?: string | null; nameZh?: string | null },
  lang: UILanguage,
): string {
  if (lang === 'zh' && row.nameZh) return row.nameZh;
  if (lang === 'en' && row.nameEn) return row.nameEn;
  return row.namePt;
}

function localizedCategory(
  row: { categoryPt: string; categoryEn?: string | null; categoryZh?: string | null },
  lang: UILanguage,
): string {
  if (lang === 'zh' && row.categoryZh) return row.categoryZh;
  if (lang === 'en' && row.categoryEn) return row.categoryEn;
  return row.categoryPt;
}

function isOverviewEmpty(data: ValueOverviewResponse): boolean {
  const trendHasValue =
    data.revenueTrend.some((point) => point.revenue > 0) ||
    data.customerTrend.some((point) => point.customerCount > 0);
  const topsEmpty = data.topConsumedItems.length === 0 && data.stockReferenceItems.length === 0;
  return !trendHasValue && topsEmpty;
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
  hint?: string;
  color?: string;
};

function ValueAnalyticsKpiGrid({ items, dimmed }: { items: KpiItem[]; dimmed?: boolean }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${dimmed ? 'opacity-60' : ''}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-6 shadow-sm"
        >
          <p className="text-brand-text-muted text-[13px] mb-2">{item.label}</p>
          <p className={`font-heading text-xl sm:text-2xl ${item.color ?? 'text-brand-text'}`}>
            {item.value}
          </p>
          {item.hint ? (
            <p className="text-[12px] text-brand-text-muted mt-1.5 truncate">{item.hint}</p>
          ) : null}
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
  const [data, setData] = useState<ValueOverviewResponse | null>(initialOverview);
  const [loadedRange, setLoadedRange] = useState<AnalyticsRange | null>(
    initialOverview && !initialLoadFailed ? '7d' : null,
  );
  const [viewState, setViewState] = useState<ViewState>(() =>
    resolveViewState(initialOverview, initialLoadFailed),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const skipInitialFetch = useRef(initialOverview != null && !initialLoadFailed);

  const fetchRange = useCallback(
    async (targetRange: AnalyticsRange, options?: { bypassCache?: boolean }) => {
      if (skipInitialFetch.current && targetRange === '7d' && !options?.bypassCache) {
        skipInitialFetch.current = false;
        return;
      }
      if (targetRange === loadedRange && data && !options?.bypassCache) {
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
          if (data) {
            setRefreshError(true);
            return;
          }
          setViewState('error');
          return;
        }
        const json = (await res.json()) as ValueOverviewResponse;
        setData(json);
        setLoadedRange(targetRange);
        setViewState(isOverviewEmpty(json) ? 'empty' : 'ready');
      } catch {
        if (data) {
          setRefreshError(true);
          return;
        }
        setViewState('error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [data, loadedRange],
  );

  useEffect(() => {
    void fetchRange(range);
  }, [range, fetchRange]);

  const retry = useCallback(() => {
    setRefreshError(false);
    setLoadedRange(null);
    void fetchRange(range, { bypassCache: true });
  }, [fetchRange, range]);

  const revenuePoints = useMemo(
    () =>
      data ? buildTrendChartPoints(data.revenueTrend, (row) => row.revenue) : [],
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
    const topItem = data.topConsumedItems[0];

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
      {
        label: t.kpiTopConsumed,
        value: topItem ? localizedName(topItem, lang) : t.kpiNoData,
        hint: topItem ? `${topItem.consumedQuantity} ×` : undefined,
        color: 'text-brand-text',
      },
    ];
  }, [data, lang, t]);

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

          <div className="grid xl:grid-cols-2 gap-4">
            <ValueAnalyticsTopTable<TopConsumedItem>
              title={t.topConsumed}
              rows={data.topConsumedItems}
              columns={[
                { key: 'rank', header: t.colRank },
                {
                  key: 'namePt',
                  header: t.colItem,
                  render: (row) => localizedName(row, lang),
                },
                {
                  key: 'categoryPt',
                  header: t.colCategory,
                  render: (row) => localizedCategory(row, lang),
                },
                {
                  key: 'consumedQuantity',
                  header: t.colQuantity,
                  align: 'right',
                },
                {
                  key: 'amount',
                  header: t.colAmount,
                  align: 'right',
                  render: (row) => formatMoney(row.amount),
                },
              ]}
            />

            <ValueAnalyticsTopTable<StockReferenceItem>
              title={t.stockReference}
              rows={data.stockReferenceItems}
              columns={[
                { key: 'rank', header: t.colRank },
                {
                  key: 'namePt',
                  header: t.colItem,
                  render: (row) => localizedName(row, lang),
                },
                {
                  key: 'categoryPt',
                  header: t.colCategory,
                  render: (row) => localizedCategory(row, lang),
                },
                {
                  key: 'consumedQuantity7d',
                  header: t.colQuantity7d,
                  align: 'right',
                },
                {
                  key: 'tag',
                  header: t.colTag,
                  render: () => t.tagStock,
                },
              ]}
              footer={<p className="text-[13px] text-brand-text-muted">{t.stockDisclaimer}</p>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
