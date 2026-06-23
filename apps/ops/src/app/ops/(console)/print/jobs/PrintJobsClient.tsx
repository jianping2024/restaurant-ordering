'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type JobRow = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  type: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
  claimedBy: string | null;
  tableDisplay: string | null;
};

export default function PrintJobsClient({ fixedRestaurantId }: { fixedRestaurantId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const table = searchParams.get('table') || '';
  const restaurantId = fixedRestaurantId || searchParams.get('restaurantId') || '';

  const [items, setItems] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(type);
  const [statusFilter, setStatusFilter] = useState(status);
  const [tableFilter, setTableFilter] = useState(table);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (table) params.set('table', table);
    if (restaurantId) params.set('restaurantId', restaurantId);
    const res = await fetch(`/api/ops/print/jobs?${params}`, { credentials: 'include' });
    const json = (await res.json()) as { items?: JobRow[]; total?: number };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setLoading(false);
  }, [page, type, status, table, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (fixedRestaurantId) return;
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (tableFilter.trim()) params.set('table', tableFilter.trim());
    router.push(`/ops/print/jobs?${params}`);
  };

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const listBase = fixedRestaurantId
    ? `/ops/restaurants/${fixedRestaurantId}/print`
    : '/ops/print/jobs';
  const listQuerySuffix = [
    type ? `type=${encodeURIComponent(type)}` : '',
    status ? `status=${encodeURIComponent(status)}` : '',
    table ? `table=${encodeURIComponent(table)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  return (
    <div>
      {!fixedRestaurantId ? (
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">全部类型</option>
            <option value="order_receipt">order_receipt</option>
            <option value="station_ticket">station_ticket</option>
            <option value="pre_bill">pre_bill</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
          </select>
          <input
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="桌名"
            className="min-w-[120px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800">
            筛选
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-8 text-zinc-500">加载中…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2">时间</th>
                {!fixedRestaurantId ? <th className="px-3 py-2">餐厅</th> : null}
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">桌位</th>
                <th className="px-3 py-2">claimed_by</th>
                <th className="px-3 py-2">错误</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                    {new Date(j.createdAt).toLocaleString('zh-CN')}
                  </td>
                  {!fixedRestaurantId ? (
                    <td className="px-3 py-2">
                      <Link
                        href={`/ops/restaurants/${j.restaurantId}/print`}
                        className="text-amber-400 hover:underline"
                      >
                        {j.restaurantName}
                      </Link>
                    </td>
                  ) : null}
                  <td className="px-3 py-2 font-mono text-xs">{j.type}</td>
                  <td className="px-3 py-2">
                    <span className={j.status === 'failed' ? 'text-red-400' : ''}>{j.status}</span>
                  </td>
                  <td className="px-3 py-2">{j.tableDisplay || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {j.claimedBy ? `${j.claimedBy.slice(0, 8)}…` : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-red-300" title={j.errorMessage || ''}>
                    {j.errorMessage || '—'}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={fixedRestaurantId ? 6 : 7} className="px-3 py-8 text-center text-zinc-500">
                    暂无任务
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-4 flex gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`${listBase}?page=${page - 1}${listQuerySuffix ? `&${listQuerySuffix}` : ''}`}
              className="text-amber-400"
            >
              上一页
            </Link>
          ) : null}
          <span className="text-zinc-500">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={`${listBase}?page=${page + 1}${listQuerySuffix ? `&${listQuerySuffix}` : ''}`}
              className="text-amber-400"
            >
              下一页
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
