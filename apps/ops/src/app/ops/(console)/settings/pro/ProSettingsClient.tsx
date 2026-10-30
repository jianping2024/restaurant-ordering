'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  PREMIUM_KEYS,
  quoteRestaurantSubscriptionEur,
  quoteSubscriptionBaseEur,
  type PremiumKey,
  type ProFeatureProduct,
  type SubscriptionBaseProduct,
} from '@mesa/shared';

const PREMIUM_LABELS: Record<PremiumKey, string> = {
  value_analytics: '增值分析',
  abnormal_ops: '异常操作',
  operation_logs: '操作记录',
  menu_dish_video: '菜品动图',
};

type FeatureDraft = Record<PremiumKey, { priceMonthEur: string; priceYearEur: string; active: boolean }>;

function toFeatureDraft(products: ProFeatureProduct[]): FeatureDraft {
  const draft = {} as FeatureDraft;
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
  initial: { base: SubscriptionBaseProduct; products: ProFeatureProduct[] };
};

export function ProSettingsClient({ initial }: Props) {
  const [baseMonth, setBaseMonth] = useState(String(initial.base.priceMonthEur));
  const [baseYear, setBaseYear] = useState(String(initial.base.priceYearEur));
  const [draft, setDraft] = useState<FeatureDraft>(() => toFeatureDraft(initial.products));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const previewProducts = useMemo((): ProFeatureProduct[] => {
    return PREMIUM_KEYS.map((key) => ({
      featureKey: key,
      priceMonthEur: Number(draft[key].priceMonthEur) || 0,
      priceYearEur: Number(draft[key].priceYearEur) || 0,
      active: draft[key].active,
    }));
  }, [draft]);

  const previewBase: SubscriptionBaseProduct = {
    priceMonthEur: Number(baseMonth) || 0,
    priceYearEur: Number(baseYear) || 0,
  };

  const allKeys = [...PREMIUM_KEYS];
  const previewMonthTotal = quoteRestaurantSubscriptionEur(
    previewBase,
    allKeys.filter((k) => draft[k].active),
    previewProducts,
    'month',
  );
  const previewYearTotal = quoteRestaurantSubscriptionEur(
    previewBase,
    allKeys.filter((k) => draft[k].active),
    previewProducts,
    'year',
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const month = Number(baseMonth);
      const year = Number(baseYear);
      if (!Number.isFinite(month) || month < 0 || !Number.isFinite(year) || year < 0) {
        throw new Error('invalid_price:base');
      }
      const base: SubscriptionBaseProduct = {
        priceMonthEur: Math.round(month * 100) / 100,
        priceYearEur: Math.round(year * 100) / 100,
      };

      const products: ProFeatureProduct[] = PREMIUM_KEYS.map((key) => {
        const m = Number(draft[key].priceMonthEur);
        const y = Number(draft[key].priceYearEur);
        if (!Number.isFinite(m) || m < 0 || !Number.isFinite(y) || y < 0) {
          throw new Error(`invalid_price:${key}`);
        }
        return {
          featureKey: key,
          priceMonthEur: Math.round(m * 100) / 100,
          priceYearEur: Math.round(y * 100) / 100,
          active: draft[key].active,
        };
      });

      const res = await fetch('/api/ops/settings/pro', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base, products }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      setSuccess('已保存定价');
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith('invalid_price:')
          ? '价格须为 ≥0 的数字'
          : '保存失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm text-zinc-400">基础版定价（欧元）</legend>
        <p className="text-xs text-zinc-500">
          每家店报价都含这一档。Pro 功能费叠在基础之上。
        </p>
        <div className="grid gap-3 rounded border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-500">
            月价 €
            <input
              type="number"
              min={0}
              step="0.01"
              value={baseMonth}
              onChange={(e) => setBaseMonth(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            年价 €
            <input
              type="number"
              min={0}
              step="0.01"
              value={baseYear}
              onChange={(e) => setBaseYear(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm text-zinc-400">Pro 功能定价（欧元）</legend>
        <p className="text-xs text-zinc-500">
          加购价目。每家店在餐厅详情勾选开通项后计入报价。店能不能用还要看本店是否有效 Pro。
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
        示意合计（基础 + 在售 Pro 全开）：基础月 €
        {quoteSubscriptionBaseEur(previewBase, 'month').toFixed(2)}
        ｜合计月 €
        {previewMonthTotal.toFixed(2)}
        ｜合计年 €
        {previewYearTotal.toFixed(2)}
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
