import { ValueAnalyticsTopTable } from '@/components/dashboard/ValueAnalyticsTopTable';
import {
  buildTopSellingRows,
  summarizeTopSellingItems,
  type DashboardTopItem,
  type DashboardTopSellingRow,
} from '@/lib/dashboard-overview';

type TopSellingI18n = {
  topSellingTitle: string;
  topSellingEmpty: string;
  topSellingListedSummary: string;
  colRank: string;
  colDish: string;
  colQty: string;
  colShare: string;
};

interface Props {
  items: DashboardTopItem[];
  i18n: TopSellingI18n;
}

function quantityBarCell(row: DashboardTopSellingRow, maxCount: number) {
  const barWidth = maxCount > 0 ? Math.max((row.count / maxCount) * 100, 6) : 0;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-brand-border/60 overflow-hidden" role="presentation">
        <div className="h-full rounded-full bg-brand-gold/55" style={{ width: `${barWidth}%` }} />
      </div>
      <span className="tabular-nums text-brand-text shrink-0 w-9 text-right">{row.count}</span>
    </div>
  );
}

export function DashboardTopSellingPanel({ items, i18n }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-brand-border">
          <h2 className="font-heading text-lg text-brand-gold">{i18n.topSellingTitle}</h2>
        </div>
        <p className="px-5 sm:px-6 py-6 text-brand-text-muted text-sm">{i18n.topSellingEmpty}</p>
      </div>
    );
  }

  const summary = summarizeTopSellingItems(items);
  const rows = buildTopSellingRows(items);
  const maxCount = rows[0]?.count ?? 1;
  const listedSummary = i18n.topSellingListedSummary
    .replace('{units}', String(summary.totalUnits))
    .replace('{revenue}', summary.totalRevenue.toFixed(2));

  return (
    <ValueAnalyticsTopTable
      title={i18n.topSellingTitle}
      rows={rows}
      dense
      footer={<p className="text-[13px] text-brand-text-muted tabular-nums">{listedSummary}</p>}
      columns={[
        { key: 'rank', header: i18n.colRank },
        { key: 'name', header: i18n.colDish },
        {
          key: 'count',
          header: i18n.colQty,
          render: (row) => quantityBarCell(row, maxCount),
        },
        {
          key: 'volumeShare',
          header: i18n.colShare,
          align: 'right',
          render: (row) => (
            <span className="tabular-nums text-brand-text-muted">{(row.volumeShare * 100).toFixed(1)}%</span>
          ),
        },
      ]}
    />
  );
}
