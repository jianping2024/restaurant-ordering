'use client';

import { FormEvent, useState } from 'react';
import {
  RESTAURANT_COUNTRY_OPTIONS,
  RESTAURANT_FEATURE_DEFINITIONS,
  normalizeBuffetServiceMode,
  type BuffetServiceMode,
  type PrintLocale,
  type ResolvedRestaurantFeatureFlags,
  type RestaurantCountryCode,
} from '@mesa/shared';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Props = {
  restaurantId: string;
  readOnly?: boolean;
  initial: {
    name: string;
    slug: string;
    plan: string;
    address: string | null;
    phone: string | null;
    printLocale: PrintLocale;
    countryCode: RestaurantCountryCode;
    buffetServiceMode: BuffetServiceMode;
    featureFlags: ResolvedRestaurantFeatureFlags;
  };
};

const FEATURE_LABELS: Record<string, string> = {
  bill_receipt_print: '结账小票打印',
  kitchen_serve_to_table: '上桌流程',
};

const fieldClass =
  'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70';

export function RestaurantEditPanel({ restaurantId, initial, readOnly = false }: Props) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [plan, setPlan] = useState(initial.plan);
  const [address, setAddress] = useState(initial.address || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [printLocale, setPrintLocale] = useState<PrintLocale>(initial.printLocale);
  const [countryCode, setCountryCode] = useState<RestaurantCountryCode>(initial.countryCode);
  const [buffetServiceMode, setBuffetServiceMode] = useState<BuffetServiceMode>(
    normalizeBuffetServiceMode(initial.buffetServiceMode),
  );
  const [flags, setFlags] = useState(initial.featureFlags);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const save = async (confirmSlugChange = false) => {
    if (readOnly) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: pendingSlug ?? slug,
          plan,
          address: address.trim() || null,
          phone: phone.trim() || null,
          printLocale,
          countryCode,
          buffetServiceMode,
          featureFlags: flags,
          confirmSlugChange: confirmSlugChange || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.status === 409 && json.error === 'slug_change_requires_confirmation') {
        setPendingSlug(slug);
        setSlugConfirmOpen(true);
        return;
      }
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      if (pendingSlug) {
        setSlug(pendingSlug);
        setPendingSlug(null);
      }
      setSuccess('已保存');
    } finally {
      setLoading(false);
      setSlugConfirmOpen(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(false);
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">基本信息</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {readOnly ? 'support 账号只读；编辑请使用 admin。' : '仅 admin 可修改；操作写入审计日志'}
      </p>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          餐厅名称
          <input
            required
            disabled={readOnly}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          slug
          <input
            required
            disabled={readOnly}
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
            className={`${fieldClass} font-mono text-sm`}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          plan
          <select
            disabled={readOnly}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className={fieldClass}
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          地址
          <input
            disabled={readOnly}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          电话
          <input
            disabled={readOnly}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          print_locale
          <select
            disabled={readOnly}
            value={printLocale}
            onChange={(e) => setPrintLocale(e.target.value as PrintLocale)}
            className={fieldClass}
          >
            <option value="zh">zh</option>
            <option value="en">en</option>
            <option value="pt">pt</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          国家/地区
          <select
            disabled={readOnly}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value as RestaurantCountryCode)}
            className={fieldClass}
          >
            {RESTAURANT_COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="sm:col-span-2 space-y-2">
          <legend className="text-sm text-zinc-400">自助业态（仅 Ops 可改）</legend>
          <div className="flex flex-wrap gap-2">
            <label
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                readOnly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              } ${
                buffetServiceMode === 'classic'
                  ? 'border-amber-500/60 bg-amber-500/10 text-zinc-100'
                  : 'border-zinc-700 text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="buffetServiceMode"
                disabled={readOnly}
                checked={buffetServiceMode === 'classic'}
                onChange={() => setBuffetServiceMode('classic')}
              />
              经典自助
            </label>
            <label
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                readOnly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              } ${
                buffetServiceMode === 'sushi'
                  ? 'border-amber-500/60 bg-amber-500/10 text-zinc-100'
                  : 'border-zinc-700 text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="buffetServiceMode"
                disabled={readOnly}
                checked={buffetServiceMode === 'sushi'}
                onChange={() => setBuffetServiceMode('sushi')}
              />
              寿司自助
            </label>
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm text-zinc-400">功能开关（运营覆盖，优先于店主自助设置）</legend>
          <div className="mt-2 space-y-2">
            {RESTAURANT_FEATURE_DEFINITIONS.map((def) => (
              <label key={def.key} className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={flags[def.key]}
                  onChange={(e) => setFlags((prev) => ({ ...prev, [def.key]: e.target.checked }))}
                  className="rounded border-zinc-600 disabled:opacity-70"
                />
                {FEATURE_LABELS[def.key] || def.key}
              </label>
            ))}
          </div>
        </fieldset>

        {!readOnly ? (
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? '保存中…' : '保存更改'}
            </button>
          </div>
        ) : null}
      </form>

      <ConfirmModal
        open={slugConfirmOpen}
        onClose={() => {
          setSlugConfirmOpen(false);
          setPendingSlug(null);
        }}
        title="确认更改 slug"
        message="更改 slug 会使现有顾客二维码失效。确认仍要修改吗？"
        confirmLabel="确认修改"
        cancelLabel="取消"
        variant="danger"
        confirming={loading}
        onConfirm={() => void save(true)}
      />
    </section>
  );
}
