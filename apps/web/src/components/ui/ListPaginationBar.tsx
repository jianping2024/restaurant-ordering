'use client';

import { Button } from '@/components/ui/Button';
import {
  isListPageSize,
  LIST_PAGE_SIZES,
  type ListPageSize,
} from '@/lib/paginate-list';

export type ListPaginationBarLabels = {
  pageInfo: string;
  pageSizeLabel: string;
  pagePrev: string;
  pageNext: string;
};

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: ListPageSize;
  labels: ListPaginationBarLabels;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ListPageSize) => void;
  disabled?: boolean;
};

/**
 * Shared dashboard list footer: page info + page-size select + prev/next.
 * Presentational only — parent owns fetch vs in-memory slicing.
 */
export function ListPaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  labels,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: Props) {
  return (
    <div className="px-4 py-3 border-t border-brand-border/70 flex flex-wrap items-center justify-end gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-brand-text-muted">
          {labels.pageInfo
            .replace('{page}', String(page))
            .replace('{totalPages}', String(totalPages))
            .replace('{total}', String(total))}
        </p>
        <label className="flex items-center gap-2 text-[13px] text-brand-text-muted">
          <span className="whitespace-nowrap">{labels.pageSizeLabel}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (isListPageSize(next)) onPageSizeChange(next);
            }}
            disabled={disabled}
            className="rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-base text-brand-text focus:outline-none focus:border-brand-gold/40 disabled:opacity-50"
            aria-label={labels.pageSizeLabel}
          >
            {LIST_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {labels.pagePrev}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {labels.pageNext}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
