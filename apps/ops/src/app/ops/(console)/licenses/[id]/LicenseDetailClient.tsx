'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LICENSE_OFFLINE_GRACE_DAYS_DEFAULT,
  lisbonCalendarDateInputValue,
  todayLisbonCalendarDate,
  type LicenseExtendPeriod,
} from '@mesa/shared';
import { OpsCalendarValidUntilEditor } from '@/components/OpsCalendarValidUntilEditor';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  BUSINESS_STATUS_LABEL,
  installationStatusLabel,
  resolveInstallPhase,
  resolveOpsLicenseHealth,
  suspensionReasonLabel,
} from '@/lib/ops-license-status';

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
  licenseLeaseUntil: string | null;
  offlineGraceDays: number;
};

export function LicenseDetailClient({ restaurantId }: { restaurantId: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  /** Active only: pending | claimed. Revoked lives in installationHistory. */
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationHistory, setInstallationHistory] = useState<Installation[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  /** Sole plaintext code surface — list never shows codes. */
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Installation | null>(null);
  const [licenseDate, setLicenseDate] = useState('');
  const [graceDaysInput, setGraceDaysInput] = useState(String(LICENSE_OFFLINE_GRACE_DAYS_DEFAULT));
  const minLicenseDate = todayLisbonCalendarDate();
  /** True after first GET finishes — later loads stay silent (no full-page loading). */
  const initialLoadDoneRef = useRef(false);

  const applyLicensePayload = useCallback(
    (json: {
      restaurant?: Restaurant;
      installations?: Installation[];
      installationHistory?: Installation[];
    }) => {
      if (json.restaurant) {
        setRestaurant(json.restaurant);
        setReason(json.restaurant.suspensionReason || '');
        setLicenseDate(lisbonCalendarDateInputValue(json.restaurant.licenseValidUntil));
        setGraceDaysInput(
          String(json.restaurant.offlineGraceDays ?? LICENSE_OFFLINE_GRACE_DAYS_DEFAULT),
        );
      }
      setInstallations(json.installations || []);
      if (json.installationHistory !== undefined) {
        setInstallationHistory(json.installationHistory);
      }
    },
    [],
  );

  /**
   * `loading` only for first paint.
   * Mutations always refresh silently so the page does not unmount.
   */
  const load = useCallback(
    async (opts?: { includeHistory?: boolean }) => {
      const includeHistory = opts?.includeHistory ?? false;
      const isInitial = !initialLoadDoneRef.current;
      if (isInitial) setLoading(true);
      setError('');
      try {
        const qs = includeHistory ? '?history=1' : '';
        const res = await fetch(`/api/ops/licenses/${restaurantId}${qs}`, {
          credentials: 'include',
        });
        const json = (await res.json()) as {
          restaurant?: Restaurant;
          installations?: Installation[];
          installationHistory?: Installation[];
          error?: string;
        };
        if (!res.ok) {
          setError(json.error || '加载失败');
          return;
        }
        applyLicensePayload(json);
      } catch {
        setError('网络错误');
      } finally {
        initialLoadDoneRef.current = true;
        if (isInitial) setLoading(false);
      }
    },
    [restaurantId, applyLicensePayload],
  );

  useEffect(() => {
    initialLoadDoneRef.current = false;
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load({ includeHistory: historyOpen });
  }, [load, historyOpen]);

  const openHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (installationHistory === null) {
      setBusy(true);
      try {
        await load({ includeHistory: true });
      } finally {
        setBusy(false);
      }
    }
  };

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

  const onPrem = restaurant.deploymentMode === 'on_prem';
  const claimed = installations.find((i) => i.status === 'claimed') ?? null;
  const pending = installations.find((i) => i.status === 'pending') ?? null;
  const installPhase = resolveInstallPhase({
    claimed: Boolean(claimed),
    pending: Boolean(pending),
  });
  const health = resolveOpsLicenseHealth({
    deploymentMode: restaurant.deploymentMode,
    suspendedAt: restaurant.suspendedAt,
    suspensionReason: restaurant.suspensionReason,
    licenseValidUntil: restaurant.licenseValidUntil,
    licenseCheckedAt: restaurant.licenseCheckedAt,
    lastCheckinAt: claimed?.last_checkin_at ?? null,
    installPhase,
    offlineGraceDays: restaurant.offlineGraceDays,
  });
  const canResume =
    health.primary.kind === 'suspended' && health.primary.canResume;

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
        <p
          className={`mt-2 text-sm ${
            health.primary.kind === 'suspended'
              ? 'text-amber-400'
              : health.primary.kind === 'install'
                ? 'text-sky-400'
                : 'text-emerald-500'
          }`}
        >
          {health.primary.label}
          {health.primary.kind === 'suspended' && health.primary.observationOnly
            ? '（观察：店端下次对账将落库）'
            : ''}
        </p>
        {health.lastOnline ? (
          <p className="mt-1 text-sm text-zinc-500">{health.lastOnline.line}</p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-0">
        <OpsCalendarValidUntilEditor
          title="授权期限"
          description={`截止日按里斯本日历日；当天 23:59:59（Europe/Lisbon）过期。${
            restaurant.licenseValidUntil ? '' : ' 当前：不限期'
          }`}
          dateLabel="授权截止日"
          dateValue={licenseDate}
          minDate={minLicenseDate}
          busy={busy}
          footerNote="续期/更新只改截止日，不会自动恢复已暂停的门店。"
          onDateChange={setLicenseDate}
          onUpdate={async () => {
            const json = await call(`/api/ops/licenses/${restaurantId}/valid-until`, {
              date: licenseDate,
            });
            if (json) void refresh();
          }}
          onExtend={async (period: LicenseExtendPeriod) => {
            const json = await call(`/api/ops/licenses/${restaurantId}/extend`, { period });
            if (json) void refresh();
          }}
        />

        {onPrem ? (
          <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <label className="block text-sm text-zinc-400">
              离线宽限（天）
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                value={graceDaysInput}
                onChange={(e) => setGraceDaysInput(e.target.value)}
                className="mt-1 block w-28 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const days = Number(graceDaysInput);
                const json = await call(`/api/ops/licenses/${restaurantId}/grace-days`, { days });
                if (json) void refresh();
              }}
              className="mt-3 rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              保存宽限
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              默认 {LICENSE_OFFLINE_GRACE_DAYS_DEFAULT} 天。修改后在下次认领 / check-in
              签新 lease 时生效
              {restaurant.licenseLeaseUntil
                ? `；当前 lease 到期 ${new Date(restaurant.licenseLeaseUntil).toLocaleString('zh-CN')}`
                : ''}
              。
            </p>
          </section>
        ) : null}
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">营业状态</h2>
        <p className="mt-1 text-sm text-zinc-500">
          暂停后顾客无法点餐，员工无法登录；店主仍可登录后台查看数据。
        </p>
        {canResume ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-400">{BUSINESS_STATUS_LABEL.suspended}</p>
            {restaurant.suspensionReason ? (
              <p className="text-sm text-zinc-400">
                原因：
                <span className="text-zinc-200">
                  {suspensionReasonLabel(restaurant.suspensionReason)}
                </span>
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
            {health.primary.kind === 'suspended' && health.primary.observationOnly ? (
              <p className="text-sm text-amber-300">
                {health.primary.label}（观察态，平台尚未写入暂停；不可点恢复）
              </p>
            ) : (
              <p className="text-sm text-emerald-500">{BUSINESS_STATUS_LABEL.open}</p>
            )}
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
            店主邮箱（本机 /setup 认领账号）：{restaurant.ownerEmail || '—'}
            。店内打开 http://127.0.0.1:3000/setup 填安装码。
          </p>

          <div className="mt-4 rounded border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm">
            {!claimed && !pending ? (
              <p className="text-zinc-400">当前状态：{installationStatusLabel('none')}</p>
            ) : null}
            {claimed ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-zinc-200">{installationStatusLabel('claimed')}</span>
                  {health.lastOnline ? (
                    <span className="ml-2 text-zinc-500">{health.lastOnline.line}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRevokeTarget(claimed)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-60"
                >
                  吊销认领
                </button>
              </div>
            ) : null}
            {pending ? (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 ${claimed ? 'mt-3 border-t border-zinc-800 pt-3' : ''}`}
              >
                <div>
                  <span className="text-zinc-200">{installationStatusLabel('pending')}</span>
                  <span className="ml-2 text-zinc-500">
                    过期 {new Date(pending.expires_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRevokeTarget(pending)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-60"
                >
                  吊销
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const json = await call(`/api/ops/licenses/${restaurantId}/installations`);
              if (json?.code) {
                setIssuedCode(json.code);
                setCopied(false);
                // New issue auto-revokes prior pending — invalidate cached history so reopen refetches.
                setInstallationHistory(null);
                void refresh();
              }
            }}
            className="mt-4 rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            签发安装码
          </button>
          <p className="mt-2 text-xs text-zinc-500">
            签发会作废未用的待认领码；已认领时新码用于换机/重装。
          </p>

          {issuedCode ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <p className="font-mono text-sm text-amber-200">
                安装码（只显示一次）：{issuedCode}
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issuedCode);
                    setCopied(true);
                  } catch {
                    setError('复制失败，请手动选中安装码');
                  }
                }}
                className="rounded border border-amber-500/40 px-2 py-0.5 text-xs text-amber-200 hover:bg-amber-500/20"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void openHistory()}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-60"
          >
            {historyOpen ? '收起历史' : '查看历史（已吊销）'}
          </button>
          {historyOpen ? (
            <ul className="mt-2 divide-y divide-zinc-800 text-sm">
              {installationHistory === null ? (
                <li className="py-2 text-zinc-500">加载历史…</li>
              ) : installationHistory.length === 0 ? (
                <li className="py-2 text-zinc-500">无已吊销记录</li>
              ) : (
                installationHistory.map((inst) => (
                  <li key={inst.id} className="py-2 text-zinc-500">
                    <span className="text-zinc-400">{installationStatusLabel(inst.status)}</span>
                    {inst.revoked_at ? (
                      <span className="ml-2">
                        {new Date(inst.revoked_at).toLocaleString('zh-CN')}
                      </span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
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
              void refresh();
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
              void refresh();
            }
          })();
        }}
      />
      <ConfirmModal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title={revokeTarget?.status === 'claimed' ? '确认吊销认领' : '确认吊销安装码'}
        message={
          revokeTarget?.status === 'claimed'
            ? '吊销后本机认领失效，店内需用新安装码重装或换机。确定继续？'
            : '吊销后该待认领码立即失效。确定继续？'
        }
        confirmLabel="吊销"
        cancelLabel="取消"
        variant="danger"
        confirming={busy}
        onConfirm={() => {
          void (async () => {
            if (!revokeTarget) return;
            const json = await call(
              `/api/ops/licenses/${restaurantId}/installations/${revokeTarget.id}/revoke`,
            );
            if (json) {
              setRevokeTarget(null);
              setInstallationHistory(null);
              void refresh();
            }
          })();
        }}
      />
    </div>
  );
}
