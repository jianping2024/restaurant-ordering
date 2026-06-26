import type { ReactNode } from 'react';

type Column<T> = {
  key: keyof T;
  header: string;
  align?: 'left' | 'right';
  render?: (row: T) => ReactNode;
};

type Props<T extends { rank: number }> = {
  title: string;
  rows: T[];
  columns: Column<T>[];
  footer?: ReactNode;
};

export function ValueAnalyticsTopTable<T extends { rank: number }>({
  title,
  rows,
  columns,
  footer,
}: Props<T>) {
  return (
    <section className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-border">
        <h2 className="text-[15px] font-medium text-brand-text">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-brand-text-muted border-b border-brand-border">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-2 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-brand-text-muted"
                >
                  —
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.rank} className="border-b border-brand-border/60 last:border-0">
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`px-4 py-2.5 text-brand-text ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="px-4 py-3 border-t border-brand-border">{footer}</div> : null}
    </section>
  );
}
