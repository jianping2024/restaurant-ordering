'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type LicenseItem = {
  id: string;
  name: string;
  slug: string;
  deploymentMode: string;
  licenseValidUntil: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  ownerEmail: string | null;
  installStatus: string;
  lastCheckinAt: string | null;
};

export function LicensesListClient() {
  const [items, setItems] = useState<LicenseItem[]>([]);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (mode) params.set('mode', mode);
      const res = await fetch(`/api/ops/licenses?${params}`, { credentials: 'include' });
      const json = (await res.json()) as { items?: LicenseItem[]; error?: string };
      if (!res.ok) {
        setError(json.error || '加载失败');
        return;
      }
      setItems(json.items || []);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [q, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-400">
          搜索
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 block w-56 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="名称 / slug / 邮箱"
          />
        </label>
        <label className="text-sm text-zinc-400">
          模式
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-1 block rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            <option value="cloud">云</option>
            <option value="on_prem">本地</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          刷新
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-zinc-500">加载中…</p> : null}
      <ul className="mt-6 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/ops/licenses/${item.id}`} className="font-medium text-amber-400 hover:underline">
                {item.name}
              </Link>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {item.slug} · {item.deploymentMode === 'on_prem' ? '本地' : '云'}
                {item.ownerEmail ? ` · ${item.ownerEmail}` : ''}
              </p>
            </div>
            <div className="text-right text-sm text-zinc-400">
              <div>
                截止：
                {item.licenseValidUntil
                  ? new Date(item.licenseValidUntil).toLocaleString('zh-CN')
                  : '不限期'}
              </div>
              <div className={item.suspendedAt ? 'text-amber-400' : 'text-emerald-500'}>
                {item.suspendedAt ? '已暂停' : '营业中'}
                {item.deploymentMode === 'on_prem' ? ` · 安装 ${item.installStatus}` : ''}
              </div>
            </div>
          </li>
        ))}
        {!loading && items.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">暂无餐厅</li>
        ) : null}
      </ul>
    </div>
  );
}
