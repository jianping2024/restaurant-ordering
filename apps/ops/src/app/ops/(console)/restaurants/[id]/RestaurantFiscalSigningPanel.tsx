'use client';

import { useCallback, useEffect, useState } from 'react';

type FiscalStatus = {
  status: 'none' | 'registered' | 'active' | 'revoked';
  installationId: string | null;
  deviceId: string | null;
  signingKeyVersion: number | null;
  activatedAt: string | null;
  revokedAt: string | null;
  hasDevicePublicKey: boolean;
};

const statusLabel: Record<FiscalStatus['status'], string> = {
  none: '未注册设备',
  registered: '设备已上报，待激活',
  active: '已激活',
  revoked: '已吊销',
};

type Props = {
  restaurantId: string;
  readOnly?: boolean;
};

export function RestaurantFiscalSigningPanel({ restaurantId, readOnly = false }: Props) {
  const [status, setStatus] = useState<FiscalStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-signing`, {
      credentials: 'include',
    });
    const json = (await res.json().catch(() => ({}))) as FiscalStatus & { error?: string };
    if (!res.ok) {
      setError(json.error || '加载失败');
      return;
    }
    setStatus(json);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-signing/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (!res.ok) {
        setError(
          json.error === 'device_not_registered'
            ? '店内 Agent 尚未上报设备公钥，请先配对并打开开票页同步'
            : json.error === 'product_key_not_configured'
              ? '服务端未配置 FISCAL_PRODUCT_PRIVATE_KEY_PEM'
              : json.error === 'fiscal_profile_missing'
                ? '请先在上方「开票门店策略」保存业态后再激活'
                : json.detail || json.error || '激活失败',
        );
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-signing/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || '吊销失败');
        return;
      }
      setConfirmRevoke(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">开票签名钥</h2>
      <p className="mt-1 text-sm text-zinc-500">
        激活后店内 Agent 自动领取封装私钥；吊销后须换机或重新注册再激活（不可复活旧记录）。
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">状态</dt>
          <dd className="text-zinc-100">
            {status ? statusLabel[status.status] : '加载中…'}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">设备</dt>
          <dd className="break-all font-mono text-xs text-zinc-300">
            {status?.deviceId || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">钥版本</dt>
          <dd>{status?.signingKeyVersion ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">激活时间</dt>
          <dd>
            {status?.activatedAt
              ? new Date(status.activatedAt).toLocaleString('zh-CN')
              : '—'}
          </dd>
        </div>
      </dl>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={readOnly || busy || status?.status !== 'registered'}
          onClick={() => void activate()}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          激活开票
        </button>
        {!confirmRevoke ? (
          <button
            type="button"
            disabled={
              readOnly ||
              busy ||
              !status ||
              (status.status !== 'active' && status.status !== 'registered')
            }
            onClick={() => setConfirmRevoke(true)}
            className="rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            吊销
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={readOnly || busy}
              onClick={() => void revoke()}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              确认吊销
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRevoke(false)}
              className="rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-300"
            >
              取消
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
        >
          刷新
        </button>
      </div>
    </section>
  );
}
