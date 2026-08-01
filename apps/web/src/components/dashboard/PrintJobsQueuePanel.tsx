'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PrintJobSummary, PrintJobStatus, PrintJobType } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { printJobErrorHint } from '@/lib/print-job-error-hints';
import { openPrintAgentConfigure } from '@/lib/print-agent-local';
import { PRINT_JOBS_RECENT_LIMIT } from '@/lib/print-jobs-recent';

type QueueResponse = {
  jobs?: PrintJobSummary[];
  limit?: number;
};

function isPrintJobType(v: string): v is PrintJobType {
  return v === 'order_receipt' || v === 'station_ticket' || v === 'pre_bill';
}

function isPrintJobStatus(v: string): v is PrintJobStatus {
  return v === 'pending' || v === 'processing' || v === 'done' || v === 'failed';
}

export function PrintJobsQueuePanel({ initialJobs }: { initialJobs: PrintJobSummary[] }) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [jobs, setJobs] = useState<PrintJobSummary[]>(() =>
    initialJobs.slice(0, PRINT_JOBS_RECENT_LIMIT),
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [openingConfigure, setOpeningConfigure] = useState(false);
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const labelType = (type: string) => {
    if (!isPrintJobType(type)) return type;
    if (type === 'order_receipt') return t.typeOrderReceipt;
    if (type === 'station_ticket') return t.typeStationTicket;
    return t.typePreBill;
  };

  const labelStatus = (status: string) => {
    if (!isPrintJobStatus(status)) return status;
    if (status === 'pending') return t.statusPending;
    if (status === 'processing') return t.statusProcessing;
    if (status === 'done') return t.statusDone;
    return t.statusFailed;
  };

  const loadQueue = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const res = await fetch('/api/print-agent/print-jobs/recent', { credentials: 'include' });
      if (!res.ok) {
        if (!silent) setLoadError(true);
        return;
      }
      const json = (await res.json()) as QueueResponse;
      setJobs((json.jobs || []).slice(0, PRINT_JOBS_RECENT_LIMIT));
    } catch {
      if (!silent) setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadQueue({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadQueue]);

  const retryJob = useCallback(
    async (jobId: string) => {
      setRetryingId(jobId);
      try {
        const res = await fetch(`/api/print-agent/print-jobs/${jobId}/retry`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;
        await loadQueue({ silent: true });
      } finally {
        setRetryingId(null);
      }
    },
    [loadQueue],
  );

  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <section className="rounded-xl border border-brand-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-ink">{t.queueTitle}</h2>
          <p className="mt-1 text-sm text-brand-muted">{t.tableHint}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-0 text-sm text-brand-primary hover:underline"
          loading={loading}
          onClick={() => void loadQueue()}
        >
          {t.refresh}
        </Button>
      </div>
      {failedCount > 0 ? (
        <div className="mesa-alert-warning mt-3 space-y-2 px-3 py-2 text-sm leading-relaxed">
          <p>{t.failedJobsHint}</p>
          <button
            type="button"
            disabled={openingConfigure}
            onClick={() => {
              setOpeningConfigure(true);
              void openPrintAgentConfigure(siteOrigin, undefined, lang).finally(() =>
                setOpeningConfigure(false),
              );
            }}
            className="text-sm font-medium text-brand-gold hover:underline disabled:opacity-50"
          >
            {openingConfigure ? '…' : t.failedJobsOpenConfigure}
          </button>
        </div>
      ) : null}
      {loadError ? <p className="mt-3 text-sm text-red-600">{t.loadError}</p> : null}
      {jobs.length === 0 ? (
        <p className="mt-4 py-2 text-sm text-brand-muted">{t.empty}</p>
      ) : (
        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-muted">
                <th className="py-2 pr-3 font-medium">{t.colTime}</th>
                <th className="whitespace-nowrap py-2 pr-3 font-medium">{t.colTable}</th>
                <th className="py-2 pr-3 font-medium">{t.colType}</th>
                <th className="py-2 pr-3 font-medium">{t.colStatus}</th>
                <th className="py-2 pr-3 font-medium">{t.colError}</th>
                <th className="py-2 pr-3 font-medium">{t.colActions}</th>
                <th className="py-2 font-medium">{t.colId}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((row) => {
                const hint = printJobErrorHint(row.error_message, lang);
                return (
                  <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-brand-ink">
                      {new Date(row.created_at).toLocaleString(locale, {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-brand-ink">
                      {row.table_display != null ? (
                        <span>{row.table_display}</span>
                      ) : (
                        <span className="text-brand-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-brand-ink">{labelType(row.type)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          row.status === 'failed'
                            ? 'mesa-badge-danger'
                            : row.status === 'done'
                              ? 'mesa-badge-success'
                              : row.status === 'processing'
                                ? 'mesa-badge-warning'
                                : 'border-slate-500/30 bg-slate-500/10 text-slate-700'
                        }`}
                      >
                        {labelStatus(row.status)}
                      </span>
                    </td>
                    <td className="max-w-[240px] py-2 pr-3">
                      {row.error_message ? (
                        <div className="space-y-0.5">
                          <p
                            className="line-clamp-2 text-xs text-red-800/90"
                            title={row.error_message}
                          >
                            {row.error_message}
                          </p>
                          {hint ? (
                            <p className="text-[11px] leading-snug text-brand-muted">{hint}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-brand-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      {row.status === 'failed' ? (
                        <button
                          type="button"
                          disabled={retryingId === row.id}
                          onClick={() => void retryJob(row.id)}
                          className="rounded-md border border-brand-border px-2 py-1 text-[11px] text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50"
                        >
                          {retryingId === row.id ? '…' : t.retryFailed}
                        </button>
                      ) : (
                        <span className="text-brand-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-[11px] text-brand-muted">
                      {row.id.slice(0, 8)}…
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
