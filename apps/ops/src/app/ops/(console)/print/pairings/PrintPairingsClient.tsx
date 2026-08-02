'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { OpsListPagination } from '@/components/OpsListPagination';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  opsListHref,
  opsListPageCount,
  parseOpsListPage,
} from '@/lib/ops-list-pagination';

type PairingRow = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  code: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  pending: boolean;
};

export default function PrintPairingsClient({
  fixedRestaurantId,
}: {
  fixedRestaurantId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseOpsListPage(searchParams);
  const pendingOnly = searchParams.get('pending') !== '0';
  const restaurantId = fixedRestaurantId || searchParams.get('restaurantId') || '';

  const [items, setItems] = useState<PairingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingFilter, setPendingFilter] = useState(pendingOnly);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PairingRow | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (!pendingOnly) params.set('pending', '0');
    if (restaurantId) params.set('restaurantId', restaurantId);
    const res = await fetch(`/api/ops/print/pairings?${params}`, { credentials: 'include' });
    const json = (await res.json()) as {
      items?: PairingRow[];
      total?: number;
      pageSize?: number;
    };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setPageSize(json.pageSize || 1);
    setLoading(false);
  }, [page, pendingOnly, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (fixedRestaurantId) return;
    const params = new URLSearchParams();
    if (!pendingFilter) params.set('pending', '0');
    router.push(`/ops/print/pairings?${params}`);
  };

  const runRevokePairing = async () => {
    const row = revokeTarget;
    if (!row) return;
    setRevokingId(row.id);
    setError('');
    try {
      const res = await fetch(`/api/ops/print/pairings/${row.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId: row.restaurantId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || '吊销失败');
        return;
      }
      setRevokeTarget(null);
      await load();
    } catch {
      setError('网络错误');
    } finally {
      setRevokingId(null);
    }
  };

  const pageCount = opsListPageCount(total, pageSize);
  const listBase = '/ops/print/pairings';
  const listFilters = { pending: pendingOnly ? undefined : '0' };

  return (
    <div>
      {!fixedRestaurantId ? (
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.checked)}
            />
            仅待消费有效码
          </label>
          <button type="submit" className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800">
            筛选
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="mt-8 text-zinc-500">加载中…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                {!fixedRestaurantId ? <th className="px-3 py-2">餐厅</th> : null}
                <th className="px-3 py-2">配对码</th>
                <th className="px-3 py-2">创建时间</th>
                <th className="px-3 py-2">过期时间</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  {!fixedRestaurantId ? (
                    <td className="px-3 py-2">
                      <Link
                        href={`/ops/restaurants/${p.restaurantId}/print`}
                        className="text-amber-400 hover:underline"
                      >
                        {p.restaurantName}
                      </Link>
                    </td>
                  ) : null}
                  <td className="px-3 py-2 font-mono tracking-widest">{p.code}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {new Date(p.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {new Date(p.expiresAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2">
                    {p.revokedAt ? (
                      <span className="text-red-400">已吊销</span>
                    ) : p.consumedAt ? (
                      <span className="text-zinc-500">已消费</span>
                    ) : p.pending ? (
                      <span className="text-amber-400">待消费</span>
                    ) : (
                      <span className="text-zinc-500">已过期</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.pending ? (
                      <button
                        type="button"
                        disabled={revokingId === p.id}
                        onClick={() => setRevokeTarget(p)}
                        className="text-sm text-red-400 hover:underline disabled:opacity-50"
                      >
                        吊销
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={fixedRestaurantId ? 5 : 6} className="px-3 py-8 text-center text-zinc-500">
                    暂无配对码
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
        hrefForPage={(p) => opsListHref(listBase, p, listFilters)}
      />

      <ConfirmModal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title="吊销配对码"
        message={
          revokeTarget
            ? `确认吊销配对码 ${revokeTarget.code}？\n未消费的码将立即作废，操作会写入审计日志。`
            : ''
        }
        confirmLabel="确认吊销"
        cancelLabel="取消"
        variant="danger"
        confirming={revokingId != null}
        onConfirm={runRevokePairing}
      />
    </div>
  );
}
