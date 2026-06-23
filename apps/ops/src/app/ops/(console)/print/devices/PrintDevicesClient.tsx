'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type DeviceRow = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  label: string | null;
  pairedAt: string;
  validUntil: string;
  revokedAt: string | null;
  lastSeen: string | null;
  agentVersion: string | null;
  lastPrintAt: string | null;
  lastPrintStatus: string | null;
  active: boolean;
  online: boolean;
};

export default function PrintDevicesClient({
  fixedRestaurantId,
}: {
  fixedRestaurantId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const restaurantId = fixedRestaurantId || searchParams.get('restaurantId') || '';

  const [items, setItems] = useState<DeviceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(q);
  const [statusFilter, setStatusFilter] = useState(status);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (status && status !== 'all') params.set('status', status);
    if (restaurantId) params.set('restaurantId', restaurantId);
    const res = await fetch(`/api/ops/print/devices?${params}`, { credentials: 'include' });
    const json = (await res.json()) as { items?: DeviceRow[]; total?: number };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setLoading(false);
  }, [page, q, status, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (fixedRestaurantId) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    router.push(`/ops/print/devices?${params}`);
  };

  const revokeDevice = async (device: DeviceRow) => {
    if (!window.confirm(`确认吊销设备 ${device.label || device.id.slice(0, 8)}？`)) return;
    setRevokingId(device.id);
    setError('');
    try {
      const res = await fetch(`/api/ops/print/devices/${device.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId: device.restaurantId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || '吊销失败');
        return;
      }
      await load();
    } catch {
      setError('网络错误');
    } finally {
      setRevokingId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const listBase = fixedRestaurantId
    ? `/ops/restaurants/${fixedRestaurantId}/print`
    : '/ops/print/devices';
  const listQuerySuffix = [
    q ? `q=${encodeURIComponent(q)}` : '',
    status && status !== 'all' ? `status=${encodeURIComponent(status)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  return (
    <div>
      {!fixedRestaurantId ? (
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索餐厅名称或 slug"
            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="active">有效</option>
            <option value="revoked">已吊销</option>
          </select>
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
                <th className="px-3 py-2">设备</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">最近在线</th>
                <th className="px-3 py-2">版本</th>
                <th className="px-3 py-2">有效期至</th>
                <th className="px-3 py-2">最近打印</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  {!fixedRestaurantId ? (
                    <td className="px-3 py-2">
                      <Link
                        href={`/ops/restaurants/${d.restaurantId}/print`}
                        className="text-amber-400 hover:underline"
                      >
                        {d.restaurantName}
                      </Link>
                      <div className="font-mono text-xs text-zinc-500">{d.restaurantSlug}</div>
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div>{d.label || '未命名'}</div>
                    <div className="font-mono text-xs text-zinc-500">{d.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2">
                    {d.revokedAt ? (
                      <span className="text-red-400">已吊销</span>
                    ) : d.active ? (
                      <span className={d.online ? 'text-emerald-400' : 'text-amber-400'}>
                        {d.online ? '在线' : '离线'}
                      </span>
                    ) : (
                      <span className="text-zinc-500">已过期</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {d.lastSeen ? new Date(d.lastSeen).toLocaleString('zh-CN') : '—'}
                  </td>
                  <td className="px-3 py-2">{d.agentVersion || '—'}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {new Date(d.validUntil).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {d.lastPrintAt ? (
                      <>
                        {new Date(d.lastPrintAt).toLocaleString('zh-CN')}
                        {d.lastPrintStatus ? ` (${d.lastPrintStatus})` : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!d.revokedAt && d.active ? (
                      <button
                        type="button"
                        disabled={revokingId === d.id}
                        onClick={() => void revokeDevice(d)}
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
                  <td colSpan={fixedRestaurantId ? 7 : 8} className="px-3 py-8 text-center text-zinc-500">
                    暂无设备
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
