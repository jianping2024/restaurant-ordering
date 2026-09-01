'use client';

import { useCallback, useEffect, useState } from 'react';

type FiscalPolicy = {
  fiscal_profile: 'restaurant' | 'retail' | null;
  max_fiscal_terminals: number;
  terminals_used: number;
};

type Terminal = {
  id: string;
  ops_terminal_ref: string;
  label: string | null;
  active: boolean;
};

type Props = {
  restaurantId: string;
  readOnly?: boolean;
  signingStatus?: 'none' | 'registered' | 'active' | 'revoked';
};

const fieldClass =
  'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70';

export function RestaurantFiscalPolicyPanel({
  restaurantId,
  readOnly = false,
  signingStatus = 'none',
}: Props) {
  const [policy, setPolicy] = useState<FiscalPolicy | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [profileDraft, setProfileDraft] = useState<'restaurant' | 'retail' | ''>('');
  const [maxDraft, setMaxDraft] = useState('1');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [pRes, tRes] = await Promise.all([
      fetch(`/api/ops/restaurants/${restaurantId}/fiscal-policy`, { credentials: 'include' }),
      fetch(`/api/ops/restaurants/${restaurantId}/fiscal-terminals`, { credentials: 'include' }),
    ]);
    const pJson = (await pRes.json().catch(() => ({}))) as FiscalPolicy & { error?: string };
    const tJson = (await tRes.json().catch(() => ({}))) as { terminals?: Terminal[]; error?: string };
    if (!pRes.ok) {
      setError(pJson.error || '加载策略失败');
      return;
    }
    setPolicy(pJson);
    setProfileDraft(pJson.fiscal_profile ?? '');
    setMaxDraft(String(pJson.max_fiscal_terminals ?? 1));
    if (tRes.ok) {
      setTerminals(tJson.terminals ?? []);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePolicy = async () => {
    if (readOnly || busy) return;
    if (!profileDraft) {
      setError('请先选择开票业态（餐馆 / 商超）');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-policy`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscal_profile: profileDraft,
          max_fiscal_terminals: Number(maxDraft),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as FiscalPolicy & { error?: string };
      if (!res.ok) {
        setError(json.error || '保存失败');
        return;
      }
      setPolicy(json);
      setProfileDraft(json.fiscal_profile ?? '');
      setMaxDraft(String(json.max_fiscal_terminals));
    } finally {
      setBusy(false);
    }
  };

  const createPairing = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    setError('');
    setPairingCode(null);
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-terminals/pairing`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok) {
        setError(
          json.error === 'fiscal_profile_missing'
            ? '请先保存开票业态后再生成终端配对码'
            : json.error === 'terminals_full'
              ? '已达终端上限，请吊销旧终端或提高上限'
              : json.error || '生成配对码失败',
        );
        return;
      }
      setPairingCode(json.code ?? null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revokeTerminal = async (terminalId: string) => {
    if (readOnly || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/fiscal-terminals`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal_id: terminalId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || '吊销失败');
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const profileOk = Boolean(policy?.fiscal_profile);
  const activateBlocked = signingStatus === 'registered' && !profileOk;

  return (
    <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">开票门店策略（Ops）</h2>
      <p className="mt-1 text-sm text-zinc-500">
        业态与终端上限由 Ops 配置；店内登录页不再选择业态。激活签名前必须保存业态。
      </p>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {activateBlocked ? (
        <p className="mt-3 text-sm text-amber-400">设备已注册，但尚未配置业态 — 下方保存后再点「激活」。</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          <span className="font-medium">开票业态</span>
          <select
            className={fieldClass}
            value={profileDraft}
            disabled={readOnly || busy}
            onChange={(e) => setProfileDraft(e.target.value as 'restaurant' | 'retail' | '')}
          >
            <option value="">未设置</option>
            <option value="restaurant">餐馆</option>
            <option value="retail">商超</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          <span className="font-medium">最大开票终端数</span>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={maxDraft}
            disabled={readOnly || busy}
            onChange={(e) => setMaxDraft(e.target.value)}
          />
        </label>
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="mt-4 rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={busy}
          onClick={() => void savePolicy()}
        >
          保存策略
        </button>
      ) : null}

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-medium text-zinc-200">LAN 开票终端</h3>
        <p className="mt-1 text-xs text-zinc-500">
          已用 {policy?.terminals_used ?? 0} / {policy?.max_fiscal_terminals ?? 1}（本机 127.0.0.1 不计入）
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          {terminals.length === 0 ? (
            <li className="text-zinc-500">暂无已注册终端</li>
          ) : (
            terminals.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>
                  {t.label || t.ops_terminal_ref.slice(0, 8)}
                  {!t.active ? '（已吊销）' : ''}
                </span>
                {!readOnly && t.active ? (
                  <button
                    type="button"
                    className="text-xs text-red-400 hover:text-red-300"
                    disabled={busy}
                    onClick={() => void revokeTerminal(t.id)}
                  >
                    吊销
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {!readOnly ? (
          <button
            type="button"
            className="mt-3 rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || !profileOk}
            onClick={() => void createPairing()}
          >
            生成终端配对码
          </button>
        ) : null}
        {pairingCode ? (
          <p className="mt-2 font-mono text-lg tracking-widest text-emerald-400">{pairingCode}</p>
        ) : null}
      </div>
    </section>
  );
}
