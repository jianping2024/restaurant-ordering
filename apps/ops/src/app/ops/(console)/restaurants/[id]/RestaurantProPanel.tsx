'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  isProMembershipUnexpired,
  lisbonCalendarDateInputValue,
  todayLisbonCalendarDate,
  PREMIUM_KEYS,
  PREMIUM_KEY_REQUIRES_PARENT,
  quoteProFeaturesEur,
  quoteRestaurantSubscriptionEur,
  quoteSubscriptionBaseEur,
  sanitizePremiumKeyGrants,
  type LicenseExtendPeriod,
  type PremiumKey,
  type ProFeatureProduct,
  type RestaurantPlan,
  type SubscriptionBaseProduct,
} from '@mesa/shared';
import { OpsCalendarValidUntilEditor } from '@/components/OpsCalendarValidUntilEditor';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const PREMIUM_LABELS: Record<PremiumKey, string> = {
  value_analytics: '增值分析',
  abnormal_ops: '异常操作',
  operation_logs: '操作记录',
  menu_dish_video: '菜品动图',
  menu_dish_list_video: '点餐列表动图',
};

type Props = {
  restaurantId: string;
  readOnly?: boolean;
  initial: {
    plan: string;
    proValidUntil: string | null;
    featureKeys: PremiumKey[];
    products: ProFeatureProduct[];
    base: SubscriptionBaseProduct;
  };
};

