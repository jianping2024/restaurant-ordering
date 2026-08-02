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

/**
 * Sole ops console list pager: page info + page-size select + prev/next links.
 * Page-size select stays visible even when only one page.
 */
export function OpsListPagination({
  page,
  pageCount,
  pageSize,
  hrefForPage,
  hrefForPageSize,
}: Props) {
  const router = useRouter();

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
          {page > 1 ? (
            <Link href={hrefForPage(page - 1)} className="text-amber-400">
              上一页
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link href={hrefForPage(page + 1)} className="text-amber-400">
              下一页
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
