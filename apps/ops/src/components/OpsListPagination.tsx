'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  isOpsListPageSize,
  OPS_LIST_PAGE_SIZES,
  type OpsListPageSize,
} from '@/lib/ops-list-pagination';

type Props = {
  page: number;
  pageCount: number;
  pageSize: OpsListPageSize;
  hrefForPage: (page: number) => string;
  /** Must reset to page 1 when size changes. */
  hrefForPageSize: (pageSize: OpsListPageSize) => string;
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

const iconClass = 'h-3.5 w-3.5 shrink-0';
const linkClass =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded border border-zinc-700 px-2 py-1 text-amber-400 hover:border-amber-500/50 aria-disabled:pointer-events-none aria-disabled:opacity-40';

/**
 * Sole ops console list pager: page info + page-size select + first/prev/next/last icon links.
 * Page-size select stays visible even when only one page.
 * Visible controls are icon-only; Chinese labels are aria-label only.
 */
export function OpsListPagination({
  page,
  pageCount,
  pageSize,
  hrefForPage,
  hrefForPageSize,
}: Props) {
  const router = useRouter();
  const atFirst = page <= 1;
  const atLast = page >= pageCount;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-zinc-500">
        {page} / {pageCount}
      </span>
      <label className="flex items-center gap-2 text-zinc-400">
        <span className="whitespace-nowrap">每页</span>
        <select
          value={pageSize}
          aria-label="每页"
          onChange={(e) => {
            const next = Number(e.target.value);
            if (isOpsListPageSize(next)) router.push(hrefForPageSize(next));
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus:outline-none focus:border-amber-500/50"
        >
          {OPS_LIST_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {pageCount > 1 ? (
        <div className="flex gap-2">
          {atFirst ? (
            <span className={linkClass} aria-disabled="true" aria-label="第一页" title="第一页">
              <ChevronsLeftIcon className={iconClass} />
            </span>
          ) : (
            <Link href={hrefForPage(1)} className={linkClass} aria-label="第一页" title="第一页">
              <ChevronsLeftIcon className={iconClass} />
            </Link>
          )}
          {atFirst ? (
            <span className={linkClass} aria-disabled="true" aria-label="上一页" title="上一页">
              <ChevronLeftIcon className={iconClass} />
            </span>
          ) : (
            <Link href={hrefForPage(page - 1)} className={linkClass} aria-label="上一页" title="上一页">
              <ChevronLeftIcon className={iconClass} />
            </Link>
          )}
          {atLast ? (
            <span className={linkClass} aria-disabled="true" aria-label="下一页" title="下一页">
              <ChevronRightIcon className={iconClass} />
            </span>
          ) : (
            <Link href={hrefForPage(page + 1)} className={linkClass} aria-label="下一页" title="下一页">
              <ChevronRightIcon className={iconClass} />
            </Link>
          )}
          {atLast ? (
            <span className={linkClass} aria-disabled="true" aria-label="最后一页" title="最后一页">
              <ChevronsRightIcon className={iconClass} />
            </span>
          ) : (
            <Link
              href={hrefForPage(pageCount)}
              className={linkClass}
              aria-label="最后一页"
              title="最后一页"
            >
              <ChevronsRightIcon className={iconClass} />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
