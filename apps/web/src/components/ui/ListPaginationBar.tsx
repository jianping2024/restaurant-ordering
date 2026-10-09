'use client';

import { Button, buttonIcon } from '@/components/ui/Button';
import { FORM_CONTROL_TEXT_CLASS } from '@/lib/form-control-text';
import {
  isListPageSize,
  LIST_PAGE_SIZES,
  type ListPageSize,
} from '@/lib/paginate-list';

export type ListPaginationBarLabels = {
  pageInfo: string;
  pageSizeLabel: string;
  pageFirst: string;
  pagePrev: string;
  pageNext: string;
  pageLast: string;
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronsLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronsRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const iconBtnClass = 'min-w-[2.25rem] px-2';

/** Compact page-size select — sole chrome for ListPaginationBar meta row (not form toolbar). */
const pageSizeSelectClass =
  `h-8 appearance-none cursor-pointer bg-transparent border border-brand-border/70 rounded-md pl-2 pr-6 leading-none ${FORM_CONTROL_TEXT_CLASS} text-brand-text-muted focus:outline-none focus:border-brand-gold/40 disabled:opacity-50 disabled:cursor-not-allowed`;

function PageSizeSelectChevron() {
  return (
    <span
      className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-brand-text-muted opacity-70"
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Sole dashboard list footer: page info + page-size select + first/prev/next/last icons.
 * Presentational only — parent owns fetch vs in-memory slicing.
 * Visible controls are icon-only; labels are aria-label only.
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
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

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
          <span className="relative inline-flex shrink-0">
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (isListPageSize(next)) onPageSizeChange(next);
              }}
              disabled={disabled}
              className={pageSizeSelectClass}
              aria-label={labels.pageSizeLabel}
            >
              {LIST_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <PageSizeSelectChevron />
          </span>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={iconBtnClass}
            disabled={disabled || atFirst}
            aria-label={labels.pageFirst}
            title={labels.pageFirst}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeftIcon className={buttonIcon.sm} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={iconBtnClass}
            disabled={disabled || atFirst}
            aria-label={labels.pagePrev}
            title={labels.pagePrev}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon className={buttonIcon.sm} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={iconBtnClass}
            disabled={disabled || atLast}
            aria-label={labels.pageNext}
            title={labels.pageNext}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRightIcon className={buttonIcon.sm} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={iconBtnClass}
            disabled={disabled || atLast}
            aria-label={labels.pageLast}
            title={labels.pageLast}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronsRightIcon className={buttonIcon.sm} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
