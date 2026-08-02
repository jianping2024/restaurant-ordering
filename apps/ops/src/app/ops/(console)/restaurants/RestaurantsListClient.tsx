'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  BUSINESS_STATUS_LABEL,
  formatOpsPrimaryLabel,
  resolveInstallPhase,
  resolveOpsLicenseHealth,
  type InstallPhase,
} from '@/lib/ops-license-status';

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerEmail: string | null;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  deploymentMode: string;
  licenseValidUntil: string | null;
  licenseCheckedAt: string | null;
  lastCheckinAt: string | null;
  installPhase: InstallPhase;
  offlineGraceDays: number;
};

type Summary = { restaurantCount: number; suspendedCount: number };

function primaryClass(kind: string, observationOnly?: boolean): string {
  if (kind === 'suspended') {
    return observationOnly
      ? 'rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300'
      : 'rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400';
  }
  if (kind === 'install') {
    return 'rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-400';
  }
  return 'text-zinc-500';
}

export default function RestaurantsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const q = searchParams.get('q') || '';
  const plan = searchParams.get('plan') || '';
  const ownerEmail = searchParams.get('ownerEmail') || '';

  const [items, setItems] = useState<RestaurantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({ restaurantCount: 0, suspendedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(q);
  const [planFilter, setPlanFilter] = useState(plan);
  const [ownerEmailFilter, setOwnerEmailFilter] = useState(ownerEmail);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (plan) params.set('plan', plan);
    if (ownerEmail) params.set('ownerEmail', ownerEmail);
    const res = await fetch(`/api/ops/restaurants?${params}`, { credentials: 'include' });
    const json = (await res.json()) as {
      items?: RestaurantRow[];
      total?: number;
      summary?: Summary;
    };
    setItems(json.items || []);
    setTotal(json.total || 0);
    setSummary(json.summary || { restaurantCount: 0, suspendedCount: 0 });
    setLoading(false);
  }, [page, q, plan, ownerEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (planFilter) params.set('plan', planFilter);
    if (ownerEmailFilter.trim()) params.set('ownerEmail', ownerEmailFilter.trim());
    const qs = params.toString();
    router.push(qs ? `/ops?${qs}` : '/ops');
  };

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const listQuerySuffix = [
    q ? `q=${encodeURIComponent(q)}` : '',
    plan ? `plan=${encodeURIComponent(plan)}` : '',
    ownerEmail ? `ownerEmail=${encodeURIComponent(ownerEmail)}` : '',
  ]
    .filter(Boolean)
    .join('&');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">餐厅</h1>
          <p className="mt-1 text-sm text-zinc-500">创建与管理基本信息、重置店主密码</p>
        </div>
        <Link
          href="/ops/restaurants/new"
          className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          创建餐厅 + 店主
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">入驻餐厅</p>
          <p className="mt-1 text-3xl font-semibold">{summary.restaurantCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">{BUSINESS_STATUS_LABEL.suspended}</p>
          <p className="mt-1 text-3xl font-semibold text-amber-400">{summary.suspendedCount}</p>
        </div>
      </div>

      <form onSubmit={onSearch} className="mt-6 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称或 slug"
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">全部 plan</option>
          <option value="free">free</option>
          <option value="pro">pro</option>
        </select>
        <input
          value={ownerEmailFilter}
          onChange={(e) => setOwnerEmailFilter(e.target.value)}
          placeholder="店主邮箱"
          type="email"
          className="min-w-[180px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800">
          筛选
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-zinc-500">加载中…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">slug</th>
                <th className="px-3 py-2">店主邮箱</th>
                <th className="px-3 py-2">plan</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const installPhase =
                  r.installPhase ?? resolveInstallPhase({ claimed: false, pending: false });
                const health = resolveOpsLicenseHealth({
                  deploymentMode: r.deploymentMode,
                  suspendedAt: r.suspendedAt,
                  suspensionReason: r.suspensionReason,
                  licenseValidUntil: r.licenseValidUntil,
                  licenseCheckedAt: r.licenseCheckedAt,
                  lastCheckinAt: r.lastCheckinAt,
                  installPhase,
                  offlineGraceDays: r.offlineGraceDays,
                });
                return (
                  <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                    <td className="px-3 py-2">
                      <Link href={`/ops/restaurants/${r.id}`} className="text-amber-400 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.slug}</td>
                    <td className="px-3 py-2">{r.ownerEmail || '—'}</td>
                    <td className="px-3 py-2">{r.plan}</td>
                    <td className="px-3 py-2">
                      {health.primary.kind === 'suspended' ? (
                        <Link
                          href={`/ops/licenses/${r.id}`}
                          className={primaryClass(health.primary.kind, health.primary.observationOnly)}
                        >
                          {formatOpsPrimaryLabel(health.primary)}
                        </Link>
                      ) : (
                        <span className={primaryClass(health.primary.kind)}>
                          {formatOpsPrimaryLabel(health.primary)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {new Date(r.createdAt).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    暂无餐厅
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
              href={`/ops?page=${page - 1}${listQuerySuffix ? `&${listQuerySuffix}` : ''}`}
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
              href={`/ops?page=${page + 1}${listQuerySuffix ? `&${listQuerySuffix}` : ''}`}
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
