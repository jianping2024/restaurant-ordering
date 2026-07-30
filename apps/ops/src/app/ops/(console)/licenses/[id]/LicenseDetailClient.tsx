'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { lisbonCalendarDateFromInstant, todayLisbonCalendarDate } from '@mesa/shared';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Installation = {
  id: string;
  status: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  last_checkin_at: string | null;
  created_at: string;
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  deploymentMode: string;
  licenseValidUntil: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  ownerEmail: string | null;
  licenseCheckedAt: string | null;
};

const LICENSE_EXTEND_ACTIONS = [
  { period: '1d', label: '+1 天' },
  { period: '1m', label: '+1 月' },
  { period: '1y', label: '+1 年' },
] as const;

function licenseDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return lisbonCalendarDateFromInstant(new Date(ms));
}

export function LicenseDetailClient({ restaurantId }: { restaurantId: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [licenseDate, setLicenseDate] = useState('');
  const minLicenseDate = todayLisbonCalendarDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/licenses/${restaurantId}`, { credentials: 'include' });
      const json = (await res.json()) as {
        restaurant?: Restaurant;
        installations?: Installation[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || '加载失败');
        return;
      }
      setRestaurant(json.restaurant || null);
      setInstallations(json.installations || []);
      setReason(json.restaurant?.suspensionReason || '');
      setLicenseDate(licenseDateInputValue(json.restaurant?.licenseValidUntil));
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (path: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(json.error || '操作失败');
        return null;
      }
      return json;
    } catch {
      setError('网络错误');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="mt-6 text-sm text-zinc-500">加载中…</p>;
  if (!restaurant) return <p className="mt-6 text-sm text-red-400">{error || '未找到'}</p>;

  const suspended = Boolean(restaurant.suspendedAt);
  const onPrem = restaurant.deploymentMode === 'on_prem';

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ops/licenses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← 返回授权列表
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{restaurant.name}</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">
          {restaurant.slug} · {onPrem ? '本地安装' : '云'} ·{' '}
          <Link href={`/ops/restaurants/${restaurant.id}`} className="text-amber-400 hover:underline">
            餐厅详情
          </Link>
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">授权期限</h2>
        <p className="mt-2 text-sm text-zinc-400">
          截止日按里斯本日历日；当天 23:59:59（Europe/Lisbon）过期。
          {restaurant.licenseValidUntil ? null : ' 当前：不限期'}
        </p>
        {onPrem && restaurant.licenseCheckedAt ? (
          <p className="mt-1 text-sm text-zinc-500">
            平台侧最近 check-in 时钟：{new Date(restaurant.licenseCheckedAt).toLocaleString('zh-CN')}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm text-zinc-400">
            授权截止日
            <input
              type="date"
              value={licenseDate}
              min={minLicenseDate}
              onChange={(e) => setLicenseDate(e.target.value)}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            disabled={busy || !licenseDate}
            onClick={async () => {
              const json = await call(`/api/ops/licenses/${restaurantId}/valid-until`, {
                date: licenseDate,
              });
              if (json) void load();
            }}
            className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
          >
            更新
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {LICENSE_EXTEND_ACTIONS.map((action) => (
            <button
              key={action.period}
              type="button"
              disabled={busy}
              onClick={async () => {
                const json = await call(`/api/ops/licenses/${restaurantId}/extend`, {
                  period: action.period,
                });
                if (json) void load();
              }}
              className="rounded border border-amber-500/40 bg-zinc-950 px-3 py-2 text-sm font-medium text-amber-400 disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">续期/更新只改截止日，不会自动恢复已暂停的门店。</p>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">营业状态</h2>
        <p className="mt-1 text-sm text-zinc-500">
          暂停后顾客无法点餐，员工无法登录；店主仍可登录后台查看数据。
        </p>
        {suspended ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-400">当前已暂停营业</p>
            {restaurant.suspensionReason ? (
              <p className="text-sm text-zinc-400">
                原因：<span className="text-zinc-200">{restaurant.suspensionReason}</span>
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmResume(true)}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              恢复营业
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="暂停原因（可选）"
              rows={2}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmSuspend(true)}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              暂停营业
            </button>
          </div>
        )}
      </section>

      {onPrem ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-medium">本地安装</h2>
          <p className="mt-1 text-sm text-zinc-500">
            店主邮箱（在本机 /setup 认领时创建本机账号）：{restaurant.ownerEmail || '—'}
            。安装码用于店内打开 http://127.0.0.1:3000/setup 。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const json = await call(`/api/ops/licenses/${restaurantId}/installations`);
              if (json?.code) {
                setIssuedCode(json.code);
                void load();
              }
            }}
            className="mt-4 rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            签发安装码
          </button>
          {issuedCode ? (
            <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-sm text-amber-200">
              安装码（只显示一次）：{issuedCode}
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-zinc-800 text-sm">
            {installations.map((inst) => (
              <li key={inst.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-mono text-xs text-zinc-500">{inst.id.slice(0, 8)}…</span>
                  <span className="ml-2 text-zinc-300">{inst.status}</span>
                  {inst.last_checkin_at ? (
                    <span className="ml-2 text-zinc-500">
                      check-in {new Date(inst.last_checkin_at).toLocaleString('zh-CN')}
                    </span>
                  ) : null}
                </div>
                {inst.status !== 'revoked' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const json = await call(
                        `/api/ops/licenses/${restaurantId}/installations/${inst.id}/revoke`,
                      );
                      if (json) void load();
                    }}
                    className="text-xs text-red-400 hover:underline disabled:opacity-60"
                  >
                    吊销
                  </button>
                ) : null}
              </li>
            ))}
            {installations.length === 0 ? (
              <li className="py-2 text-zinc-500">尚无安装记录</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <ConfirmModal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        title="确认暂停营业"
        message="暂停后该餐厅顾客端与员工登录将不可用，确定继续？"
        confirmLabel="暂停"
        cancelLabel="取消"
        variant="danger"
        confirming={busy}
        onConfirm={() => {
          void (async () => {
            const json = await call(`/api/ops/licenses/${restaurantId}/suspend`, {
              reason: reason.trim() || undefined,
            });
            if (json) {
              setConfirmSuspend(false);
              void load();
            }
          })();
        }}
      />
      <ConfirmModal
        open={confirmResume}
        onClose={() => setConfirmResume(false)}
        title="确认恢复营业"
        message="恢复后顾客与员工可正常使用，确定继续？"
        confirmLabel="恢复"
        cancelLabel="取消"
        confirming={busy}
        onConfirm={() => {
          void (async () => {
            const json = await call(`/api/ops/licenses/${restaurantId}/resume`);
            if (json) {
              setConfirmResume(false);
              void load();
            }
          })();
        }}
      />
    </div>
  );
}
