'use client';

import { FormEvent, useMemo, useState } from 'react';
import { PREMIUM_KEYS, type PremiumKey, type ProFeatureProduct } from '@mesa/shared';

const PREMIUM_LABELS: Record<PremiumKey, string> = {
  value_analytics: '增值分析',
  abnormal_ops: '异常操作',
  operation_logs: '操作记录',
  menu_dish_video: '菜品动图',
};

type Draft = Record<PremiumKey, { priceMonthEur: string; priceYearEur: string; active: boolean }>;

function toDraft(products: ProFeatureProduct[]): Draft {
  const draft = {} as Draft;
  for (const key of PREMIUM_KEYS) {
    const hit = products.find((p) => p.featureKey === key);
    draft[key] = {
      priceMonthEur: String(hit?.priceMonthEur ?? 0),
      priceYearEur: String(hit?.priceYearEur ?? 0),
      active: hit?.active ?? true,
    };
  }
  return draft;
}

type Props = {
  initial: { products: ProFeatureProduct[] };
};

export function ProSettingsClient({ initial }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial.products));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const preview = useMemo(() => {
    return PREMIUM_KEYS.map((key) => ({
      key,
      month: Number(draft[key].priceMonthEur) || 0,
      year: Number(draft[key].priceYearEur) || 0,
    }));
  }, [draft]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const products: ProFeatureProduct[] = PREMIUM_KEYS.map((key) => {
        const month = Number(draft[key].priceMonthEur);
        const year = Number(draft[key].priceYearEur);
        if (!Number.isFinite(month) || month < 0 || !Number.isFinite(year) || year < 0) {
          throw new Error(`invalid_price:${key}`);
        }
        return {
          featureKey: key,
          priceMonthEur: Math.round(month * 100) / 100,
          priceYearEur: Math.round(year * 100) / 100,
          active: draft[key].active,
        };
      });

      const res = await fetch('/api/ops/settings/pro', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      setSuccess('已保存定价');
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('invalid_price:') ? '价格须为 ≥0 的数字' : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm text-zinc-400">Pro 功能定价（欧元）</legend>
        <p className="text-xs text-zinc-500">
          全局价目表。每家店在餐厅详情勾选开通项后，按这里的月价/年价合计报价。店能不能用还要看本店是否有效 Pro。
        </p>
        {PREMIUM_KEYS.map((key) => (
          <div
            key={key}
            className="grid gap-3 rounded border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
          >
            <div>
              <div className="text-sm">{PREMIUM_LABELS[key]}</div>
              <div className="font-mono text-xs text-zinc-600">{key}</div>
            </div>
            <label className="block text-xs text-zinc-500">
              月价 €
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft[key].priceMonthEur}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], priceMonthEur: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              年价 €
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft[key].priceYearEur}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], priceYearEur: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <input
                type="checkbox"
                checked={draft[key].active}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], active: e.target.checked },
                  }))
                }
              />
              在售
            </label>
          </div>
        ))}
      </fieldset>

      <div className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
        示意合计（全开）：月 €
        {preview.reduce((s, p) => s + (draft[p.key].active ? p.month : 0), 0).toFixed(2)}
        ｜年 €
        {preview.reduce((s, p) => s + (draft[p.key].active ? p.year : 0), 0).toFixed(2)}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? '保存中…' : '保存定价'}
      </button>
    </form>
  );
}