export function RestaurantProPanel({ restaurantId, initial, readOnly = false }: Props) {
  const [plan, setPlan] = useState<RestaurantPlan>(initial.plan === 'pro' ? 'pro' : 'basic');
  const [committedPlan, setCommittedPlan] = useState<RestaurantPlan>(
    initial.plan === 'pro' ? 'pro' : 'basic',
  );
  const [proValidUntil, setProValidUntil] = useState(initial.proValidUntil);
  const [proDate, setProDate] = useState(lisbonCalendarDateInputValue(initial.proValidUntil));
  const [featureKeys, setFeatureKeys] = useState<Set<PremiumKey>>(
    () => new Set(sanitizePremiumKeyGrants(initial.featureKeys)),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const minProDate = todayLisbonCalendarDate();
  const showProConfig = plan === 'pro';

  const catalogByKey = useMemo(() => {
    const map = new Map<PremiumKey, ProFeatureProduct>();
    for (const p of initial.products) map.set(p.featureKey, p);
    return map;
  }, [initial.products]);
  const entitledList = Array.from(featureKeys);
  const baseMonth = quoteSubscriptionBaseEur(initial.base, 'month');
  const baseYear = quoteSubscriptionBaseEur(initial.base, 'year');
  const proMonth = quoteProFeaturesEur(entitledList, initial.products, 'month');
  const proYear = quoteProFeaturesEur(entitledList, initial.products, 'year');
  const monthQuote = quoteRestaurantSubscriptionEur(
    initial.base,
    entitledList,
    initial.products,
    'month',
  );
  const yearQuote = quoteRestaurantSubscriptionEur(
    initial.base,
    entitledList,
    initial.products,
    'year',
  );

  const needsDowngradeConfirm =
    plan === 'basic' &&
    isProMembershipUnexpired({ plan: committedPlan, proValidUntil });

  const downgradeMessage = (() => {
    const untilHint = proValidUntil
      ? `到期日（里斯本）：${lisbonCalendarDateInputValue(proValidUntil)}`
      : '当前无到期日（长期 Pro）';
    return [
      `这家店 Pro 还没到期（${untilHint}）。`,
      '改成 basic 后，店里会立刻用不了增值分析、异常操作等 Pro 功能。',
      '以前勾过的功能包会留着，以后改回 pro 还能用。',
      '确定要改成 basic 吗？',
    ].join('\n');
  })();

  const applyProValidUntil = (iso: string) => {
    setProValidUntil(iso);
    setProDate(lisbonCalendarDateInputValue(iso));
    setPlan('pro');
    setCommittedPlan('pro');
  };

  const toggleKey = (key: PremiumKey) => {
    setFeatureKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return new Set(sanitizePremiumKeyGrants(Array.from(next)));
    });
  };

  const persistSubscription = async (confirmDowngradeFromActivePro: boolean) => {
    if (readOnly) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const body: Record<string, unknown> = { plan };
      if (plan === 'pro') {
        body.featureKeys = Array.from(featureKeys);
      }
      if (confirmDowngradeFromActivePro) {
        body.confirmDowngradeFromActivePro = true;
      }
      const res = await fetch(`/api/ops/restaurants/${restaurantId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        featureKeys?: PremiumKey[];
      };
      if (!res.ok) {
        if (json.error === 'confirm_downgrade_from_active_pro_required') {
          setDowngradeOpen(true);
          return;
        }
        setError(json.message || json.error || '保存失败');
        return;
      }
      setCommittedPlan(plan);
      if (Array.isArray(json.featureKeys)) {
        setFeatureKeys(new Set(sanitizePremiumKeyGrants(json.featureKeys)));
      }
      setDowngradeOpen(false);
      setSuccess('已保存');
    } finally {
      setLoading(false);
    }
  };

  const saveSubscription = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (needsDowngradeConfirm) {
      setDowngradeOpen(true);
      return;
    }
    await persistSubscription(false);
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
        <h2 className="text-lg font-medium">本店套餐</h2>
        <p className="mt-1 text-sm text-zinc-500">
          basic 与 pro 互斥：选 basic 只保留基础版；选 pro 再勾功能包并设到期。店报价 = 基础版 + 已勾
          Pro 功能。有效 Pro 仍受 license_valid_until 约束。
        </p>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}

        <form onSubmit={saveSubscription} className="mt-4 space-y-4">
          <label className="block text-sm text-zinc-400">
            套餐
            <select
              disabled={readOnly || loading}
              value={plan}
              onChange={(e) => setPlan(e.target.value === 'pro' ? 'pro' : 'basic')}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="basic">basic</option>
              <option value="pro">pro</option>
            </select>
          </label>

          {showProConfig ? (
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-medium text-zinc-200">本店 Pro 功能包</h3>
              <p className="text-xs text-zinc-500">
                只有有效 Pro 且勾选的项，店内才能用。点餐列表动图须先勾「菜品动图」。
              </p>
              {PREMIUM_KEYS.map((key) => {
                const product = catalogByKey.get(key);
                const month = product?.priceMonthEur ?? 0;
                const year = product?.priceYearEur ?? 0;
                const inactive = product != null && !product.active;
                const parentKey = PREMIUM_KEY_REQUIRES_PARENT[key];
                const parentMissing = parentKey != null && !featureKeys.has(parentKey);
                return (
                  <label key={key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={readOnly || loading || inactive || parentMissing}
                      checked={featureKeys.has(key)}
                      onChange={() => toggleKey(key)}
                    />
                    <span>
                      <span className="font-medium">{PREMIUM_LABELS[key]}</span>
                      <span className="ml-2 font-mono text-xs text-zinc-600">{key}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        月 €{month.toFixed(2)} · 年 €{year.toFixed(2)}
                        {inactive ? ' · 价目已停售' : ''}
                        {parentMissing ? ' · 须先勾菜品动图' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}

              <div className="space-y-1 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300">
                <div>
                  基础版：月 <span className="font-mono">€{baseMonth.toFixed(2)}</span>
                  {' · '}
                  年 <span className="font-mono">€{baseYear.toFixed(2)}</span>
                </div>
                <div>
                  Pro 功能：月 <span className="font-mono">€{proMonth.toFixed(2)}</span>
                  {' · '}
                  年 <span className="font-mono">€{proYear.toFixed(2)}</span>
                </div>
                <div>
                  报价合计：月{' '}
                  <span className="font-mono text-amber-400">€{monthQuote.toFixed(2)}</span>
                  {' · '}
                  年 <span className="font-mono text-amber-400">€{yearQuote.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {!readOnly ? (
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
            >
              {loading ? '保存中…' : '保存'}
            </button>
          ) : null}
        </form>
      </section>

      {showProConfig ? (
        <OpsCalendarValidUntilEditor
          title="Pro 期限"
          description={`截止日按里斯本日历日；当天 23:59:59（Europe/Lisbon）过期。${unlimitedHint}`}
          dateLabel="Pro 截止日"
          dateValue={proDate}
          minDate={minProDate}
          busy={loading}
          disabled={readOnly}
          onDateChange={setProDate}
          onUpdate={() =>
            callPro(`/api/ops/restaurants/${restaurantId}/pro-valid-until`, { date: proDate })
          }
          onExtend={(period: LicenseExtendPeriod) =>
            callPro(`/api/ops/restaurants/${restaurantId}/pro-extend`, { period })
          }
        />
      ) : null}

      <ConfirmModal
        open={downgradeOpen}
        onClose={() => {
          if (!loading) setDowngradeOpen(false);
        }}
        title="确认改成 basic"
        message={downgradeMessage}
        confirmLabel="确认改成 basic"
        cancelLabel="取消"
        variant="danger"
        confirming={loading}
        onConfirm={() => void persistSubscription(true)}
      />
    </div>
  );
}
