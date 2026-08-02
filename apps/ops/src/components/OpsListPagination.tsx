'use client';

import Link from 'next/link';

type Props = {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
};

/** Sole ops console list pager — prev / page info / next via URL links. */
export function OpsListPagination({ page, pageCount, hrefForPage }: Props) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex gap-2 text-sm">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className="text-amber-400">
          上一页
        </Link>
      ) : null}
      <span className="text-zinc-500">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className="text-amber-400">
          下一页
        </Link>
      ) : null}
    </div>
  );
}
