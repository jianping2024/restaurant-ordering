'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { OpsListPagination } from '@/components/OpsListPagination';
import {
  PLATFORM_AUDIT_ACTION_LABELS,
  platformAuditActionLabel,
} from '@/lib/platform-audit';
import {
  OPS_LIST_DEFAULT_PAGE_SIZE,
  opsListHref,
  opsListPageCount,
  parseOpsListPage,
  parseOpsListPageSize,
  type OpsListPageSize,
} from '@/lib/ops-list-pagination';

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  restaurantId: string | null;
  restaurantName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorEmail: string | null;
};

export default function AuditLogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseOpsListPage(searchParams);
  const pageSize = parseOpsListPageSize(searchParams);
  const action = searchParams.get('action') || '';
  const restaurantId = searchParams.get('restaurantId') || '';

  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState(action);
  const [restaurantFilter, setRestaurantFilter] = useState(restaurantId);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (action) params.set('action', action);
    if (restaurantId) params.set('restaurantId', restaurantId);
    const res = await fetch(`/api/ops/audit?${params}`, { credentials: 'include' });
    const json = (await res.json()) as {
      items?: AuditRow[];
      total?: number;
      pageSize?: number;
    };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setLoading(false);
  }, [page, pageSize, action, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActionFilter(action);
    setRestaurantFilter(restaurantId);
  }, [action, restaurantId]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (restaurantFilter.trim()) params.set('restaurantId', restaurantFilter.trim());
    if (pageSize !== OPS_LIST_DEFAULT_PAGE_SIZE) params.set('pageSize', String(pageSize));
    router.push(`/ops/audit?${params}`);
  };

  const pageCount = opsListPageCount(total, pageSize);
  const listFilters = { action, restaurantId, pageSize: String(pageSize) };
  const hrefForPage = (p: number) => opsListHref('/ops/audit', p, listFilters);
  const hrefForPageSize = (size: OpsListPageSize) =>
    opsListHref('/ops/audit', 1, { ...listFilters, pageSize: String(size) });
  const exportParams = new URLSearchParams();
  if (action) exportParams.set('action', action);
  if (restaurantId) exportParams.set('restaurantId', restaurantId);
  const exportQs = exportParams.toString();
  const exportHref = `/api/ops/audit/export${exportQs ? `?${exportQs}` : ''}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">审计日志</h1>
      <p className="mt-2 text-sm text-zinc-400">平台运营写操作与登录记录（不含密码与 JWT）</p>

      <form onSubmit={onSearch} className="mt-6 flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">全部操作</option>
          {Object.entries(PLATFORM_AUDIT_ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={restaurantFilter}
          onChange={(e) => setRestaurantFilter(e.target.value)}
          placeholder="餐厅 ID（UUID）"
          className="min-w-[220px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800">
          筛选
        </button>
        <a
          href={exportHref}
          className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
        >
          导出 CSV
        </a>
      </form>

      {loading ? (
        <p className="mt-8 text-zinc-500">加载中…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">操作人</th>
                <th className="px-3 py-2">操作</th>
                <th className="px-3 py-2">目标</th>
                <th className="px-3 py-2">餐厅</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                    {new Date(row.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2">{row.actorEmail || '—'}</td>
                  <td className="px-3 py-2">{platformAuditActionLabel(row.action)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                    {row.targetType}/{row.targetId.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    {row.restaurantId ? (
                      <Link
                        href={`/ops/restaurants/${row.restaurantId}`}
                        className="text-amber-400 hover:underline"
                        title={row.restaurantId}
                      >
                        {row.restaurantName || row.restaurantId.slice(0, 8) + '…'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <OpsListPagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        hrefForPage={hrefForPage}
        hrefForPageSize={hrefForPageSize}
      />
    </div>
  );
}
