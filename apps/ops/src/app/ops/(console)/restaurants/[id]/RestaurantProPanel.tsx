'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  lisbonCalendarDateInputValue,
  todayLisbonCalendarDate,
  PREMIUM_KEYS,
  quoteProFeaturesEur,
  type LicenseExtendPeriod,
  type PremiumKey,
  type ProFeatureProduct,
} from '@mesa/shared';
import { OpsCalendarValidUntilEditor } from '@/components/OpsCalendarValidUntilEditor';

const PREMIUM_LABELS: Record<PremiumKey, string> = {
  value_analytics: '增值分析',
  abnormal_ops: '异常操作',
  operation_logs: '操作记录',
  menu_dish_video: '菜品动图',
};

type Props = {
  restaurantId: string;
  readOnly?: boolean;
  initial: {
    plan: string;
    proValidUntil: string | null;
    featureKeys: PremiumKey[];
    products: ProFeatureProduct[];
  };
};

export function RestaurantProPanel({ restaurantId, initial, readOnly = false }: Props) {
  const [plan, setPlan] = useState(initial.plan === 'pro' ? 'pro' : 'basic');
  const [proValidUntil, setProValidUntil] = useState(initial.proValidUntil);
  const [proDate, setProDate] = useState(lisbonCalendarDateInputValue(initial.proValidUntil));
  const [featureKeys, setFeatureKeys] = useState<Set<PremiumKey>>(new Set(initial.featureKeys));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const minProDate = todayLisbonCalendarDate();

  const catalogByKey = useMemo(() => {
    const map = new Map<PremiumKey, ProFeatureProduct>();
    for (const p of initial.products) map.set(p.featureKey, p);
    return map;
  }, [initial.products]);
  const entitledList = Array.from(featureKeys);
  const monthQuote = quoteProFeaturesEur(entitledList, initial.products, 'month');
  const yearQuote = quoteProFeaturesEur(entitledList, initial.products, 'year');

  const applyProValidUntil = (iso: string) => {
    setProValidUntil(iso);
    setProDate(lisbonCalendarDateInputValue(iso));
    setPlan('pro');
  };

  const toggleKey = (key: PremiumKey) => {
    setFeatureKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const saveGrants = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/pro-grants`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKeys: Array.from(featureKeys) }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      setSuccess('本店 Pro 功能包已更新');
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
          有效 Pro 仍受 license_valid_until 约束；到期设定与授权同一里斯本日历日。本店功能包与全局定价分开：勾选开通项 → 按价目合计报价。
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

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">本店 Pro 功能包</h2>
        <p className="mt-1 text-sm text-zinc-500">
          只有有效 Pro 且勾选的项，店内才能用。未勾选的入口会锁定。点餐列表动图等店内附加开关仍在店「功能管理」。
        </p>

        <form onSubmit={saveGrants} className="mt-4 space-y-3">
          {PREMIUM_KEYS.map((key) => {
            const product = catalogByKey.get(key);
            const month = product?.priceMonthEur ?? 0;
            const year = product?.priceYearEur ?? 0;
            const inactive = product != null && !product.active;
            return (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={readOnly || loading || inactive}
                  checked={featureKeys.has(key)}
                  onChange={() => toggleKey(key)}
                />
                <span>
                  <span className="font-medium">{PREMIUM_LABELS[key]}</span>
                  <span className="ml-2 font-mono text-xs text-zinc-600">{key}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    月 €{month.toFixed(2)} · 年 €{year.toFixed(2)}
                    {inactive ? ' · 价目已停售' : ''}
                  </span>
                </span>
              </label>
            );
          })}

          <div className="rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300">
            报价合计：月 <span className="font-mono text-amber-400">€{monthQuote.toFixed(2)}</span>
            {' · '}
            年 <span className="font-mono text-amber-400">€{yearQuote.toFixed(2)}</span>
          </div>

          {!readOnly ? (
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
            >
              {loading ? '保存中…' : '保存功能包'}
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
