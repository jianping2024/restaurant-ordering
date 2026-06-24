'use client';

import { FormEvent, useState } from 'react';
import {
  RESTAURANT_FEATURE_DEFINITIONS,
  type PrintLocale,
  type ResolvedRestaurantFeatureFlags,
} from '@mesa/shared';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Props = {
  restaurantId: string;
  initial: {
    name: string;
    slug: string;
    plan: string;
    address: string | null;
    phone: string | null;
    printLocale: PrintLocale;
    featureFlags: ResolvedRestaurantFeatureFlags;
  };
};

const FEATURE_LABELS: Record<string, string> = {
  kitchen_board: '厨房看板快捷入口',
  bill_receipt_print: '结账小票打印',
};

export function RestaurantEditPanel({ restaurantId, initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [plan, setPlan] = useState(initial.plan);
  const [address, setAddress] = useState(initial.address || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [printLocale, setPrintLocale] = useState<PrintLocale>(initial.printLocale);
  const [flags, setFlags] = useState(initial.featureFlags);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const save = async (confirmSlugChange = false) => {
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
    <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">编辑餐厅</h2>
      <p className="mt-1 text-sm text-zinc-500">仅 admin 可修改；操作写入审计日志</p>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          餐厅名称
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          slug
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          plan
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          地址
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          电话
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          print_locale
          <select
            value={printLocale}
            onChange={(e) => setPrintLocale(e.target.value as PrintLocale)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            <option value="zh">zh</option>
            <option value="en">en</option>
            <option value="pt">pt</option>
          </select>
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm text-zinc-400">功能开关（运营覆盖）</legend>
          <div className="mt-2 space-y-2">
            {RESTAURANT_FEATURE_DEFINITIONS.map((def) => (
              <label key={def.key} className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={flags[def.key]}
                  onChange={(e) => setFlags((prev) => ({ ...prev, [def.key]: e.target.checked }))}
                  className="rounded border-zinc-600"
                />
                {FEATURE_LABELS[def.key] || def.key}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? '保存中…' : '保存更改'}
          </button>
        </div>
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
