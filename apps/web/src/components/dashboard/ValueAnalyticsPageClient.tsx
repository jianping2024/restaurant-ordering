'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type PageState = 'loading' | 'success' | 'empty' | 'error' | 'forbidden';

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

const RANGE_BTN =
  'text-[13px] px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap';

export function ValueAnalyticsPageClient() {
  const { lang } = useLanguage();
  const t = getMessages(lang).valueAnalytics;

  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<ValueOverviewResponse | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`/api/analytics/value-overview?range=${range}`);
      if (res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        setState('error');
        return;
      }
      const json = (await res.json()) as ValueOverviewResponse;
      setData(json);
      setState(isOverviewEmpty(json) ? 'empty' : 'success');
    } catch {
      setState('error');
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const formatMoney = (value: number) => `€${value.toFixed(2)}`;

  if (state === 'forbidden') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-brand-text-muted">
        {t.forbidden}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-heading text-brand-text">{t.title}</h1>
        <p className="text-[15px] text-brand-text-muted">{t.subtitle}</p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          className={`${RANGE_BTN} ${
            range === '7d'
              ? 'border-brand-gold text-brand-gold bg-brand-gold/10'
              : 'border-brand-border text-brand-text-muted hover:text-brand-text'
          }`}
          onClick={() => setRange('7d')}
        >
          {t.range7d}
        </button>
        <button
          type="button"
          className={`${RANGE_BTN} ${
            range === '30d'
              ? 'border-brand-gold text-brand-gold bg-brand-gold/10'
              : 'border-brand-border text-brand-text-muted hover:text-brand-text'
          }`}
          onClick={() => setRange('30d')}
        >
          {t.range30d}
        </button>
      </div>

      {state === 'loading' ? (
        <p className="text-brand-text-muted py-12 text-center">{t.loading}</p>
      ) : null}

      {state === 'error' ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-brand-text-muted">{t.error}</p>
          <Button type="button" onClick={() => void load()}>
            {t.retry}
          </Button>
        </div>
      ) : null}

      {state === 'empty' ? (
        <p className="text-brand-text-muted py-12 text-center">{t.empty}</p>
      ) : null}

      {state === 'success' && data ? (
        <div className="space-y-6">
          <ValueAnalyticsTrendChart
            title={t.revenueTrend}
            data={revenuePoints}
            yAxisLabel={t.revenueAxis}
            valueFormatter={formatMoney}
            variant="revenue"
            tooltipLabels={{
              total: t.tooltipTotal,
              adults: t.tooltipAdults,
              children: t.tooltipChildren,
            }}
          />

          <ValueAnalyticsTrendChart
            title={t.customerTrend}
            data={customerPoints}
            yAxisLabel={t.customerAxis}
            valueFormatter={(value) => String(value)}
            variant="customer"
            tooltipLabels={{
              total: t.tooltipTotal,
              adults: t.tooltipAdults,
              children: t.tooltipChildren,
            }}
          />

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
      ) : null}
    </div>
  );
}
