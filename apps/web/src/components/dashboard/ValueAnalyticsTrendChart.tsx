'use client';

import { format, parseISO } from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TrendPoint = {
  date: string;
  dateLabel: string;
  value: number;
  adultCount?: number;
  childCount?: number;
};

type Props = {
  title: string;
  data: TrendPoint[];
  yAxisLabel: string;
  valueFormatter: (value: number) => string;
  variant: 'revenue' | 'customer';
  tooltipLabels: {
    total: string;
    adults: string;
    children: string;
  };
};

function formatDateLabel(date: string): string {
  return format(parseISO(date), 'MM/dd');
}

export function buildTrendChartPoints<T extends { date: string }>(
  rows: T[],
  pickValue: (row: T) => number,
  pickGuests?: (row: T) => { adultCount?: number; childCount?: number },
): TrendPoint[] {
  return rows.map((row) => ({
    date: row.date,
    dateLabel: formatDateLabel(row.date),
    value: pickValue(row),
    adultCount: pickGuests?.(row).adultCount,
    childCount: pickGuests?.(row).childCount,
  }));
}

function renderTrendTooltip(
  valueFormatter: (value: number) => string,
  variant: 'revenue' | 'customer',
  tooltipLabels: Props['tooltipLabels'],
) {
  return function TrendTooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: TrendPoint }>;
  }) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    return (
      <div className="rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-[13px] shadow-md">
        <p className="text-brand-text-muted mb-1">{point.date}</p>
        {variant === 'revenue' ? (
          <p className="text-brand-text font-medium">{valueFormatter(point.value)}</p>
        ) : (
          <>
            <p className="text-brand-text font-medium">
              {tooltipLabels.total}: {point.value}
            </p>
            <p className="text-brand-text-muted">
              {tooltipLabels.adults}: {point.adultCount ?? 0} · {tooltipLabels.children}:{' '}
              {point.childCount ?? 0}
            </p>
          </>
        )}
      </div>
    );
  };
}

export function ValueAnalyticsTrendChart({
  title,
  data,
  yAxisLabel,
  valueFormatter,
  variant,
  tooltipLabels,
}: Props) {
  return (
    <section className="bg-brand-card border border-brand-border rounded-xl p-4">
      <h2 className="text-[15px] font-medium text-brand-text mb-4">{title}</h2>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-brand-border" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: 'currentColor' }} />
            <YAxis
              tick={{ fontSize: 12, fill: 'currentColor' }}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: 'currentColor' },
              }}
            />
            <Tooltip
              content={renderTrendTooltip(valueFormatter, variant, tooltipLabels)}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--color-brand-gold))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
