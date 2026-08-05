'use client';

import { FormEvent, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { SystemLogLine } from '@/lib/system-logs/types';

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from: toDatetimeLocalValue(from), to: toDatetimeLocalValue(to) };
}

/** Sole client for system log query — state is SystemLogQuery fields only. */
export function SystemLogsViewer() {
  const { lang } = useLanguage();
  const t = getMessages(lang).settingsSystemLogs;
  const initial = defaultRange();
  const [fromLocal, setFromLocal] = useState(initial.from);
  const [toLocal, setToLocal] = useState(initial.to);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<SystemLogLine[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const from = new Date(fromLocal);
      const to = new Date(toLocal);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
        setError(t.errorInvalidRange);
        setLines([]);
        return;
      }
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/dashboard/system-logs?${params}`, {
        credentials: 'include',
      });
      const json = (await res.json()) as {
        error?: string;
        lines?: SystemLogLine[];
        truncated?: boolean;
      };
      if (!res.ok) {
        if (json.error === 'invalid_range' || json.error === 'range_too_large') {
          setError(t.errorInvalidRange);
        } else if (json.error === 'source_unavailable') {
          setError(t.errorUnavailable);
        } else if (res.status === 404 || res.status === 401) {
          setError(t.errorForbidden);
        } else {
          setError(t.errorFailed);
        }
        setLines([]);
        setTruncated(false);
        return;
      }
      setLines(json.lines ?? []);
      setTruncated(Boolean(json.truncated));
    } catch {
      setError(t.errorFailed);
      setLines([]);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-brand-text-muted">{t.fromLabel}</span>
          <input
            type="datetime-local"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            className="rounded-md border border-brand-border bg-brand-card px-3 py-2 text-base text-brand-text"
            required
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-brand-text-muted">{t.toLabel}</span>
          <input
            type="datetime-local"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            className="rounded-md border border-brand-border bg-brand-card px-3 py-2 text-base text-brand-text"
            required
          />
        </label>
        <label className="flex min-w-[12rem] flex-[2] flex-col gap-1 text-sm">
          <span className="text-brand-text-muted">{t.keywordLabel}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.keywordPlaceholder}
            className="rounded-md border border-brand-border bg-brand-card px-3 py-2 text-base text-brand-text"
            maxLength={200}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-brand-text disabled:opacity-60"
        >
          {loading ? t.querying : t.query}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {truncated ? (
        <p className="text-sm text-brand-text-muted">{t.truncated}</p>
      ) : null}

      <div className="overflow-hidden rounded-md border border-brand-border bg-zinc-950">
        {!searched ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">{t.idleHint}</p>
        ) : loading ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">{t.querying}</p>
        ) : lines.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">{t.empty}</p>
        ) : (
          <ul className="max-h-[28rem] overflow-auto font-mono text-[12px] leading-5 text-zinc-200">
            {lines.map((line, i) => (
              <li
                key={`${line.ts}-${i}`}
                className="border-b border-zinc-800/80 px-3 py-1 whitespace-pre-wrap break-all"
              >
                {line.ts ? (
                  <span className="mr-2 text-zinc-500">{line.ts}</span>
                ) : null}
                <span>{line.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
