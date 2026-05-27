'use client';

import { useCallback, useState } from 'react';
import type { PrintJobSummary, PrintJobStatus, PrintJobType } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { printJobErrorHint } from '@/lib/print-job-error-hints';
import { openPrintAgentConfigure } from '@/lib/print-agent-local';

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
  const [jobs, setJobs] = useState<PrintJobSummary[]>(initialJobs);
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

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const qs = new URLSearchParams({ limit: '25' });
      const res = await fetch(`/api/print-agent/print-jobs/recent?${qs}`, { credentials: 'include' });
      if (!res.ok) {
        if (!silent) setLoadError(true);
        return;
      }
      const json = (await res.json()) as { jobs?: PrintJobSummary[] };
      const rows = json.jobs || [];
      setJobs(rows);
    } catch {
      if (!silent) setLoadError(true);
      return;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const retryJob = useCallback(
    async (jobId: string) => {
      setRetryingId(jobId);
      try {
        const res = await fetch(`/api/print-agent/print-jobs/${jobId}/retry`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;
        await refresh({ silent: true });
      } finally {
        setRetryingId(null);
      }
    },
    [refresh],
  );

  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-heading text-lg text-brand-text">{t.queueTitle}</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : t.refresh}
        </button>
      </div>
      <p className="text-[12px] text-brand-text-muted mb-3 leading-relaxed">{t.tableHint}</p>
      {failedCount > 0 ? (
        <div className="text-[12px] mesa-alert-warning px-3 py-2 mb-3 leading-relaxed space-y-2">
          <p>{t.failedJobsHint}</p>
          <button
            type="button"
            disabled={openingConfigure}
            onClick={() => {
              setOpeningConfigure(true);
              void openPrintAgentConfigure(siteOrigin).finally(() => setOpeningConfigure(false));
            }}
            className="text-[12px] font-medium text-brand-gold hover:underline disabled:opacity-50"
          >
            {openingConfigure ? '…' : t.failedJobsOpenConfigure}
          </button>
        </div>
      ) : null}
      {loadError && <p className="text-[13px] mesa-text-danger mb-2">{t.loadError}</p>}
      {jobs.length === 0 ? (
        <p className="text-sm text-brand-text-muted py-4">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[580px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-brand-border text-brand-text-muted">
                <th className="py-2 pr-3 font-medium">{t.colTime}</th>
                <th className="py-2 pr-3 font-medium whitespace-nowrap">{t.colTable}</th>
                <th className="py-2 pr-3 font-medium">{t.colType}</th>
                <th className="py-2 pr-3 font-medium">{t.colStatus}</th>
                <th className="py-2 pr-3 font-medium">{t.colError}</th>
                <th className="py-2 pr-3 font-medium">{t.colActions}</th>
                <th className="py-2 font-medium">{t.colId}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((row) => (
                <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="py-2 pr-3 text-brand-text whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString(locale, {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2 pr-3 text-brand-text whitespace-nowrap tabular-nums">
                    {row.table_display != null ? (
                      <span>{row.table_display}</span>
                    ) : (
                      <span className="text-brand-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-brand-text">{labelType(row.type)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                        row.status === 'failed'
                          ? 'mesa-badge-danger'
                          : row.status === 'done'
                            ? 'mesa-badge-success'
                            : row.status === 'processing'
                              ? 'mesa-badge-warning'
                              : 'bg-slate-500/10 text-slate-700 border-slate-500/30'
                      }`}
                    >
                      {labelStatus(row.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 max-w-[240px]">
                    {row.error_message ? (
                      <div className="space-y-0.5">
                        <p
                          className="text-red-800/90 text-[12px] line-clamp-2"
                          title={row.error_message}
                        >
                          {row.error_message}
                        </p>
                        {printJobErrorHint(row.error_message, lang) ? (
                          <p className="text-[11px] text-brand-text-muted leading-snug">
                            {printJobErrorHint(row.error_message, lang)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-brand-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {row.status === 'failed' ? (
                      <button
                        type="button"
                        disabled={retryingId === row.id}
                        onClick={() => void retryJob(row.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-brand-border text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50"
                      >
                        {retryingId === row.id ? '…' : t.retryFailed}
                      </button>
                    ) : (
                      <span className="text-brand-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-brand-text-muted">{row.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
