'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

type PairingRow = {
  id: string;
  expires_at: string;
  consumed_at: string | null;
  code_mask: string;
};

export function PrintAgentPairingPanel() {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<{ code: string; expires_at: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/print-agent/pairings', { credentials: 'include' });
      const data = (await res.json()) as { pairings?: PairingRow[]; error?: string };
      if (!res.ok) {
        setError(data.error || 'load_failed');
        return;
      }
      setPairings(data.pairings || []);
    } catch {
      setError('network');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSlotCount = pairings.length;
  const canCreate = activeSlotCount < 3;

  const createPairing = async () => {
    setCreating(true);
    setError(null);
    setFreshCode(null);
    try {
      const res = await fetch('/api/print-agent/pairing', {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as {
        code?: string;
        expires_at?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || data.message || 'create_failed');
        return;
      }
      if (data.code && data.expires_at) {
        setFreshCode({ code: data.code, expires_at: data.expires_at });
      }
      await load();
    } catch {
      setError('network');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-heading text-lg text-brand-text">{t.pairingTitle}</h2>
        <p className="text-[13px] text-brand-text-muted mt-1 max-w-2xl leading-relaxed">{t.pairingSubtitle}</p>
      </div>

      {freshCode && (
        <div
          className="rounded-xl border border-brand-gold/50 bg-brand-gold/10 px-4 py-3"
          role="status"
        >
          <p className="text-[13px] text-brand-text font-medium">{t.pairingNewCodeLabel}</p>
          <p className="mt-2 font-mono text-2xl tracking-[0.25em] text-brand-text tabular-nums select-all">
            {freshCode.code}
          </p>
          <p className="text-[12px] text-brand-text-muted mt-2">
            {t.pairingExpiresHint}{' '}
            {new Date(freshCode.expires_at).toLocaleString()}
          </p>
          <button
            type="button"
            className="mt-3 text-[12px] text-brand-text-muted hover:text-brand-text underline"
            onClick={() => setFreshCode(null)}
          >
            {t.pairingDismiss}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] text-red-600">{t.pairingErrorPrefix}{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canCreate || creating}
          onClick={() => void createPairing()}
          className="text-[13px] px-4 py-2 rounded-lg bg-brand-gold text-brand-bg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creating ? '…' : t.pairingGenerate}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : t.pairingRefreshList}
        </button>
        {!canCreate && <span className="text-[12px] text-amber-800">{t.pairingSlotFull}</span>}
      </div>

      <div>
        <p className="text-[12px] font-medium text-brand-text mb-2">{t.pairingListTitle}</p>
        {pairings.length === 0 ? (
          <p className="text-sm text-brand-text-muted">{t.pairingListEmpty}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {pairings.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border border-brand-border/60 rounded-lg px-3 py-2"
              >
                <span className="font-mono tracking-wider">{p.code_mask}</span>
                <span className="text-brand-text-muted text-[12px]">
                  {p.consumed_at ? t.pairingUsed : t.pairingPending} ·{' '}
                  {new Date(p.expires_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[12px] text-brand-text-muted leading-relaxed border-t border-brand-border/60 pt-3">
        {t.pairingAgentHint}
      </p>
    </div>
  );
}
