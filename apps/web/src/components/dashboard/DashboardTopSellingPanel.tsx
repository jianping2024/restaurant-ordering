import {
  buildTopSellingRows,
  summarizeTopSellingItems,
  type DashboardTopItem,
} from '@/lib/dashboard-overview';

type TopSellingI18n = {
  topSellingTitle: string;
  topSellingEmpty: string;
  topSellingListedSummary: string;
  hotBadge: string;
  stockHint: string;
  serving: string;
  colDish: string;
  colQty: string;
  colRevenue: string;
  shareOfList: string;
};

interface Props {
  items: DashboardTopItem[];
  i18n: TopSellingI18n;
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) {
    return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/18 text-sm font-semibold text-brand-gold ring-1 ring-brand-gold/35';
  }
  if (rank <= 3) {
    return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-border/50 text-sm font-medium text-brand-text';
  }
  return 'flex h-7 w-7 shrink-0 items-center justify-center text-sm tabular-nums text-brand-text-muted';
}

function hintBadgeClass(hint: 'hot' | 'stock'): string {
  return hint === 'hot'
    ? 'mesa-badge-success text-[11px] px-2 py-0.5 rounded-full shrink-0'
    : 'mesa-badge-warning text-[11px] px-2 py-0.5 rounded-full shrink-0';
}

export function DashboardTopSellingPanel({ items, i18n }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-full">
        <h2 className="font-heading text-xl text-brand-gold">{i18n.topSellingTitle}</h2>
        <p className="text-brand-text-muted text-sm mt-4">{i18n.topSellingEmpty}</p>
      </div>
    );
  }

  const summary = summarizeTopSellingItems(items);
  const rows = buildTopSellingRows(items);
  const listedSummary = i18n.topSellingListedSummary
    .replace('{units}', String(summary.totalUnits))
    .replace('{revenue}', summary.totalRevenue.toFixed(2));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-full flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 mb-4">
        <h2 className="font-heading text-xl text-brand-gold">{i18n.topSellingTitle}</h2>
        <p className="text-[13px] text-brand-text-muted tabular-nums">{listedSummary}</p>
      </div>

      <div
        className="hidden sm:grid sm:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_4.5rem] gap-x-3 px-3 pb-2 text-[11px] text-brand-text-muted border-b border-brand-border/80"
        aria-hidden
      >
        <span />
        <span>{i18n.colDish}</span>
        <span className="text-right">{i18n.colQty}</span>
        <span className="text-right">{i18n.colRevenue}</span>
      </div>

      <ul className="flex-1 space-y-2 mt-1">
        {rows.map((row) => {
          const sharePct = Math.round(row.volumeShare * 100);
          const hintLabel =
            row.actionHint === 'hot' ? i18n.hotBadge : row.actionHint === 'stock' ? i18n.stockHint : null;
          const isLeader = row.rank === 1;

          return (
            <li
              key={`${row.name}-${row.rank}`}
              className={`rounded-xl border px-3 py-2.5 ${
                isLeader
                  ? 'border-brand-gold/35 bg-brand-gold/[0.06]'
                  : 'border-brand-border/80 bg-brand-bg/30'
              }`}
            >
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_4.5rem] gap-x-3 gap-y-1 items-center">
                <span className={rankBadgeClass(row.rank)} aria-hidden>
                  {row.rank}
                </span>

                <div className="min-w-0 col-span-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`truncate ${isLeader ? 'text-sm font-medium text-brand-text' : 'text-sm text-brand-text'}`}>
                      {row.name}
                    </p>
                    {hintLabel && row.actionHint ? (
                      <span className={hintBadgeClass(row.actionHint)}>{hintLabel}</span>
                    ) : null}
                  </div>
                  <p className="sm:hidden text-[12px] text-brand-text-muted tabular-nums mt-0.5">
                    {row.count} {i18n.serving} · €{row.revenue.toFixed(2)}
                  </p>
                </div>

                <p className="hidden sm:block text-sm text-brand-text tabular-nums text-right">
                  {row.count}
                  <span className="text-[11px] text-brand-text-muted ml-0.5">{i18n.serving}</span>
                </p>
                <p className="hidden sm:block text-sm text-brand-gold font-medium tabular-nums text-right">
                  €{row.revenue.toFixed(2)}
                </p>
              </div>

              <div className="mt-2 flex items-center gap-2 pl-[calc(2.25rem+0.75rem)] sm:pl-[calc(2.25rem+0.75rem)]">
                <div
                  className="h-1 flex-1 rounded-full bg-brand-border/60 overflow-hidden"
                  role="presentation"
                >
                  <div
                    className={`h-full rounded-full ${isLeader ? 'bg-brand-gold/70' : 'bg-brand-gold/35'}`}
                    style={{ width: `${Math.max(sharePct, 4)}%` }}
                  />
                </div>
                <span className="text-[11px] text-brand-text-muted tabular-nums shrink-0 w-16 text-right">
                  {i18n.shareOfList.replace('{n}', String(sharePct))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
