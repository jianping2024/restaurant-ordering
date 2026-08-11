'use client';

import { FormEvent, useState } from 'react';
import {
  lisbonCalendarDateInputValue,
  todayLisbonCalendarDate,
  type LicenseExtendPeriod,
} from '@mesa/shared';
import { OpsCalendarValidUntilEditor } from '@/components/OpsCalendarValidUntilEditor';

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
  const [proDate, setProDate] = useState(lisbonCalendarDateInputValue(initial.proValidUntil));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const minProDate = todayLisbonCalendarDate();

  const applyProValidUntil = (iso: string) => {
    setProValidUntil(iso);
    setProDate(lisbonCalendarDateInputValue(iso));
    setPlan('pro');
  };

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

  const callPro = async (path: string, body: unknown) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        proValidUntil?: string;
      };
      if (!res.ok) {
        setError(json.message || json.error || '操作失败');
        return;
      }
      if (json.proValidUntil) applyProValidUntil(json.proValidUntil);
      setSuccess('Pro 到期已更新');
    } finally {
      setLoading(false);
    }
  };

  const unlimitedHint =
    !proValidUntil && plan === 'pro'
      ? ' 当前：无到期（plan=pro 且未设 pro_valid_until）'
      : !proValidUntil
        ? ' 当前：未设到期'
        : '';

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Pro 会员</h2>
        <p className="mt-1 text-sm text-zinc-500">
          有效 Pro 仍受 license_valid_until 约束；到期设定与授权同一里斯本日历日。
        </p>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">当前 plan</dt>
            <dd className="font-mono">{plan}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">pro_valid_until</dt>
            <dd className="font-mono text-xs">
              {proValidUntil ?? (plan === 'pro' ? 'null（无到期）' : '—')}
            </dd>
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
      </section>

      <OpsCalendarValidUntilEditor
        title="Pro 期限"
        description={`截止日按里斯本日历日；当天 23:59:59（Europe/Lisbon）过期。${unlimitedHint}`}
        dateLabel="Pro 截止日"
        dateValue={proDate}
        minDate={minProDate}
        busy={loading}
        disabled={readOnly}
        onDateChange={setProDate}
        onUpdate={() => callPro(`/api/ops/restaurants/${restaurantId}/pro-valid-until`, { date: proDate })}
        onExtend={(period: LicenseExtendPeriod) =>
          callPro(`/api/ops/restaurants/${restaurantId}/pro-extend`, { period })
        }
      />
    </div>
  );
}
