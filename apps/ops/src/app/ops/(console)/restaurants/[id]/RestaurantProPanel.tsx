'use client';

import { FormEvent, useState } from 'react';

type Props = {
  restaurantId: string;
  readOnly?: boolean;
  initial: {
    plan: string;
    proValidUntil: string | null;
  };
};

export function RestaurantProPanel({ restaurantId, initial, readOnly = false }: Props) {
  const [plan, setPlan] = useState(initial.plan === 'pro' ? 'pro' : 'basic');
  const [proValidUntil, setProValidUntil] = useState(initial.proValidUntil);
  const [extendDays, setExtendDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      setSuccess('套餐已更新');
    } finally {
      setLoading(false);
    }
  };

  const extendPro = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const days = Number.parseInt(extendDays, 10);
    if (!Number.isFinite(days) || days < 1) {
      setError('请输入有效天数');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendProDays: days }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        proValidUntil?: string;
      };
      if (!res.ok) {
        setError(json.message || json.error || '续期失败');
        return;
      }
      if (json.proValidUntil) setProValidUntil(json.proValidUntil);
      setPlan('pro');
      setSuccess(`已续期 ${days} 天`);
    } finally {
      setLoading(false);
    }
  };

  const expiryLabel = proValidUntil
    ? new Date(proValidUntil).toLocaleString('zh-CN')
    : plan === 'pro'
      ? '无到期（plan=pro 且未设 pro_valid_until）'
      : '—';

  return (
    <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">Pro 会员</h2>
      <p className="mt-1 text-sm text-zinc-500">
        续期从当前到期日叠加（未过期时）；同时仍受 license_valid_until 约束。
      </p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">当前 plan</dt>
          <dd className="font-mono">{plan}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">pro_valid_until</dt>
          <dd>{expiryLabel}</dd>
        </div>
      </dl>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}

      <form onSubmit={savePlan} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm text-zinc-400">
          套餐
          <select
            disabled={readOnly || loading}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            <option value="basic">basic</option>
            <option value="pro">pro</option>
          </select>
        </label>
        {!readOnly ? (
          <button
            type="submit"
            disabled={loading}
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-60"
          >
            保存套餐
          </button>
        ) : null}
      </form>

      {!readOnly ? (
        <form onSubmit={extendPro} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-800 pt-4">
          <label className="block text-sm text-zinc-400">
            续期天数
            <input
              type="number"
              min={1}
              step={1}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              className="mt-1 block w-28 rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
          >
            续期 Pro
          </button>
        </form>
      ) : null}
    </section>
  );
}
