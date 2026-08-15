'use client';

import { FormEvent, useState } from 'react';
import { PREMIUM_KEYS, type PremiumKey } from '@mesa/shared';

const PREMIUM_LABELS: Record<PremiumKey, string> = {
  value_analytics: '增值分析',
  abnormal_ops: '异常操作',
  operation_logs: '操作记录',
};

type Props = {
  initial: {
    premiumKeys: PremiumKey[];
    wechatUrl: string | null;
    whatsappUrl: string | null;
  };
};

export function ProSettingsClient({ initial }: Props) {
  const [premiumKeys, setPremiumKeys] = useState<Set<PremiumKey>>(new Set(initial.premiumKeys));
  const [wechatUrl, setWechatUrl] = useState(initial.wechatUrl ?? '');
  const [whatsappUrl, setWhatsappUrl] = useState(initial.whatsappUrl ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleKey = (key: PremiumKey) => {
    setPremiumKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/ops/settings/pro', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumKeys: Array.from(premiumKeys),
          wechatUrl: wechatUrl.trim() || null,
          whatsappUrl: whatsappUrl.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message || json.error || '保存失败');
        return;
      }
      setSuccess('已保存');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm text-zinc-400">需要 Pro 的功能（全局）</legend>
        {PREMIUM_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={premiumKeys.has(key)}
              onChange={() => toggleKey(key)}
            />
            <span>{PREMIUM_LABELS[key]}</span>
            <span className="font-mono text-xs text-zinc-600">{key}</span>
          </label>
        ))}
      </fieldset>

      <label className="block text-sm text-zinc-400">
        微信联系链接
        <input
          value={wechatUrl}
          onChange={(e) => setWechatUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>

      <label className="block text-sm text-zinc-400">
        WhatsApp 联系链接
        <input
          value={whatsappUrl}
          onChange={(e) => setWhatsappUrl(e.target.value)}
          placeholder="https://wa.me/…"
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? '保存中…' : '保存'}
      </button>
    </form>
  );
}
