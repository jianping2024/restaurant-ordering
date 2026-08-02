'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  formatOpsPrimaryLabel,
  resolveInstallPhase,
  resolveOpsLicenseHealth,
  type InstallPhase,
} from '@/lib/ops-license-status';

type LicenseItem = {
  id: string;
  name: string;
  slug: string;
  deploymentMode: string;
  licenseValidUntil: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  ownerEmail: string | null;
  installPhase: InstallPhase;
  licenseCheckedAt: string | null;
  lastCheckinAt: string | null;
  offlineGraceDays: number;
};

function primaryClass(kind: string, observationOnly?: boolean): string {
  if (kind === 'suspended') {
    return observationOnly ? 'text-amber-300' : 'text-amber-400';
  }
  if (kind === 'install') return 'text-sky-400';
  return 'text-emerald-500';
}

function lastOnlineClass(tone: 'ok' | 'warn' | 'danger'): string {
  if (tone === 'danger') return 'text-red-400';
  if (tone === 'warn') return 'text-amber-400';
  return 'text-zinc-500';
}

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
        {items.map((item) => {
          const installPhase =
            item.installPhase ??
            resolveInstallPhase({ claimed: false, pending: false });
          const health = resolveOpsLicenseHealth({
            deploymentMode: item.deploymentMode,
            suspendedAt: item.suspendedAt,
            suspensionReason: item.suspensionReason,
            licenseValidUntil: item.licenseValidUntil,
            licenseCheckedAt: item.licenseCheckedAt,
            lastCheckinAt: item.lastCheckinAt,
            installPhase,
            offlineGraceDays: item.offlineGraceDays,
          });
          return (
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
                <div
                  className={primaryClass(
                    health.primary.kind,
                    health.primary.kind === 'suspended' ? health.primary.observationOnly : false,
                  )}
                >
                  {formatOpsPrimaryLabel(health.primary)}
                </div>
                {health.lastOnline ? (
                  <div className={`text-xs ${lastOnlineClass(health.lastOnline.tone)}`}>
                    {health.lastOnline.line}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
        {!loading && items.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">暂无餐厅</li>
        ) : null}
      </ul>
    </div>
  );
}
