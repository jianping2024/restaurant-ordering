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
  const page = parseOpsListPage(searchParams);
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const restaurantId = fixedRestaurantId || searchParams.get('restaurantId') || '';

  const [items, setItems] = useState<DeviceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(q);
  const [statusFilter, setStatusFilter] = useState(status);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<DeviceRow | null>(null);
  const [supportToken, setSupportToken] = useState<{
    token: string;
    expiresAt: string;
    deviceLabel: string;
  } | null>(null);
  const [issuingSupportId, setIssuingSupportId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (status && status !== 'all') params.set('status', status);
    if (restaurantId) params.set('restaurantId', restaurantId);
    const res = await fetch(`/api/ops/print/devices?${params}`, { credentials: 'include' });
    const json = (await res.json()) as {
      items?: DeviceRow[];
      total?: number;
      pageSize?: number;
    };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setPageSize(json.pageSize || 1);
    setLoading(false);
  }, [page, q, status, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deviceDisplayName = (device: DeviceRow) => device.label || device.id.slice(0, 8);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (fixedRestaurantId) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    router.push(`/ops/print/devices?${params}`);
  };

  const issueSupportToken = async (device: DeviceRow) => {
    setIssuingSupportId(device.id);
    setError('');
    try {
      const res = await fetch(`/api/ops/print/devices/${device.id}/support-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId: device.restaurantId }),
      });
      const json = (await res.json()) as {
        supportToken?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !json.supportToken || !json.expiresAt) {
        setError(json.error || '签发失败');
        return;
      }
      setSupportToken({
        token: json.supportToken,
        expiresAt: json.expiresAt,
        deviceLabel: deviceDisplayName(device),
      });
    } catch {
      setError('网络错误');
    } finally {
      setIssuingSupportId(null);
    }
  };

  const runRevokeDevice = async () => {
    const device = revokeTarget;
    if (!device) return;
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
      setRevokeTarget(null);
      await load();
    } catch {
      setError('网络错误');
    } finally {
      setRevokingId(null);
    }
  };

  const pageCount = opsListPageCount(total, pageSize);
  const listBase = fixedRestaurantId
    ? `/ops/restaurants/${fixedRestaurantId}/print`
    : '/ops/print/devices';
  const listFilters = {
    q,
    status: status !== 'all' ? status : undefined,
  };

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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={issuingSupportId === d.id}
                          onClick={() => void issueSupportToken(d)}
                          className="text-sm text-amber-400 hover:underline disabled:opacity-50"
                        >
                          排障令牌
                        </button>
                        <button
                          type="button"
                          disabled={revokingId === d.id}
                          onClick={() => setRevokeTarget(d)}
                          className="text-sm text-red-400 hover:underline disabled:opacity-50"
                        >
                          吊销
                        </button>
                      </div>
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

      <OpsListPagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => opsListHref(listBase, p, listFilters)}
      />

      <ConfirmModal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title="吊销设备"
        message={
          revokeTarget
            ? `确认吊销设备「${deviceDisplayName(revokeTarget)}」？\n吊销后该打印代理凭证将失效，操作会写入审计日志。`
            : ''
        }
        confirmLabel="确认吊销"
        cancelLabel="取消"
        variant="danger"
        confirming={revokingId != null}
        onConfirm={runRevokeDevice}
      />

      {supportToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
            <h2 className="text-lg font-medium">一次性排障令牌</h2>
            <p className="mt-2 text-sm text-zinc-400">
              设备「{supportToken.deviceLabel}」。令牌 15 分钟内有效，仅可使用一次；用于{' '}
              <code className="text-xs">GET /api/print-agent/support-snapshot</code>（Bearer
              鉴权）。不会返回 <code className="text-xs">agentjwt</code>。
            </p>
            <p className="mt-2 text-xs text-amber-400">
              过期时间：{new Date(supportToken.expiresAt).toLocaleString('zh-CN')}
            </p>
            <textarea
              readOnly
              value={supportToken.token}
              className="mt-4 h-28 w-full rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(supportToken.token)}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                复制
              </button>
              <button
                type="button"
                onClick={() => setSupportToken(null)}
                className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
