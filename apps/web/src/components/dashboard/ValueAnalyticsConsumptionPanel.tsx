'use client';

import { ValueAnalyticsTopTable } from '@/components/dashboard/ValueAnalyticsTopTable';
import type { MenuItemConsumptionRankRow } from '@/lib/analytics/analytics.types';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { Language } from '@/types';

type I18n = {
  topTitle: string;
  rankingTitle: string;
  rankingEmpty: string;
  colRank: string;
  colCode: string;
  colDish: string;
  colQty: string;
  colAmount: string;
};

type Props = {
  topItems: MenuItemConsumptionRankRow[];
  items: MenuItemConsumptionRankRow[];
  lang: Language;
  i18n: I18n;
};

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

/** Top-N qty summary + full ranked page body (same sort; one ranking representation). */
export function ValueAnalyticsConsumptionPanel({ topItems, items, lang, i18n }: Props) {
  const topRows = toTableRows(topItems, lang);
  const listRows = toTableRows(items, lang);
  const maxQty = Math.max(
    topRows[0]?.qty ?? 0,
    ...listRows.map((row) => row.qty),
    1,
  );

  return (
    <div className="space-y-4">
      <ValueAnalyticsTopTable
        title={i18n.topTitle}
        rows={topRows}
        dense
        columns={[
          { key: 'rank', header: i18n.colRank },
          { key: 'name', header: i18n.colDish },
          {
            key: 'qty',
            header: i18n.colQty,
            render: (row) => quantityBarCell(row.qty, maxQty),
          },
        ]}
      />

      <ValueAnalyticsTopTable
        title={i18n.rankingTitle}
        rows={listRows}
        columns={[
          { key: 'rank', header: i18n.colRank },
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
    </div>
  );
}
