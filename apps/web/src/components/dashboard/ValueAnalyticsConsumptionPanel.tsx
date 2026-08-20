'use client';

import { ValueAnalyticsTopTable } from '@/components/dashboard/ValueAnalyticsTopTable';
import type { MenuItemConsumptionRankRow } from '@/lib/analytics/analytics.types';
import {
  listConsumptionPeriods,
  type MenuItemConsumptionGrain,
  type MenuItemConsumptionSort,
} from '@/lib/analytics/menu-item-consumption-period';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { Language } from '@/types';

type I18n = {
  rankingTitle: string;
  rankingEmpty: string;
  colRank: string;
  colCode: string;
  colDish: string;
  colQty: string;
  colAmount: string;
  grainMonth: string;
  grainQuarter: string;
  grainYear: string;
  quarterOption: string;
};

type Props = {
  items: MenuItemConsumptionRankRow[];
  lang: Language;
  i18n: I18n;
  grain: MenuItemConsumptionGrain;
  period: string;
  sort: MenuItemConsumptionSort;
  earliestBusinessDate: string | null;
  today: string;
  onGrainChange: (grain: MenuItemConsumptionGrain) => void;
  onPeriodChange: (period: string) => void;
  onToggleSort: () => void;
};

const SELECT_CLASS =
  'text-[13px] px-2 py-1 rounded-md border border-brand-border bg-brand-card text-brand-text';

const PRESET_BTN =
  'text-[13px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap';

function grainBtnClass(active: boolean) {
  return `${PRESET_BTN} ${
    active
      ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
      : 'border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
  }`;
}

function formatMoney(value: number): string {
  return `€${value.toFixed(2)}`;
}

function dishLabel(row: MenuItemConsumptionRankRow, lang: Language): string {
  return resolveMenuItemLocalizedName(
    {
      name_pt: row.namePt,
      name_en: row.nameEn,
      name_zh: row.nameZh,
    },
    lang,
  );
}

function quantityBarCell(qty: number, maxQty: number) {
  const barWidth = maxQty > 0 ? Math.max((qty / maxQty) * 100, 6) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-brand-border/60 overflow-hidden" role="presentation">
        <div className="h-full rounded-full bg-brand-gold/55" style={{ width: `${barWidth}%` }} />
      </div>
      <span className="tabular-nums text-brand-text shrink-0 w-10 text-right">{qty}</span>
    </div>
  );
}

type RankTableRow = {
  rank: number;
  code: string;
  name: string;
  qty: number;
  amount: number;
};

function toTableRows(
  rows: MenuItemConsumptionRankRow[],
  lang: Language,
): RankTableRow[] {
  return rows.map((row) => ({
    rank: row.rank,
    code: row.itemCode?.trim() || '—',
    name: dishLabel(row, lang),
    qty: row.consumedQuantity,
    amount: row.amount,
  }));
}

/** Sole value-analytics dish ranking: month/quarter/year period + paginated list (no Top-N twin). */
export function ValueAnalyticsConsumptionPanel({
  items,
  lang,
  i18n,
  grain,
  period,
  sort,
  earliestBusinessDate,
  today,
  onGrainChange,
  onPeriodChange,
  onToggleSort,
}: Props) {
  const listRows = toTableRows(items, lang);
  const maxQty = Math.max(...listRows.map((row) => row.qty), 1);
  const periods = listConsumptionPeriods(grain, earliestBusinessDate, today);
  const monthMin = periods[0] ?? period;
  const monthMax = periods[periods.length - 1] ?? period;

  const periodControl =
    grain === 'month' ? (
      <input
        type="month"
        className={SELECT_CLASS}
        value={period}
        min={monthMin}
        max={monthMax}
        onChange={(e) => {
          if (e.target.value) onPeriodChange(e.target.value);
        }}
        aria-label={i18n.grainMonth}
      />
    ) : grain === 'quarter' ? (
      <select
        className={SELECT_CLASS}
        value={period}
        onChange={(e) => onPeriodChange(e.target.value)}
        aria-label={i18n.grainQuarter}
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {i18n.quarterOption
              .replace('{year}', p.slice(0, 4))
              .replace('{n}', p.slice(6, 7))}
          </option>
        ))}
      </select>
    ) : (
      <select
        className={SELECT_CLASS}
        value={period}
        onChange={(e) => onPeriodChange(e.target.value)}
        aria-label={i18n.grainYear}
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    );

  return (
    <ValueAnalyticsTopTable
      title={i18n.rankingTitle}
      rows={listRows}
      headerExtra={
        <>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ['month', i18n.grainMonth],
                ['quarter', i18n.grainQuarter],
                ['year', i18n.grainYear],
              ] as const
            ).map(([g, label]) => (
              <button
                key={g}
                type="button"
                className={grainBtnClass(grain === g)}
                onClick={() => onGrainChange(g)}
              >
                {label}
              </button>
            ))}
          </div>
          {periodControl}
        </>
      }
      columns={[
        {
          key: 'rank',
          header: i18n.colRank,
          headerSuffix: sort === 'desc' ? '↓' : '↑',
          onHeaderClick: onToggleSort,
        },
        { key: 'code', header: i18n.colCode },
        { key: 'name', header: i18n.colDish },
        {
          key: 'qty',
          header: i18n.colQty,
          render: (row) => quantityBarCell(row.qty, maxQty),
        },
        {
          key: 'amount',
          header: i18n.colAmount,
          align: 'right',
          render: (row) => (
            <span className="tabular-nums">{formatMoney(row.amount)}</span>
          ),
        },
      ]}
      footer={
        listRows.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{i18n.rankingEmpty}</p>
        ) : null
      }
    />
  );
}
