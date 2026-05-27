'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { openPrintAgentConfigure } from '@/lib/print-agent-local';
import {
  formatPairingCountdown,
  pairingExpiryRemainingMs,
} from '@/lib/pairing-code-countdown';

type PairingRow = {
  id: string;
  expires_at: string;
  consumed_at: string | null;
  code_mask: string;
};

type ConfigureProbe = 'idle' | 'checking' | 'unreachable' | 'opened';

export function PrintAgentPairingPanel() {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [configureProbe, setConfigureProbe] = useState<ConfigureProbe>('idle');
  const [codeCopied, setCodeCopied] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [codeExpired, setCodeExpired] = useState(false);

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

  useEffect(() => {
    if (!freshCode?.expires_at) {
      setCountdown('');
      setCodeExpired(false);
      return;
    }
    const tick = () => {
      const remaining = pairingExpiryRemainingMs(freshCode.expires_at);
      if (remaining <= 0) {
        setCodeExpired(true);
        setCountdown('');
        return;
      }
      setCodeExpired(false);
      setCountdown(formatPairingCountdown(remaining));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [freshCode?.expires_at]);

  const activeSlotCount = pairings.length;
  const canCreate = activeSlotCount < 3;
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const openConfigure = useCallback(
    async (code?: string) => {
      setConfigureProbe('checking');
      const result = await openPrintAgentConfigure(siteOrigin, code);
      if (result === 'unreachable') {
        setConfigureProbe('unreachable');
      } else {
        setConfigureProbe('opened');
      }
    },
    [siteOrigin],
  );

  const copyPairingCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      /* clipboard denied — user can still select the code */
    }
  };

  const createPairing = async () => {
    setCreating(true);
    setError(null);
    setFreshCode(null);
    setConfigureProbe('idle');
    setCodeCopied(false);
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
        await openConfigure(data.code);
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

      {freshCode && !codeExpired ? (
        <div
          className="rounded-xl border border-brand-gold/50 bg-brand-gold/10 px-4 py-4 space-y-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-[13px] text-brand-text font-medium">{t.pairingNewCodeLabel}</p>
          <div className="flex flex-wrap items-center gap-3">
            <p
              className="font-mono text-4xl sm:text-5xl font-semibold tracking-[0.2em] text-brand-text tabular-nums select-all"
              aria-label={t.pairingCodeAria}
            >
              {freshCode.code}
            </p>
            <button
              type="button"
              onClick={() => void copyPairingCode(freshCode.code)}
              className="text-[12px] px-3 py-2 rounded-lg border border-brand-border bg-white/80 text-brand-text hover:border-brand-gold/50 transition-colors"
            >
              {codeCopied ? t.pairingCopied : t.pairingCopyCode}
            </button>
          </div>
          <p className="text-[13px] text-brand-text font-medium tabular-nums">
            {t.pairingExpiresCountdown.replace('{countdown}', countdown)}
          </p>
          <p className="text-[11px] text-brand-text-muted">
            {t.pairingExpiresHint}{' '}
            {new Date(freshCode.expires_at).toLocaleString()}
          </p>
          <ol className="text-[12px] text-brand-text-muted space-y-1 list-decimal list-inside leading-relaxed">
            <li>{t.configureStep1}</li>
            <li>{t.configureStep2}</li>
            <li>{t.configureStep3}</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={configureProbe === 'checking'}
              onClick={() => void openConfigure(freshCode.code)}
              className="inline-flex items-center justify-center rounded-lg bg-brand-gold text-brand-on-gold px-4 py-2 text-sm font-semibold hover:bg-brand-gold-light transition-colors disabled:opacity-60"
            >
              {configureProbe === 'checking' ? '…' : t.configureOpenWithCode}
            </button>
            <button
              type="button"
              className="text-[12px] px-3 py-2 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
              onClick={() => {
                setFreshCode(null);
                setConfigureProbe('idle');
              }}
            >
              {t.pairingDismiss}
            </button>
          </div>
          <p className="text-[11px] text-brand-text-muted leading-relaxed">{t.pairingWizardNote}</p>
        </div>
      ) : null}

      {freshCode && codeExpired ? (
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t.pairingExpired}
        </p>
      ) : null}

      {configureProbe === 'unreachable' ? (
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          {t.configureUnreachable}
        </p>
      ) : null}

      {configureProbe === 'opened' ? (
        <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
          {t.configureOpenedHint}
        </p>
      ) : null}

      {error && <p className="text-[13px] text-red-600">{t.pairingErrorPrefix}{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canCreate || creating}
          onClick={() => void createPairing()}
          className="text-[13px] px-4 py-2 rounded-lg bg-brand-gold text-brand-on-gold font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
        {!canCreate && <span className="text-[12px] mesa-text-warning">{t.pairingSlotFull}</span>}
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

      <div className="border-t border-brand-border/60 pt-3 space-y-2">
        <p className="text-[12px] font-medium text-brand-text">{t.configureTitle}</p>
        <p className="text-[12px] text-brand-text-muted leading-relaxed">{t.configureSubtitle}</p>
        <button
          type="button"
          disabled={configureProbe === 'checking'}
          onClick={() => void openConfigure()}
          className="inline-flex text-[12px] text-brand-gold hover:underline font-medium disabled:opacity-60"
        >
          {configureProbe === 'checking' ? '…' : t.configureOpenIdle}
        </button>
        <p className="text-[12px] text-brand-text-muted leading-relaxed pt-1">{t.pairingAgentHint}</p>
      </div>
    </div>
  );
}
