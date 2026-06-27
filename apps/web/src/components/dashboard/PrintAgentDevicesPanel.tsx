'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import {
  formatLastSeenRelative,
  isPrintAgentDeviceOnline,
  type PrintAgentDeviceHeartbeatRow,
} from '@/lib/print-agent-heartbeat';

function deviceLabel(d: PrintAgentDeviceHeartbeatRow, fallback: string): string {
  const label = d.label?.trim();
  if (label) return label;
  return `${fallback} ${d.id.slice(0, 8)}…`;
}

export function PrintAgentDevicesPanel({
  initialDevices,
  recommendedVersion = '',
}: {
  initialDevices: PrintAgentDeviceHeartbeatRow[];
  recommendedVersion?: string;
}) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [devices, setDevices] = useState(initialDevices);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PrintAgentDeviceHeartbeatRow | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/print-agent/devices', { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as { devices?: PrintAgentDeviceHeartbeatRow[] };
      setDevices(json.devices || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const runRevoke = async () => {
    const target = revokeTarget;
    if (!target) return;
    setRevokingId(target.id);
    setError('');
    try {
      const res = await fetch(`/api/print-agent/devices/${target.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setError(json.error || 'revoke_failed');
        return;
      }
      const revokedId = json.id ?? target.id;
      setRevokeTarget(null);
      setDevices((prev) => prev.filter((d) => d.id !== revokedId));
    } catch {
      setError('network');
    } finally {
      setRevokingId(null);
    }
  };

  if (devices.length === 0) {
    return (
      <section className="rounded-xl border border-brand-border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-ink">{t.devicesTitle}</h2>
        <p className="mt-2 text-sm text-brand-muted">{t.devicesEmpty}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-brand-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-ink">{t.devicesTitle}</h2>
          <p className="mt-1 text-sm text-brand-muted">{t.devicesSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-sm text-brand-primary hover:underline disabled:opacity-50"
        >
          {loading ? t.devicesRefreshing : t.devicesRefresh}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <ul className="modal-scroll mt-4 max-h-96 space-y-3 overflow-y-auto">
        {devices.map((d) => {
          const online = isPrintAgentDeviceOnline(d.last_seen);
          const versionBehind =
            recommendedVersion &&
            d.agent_version &&
            d.agent_version !== recommendedVersion;
          const name = deviceLabel(d, t.devicesUnlabeled);
          return (
            <li
              key={d.id}
              className="rounded-lg border border-brand-border/80 bg-brand-bg/40 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-gray-400'}`}
                    aria-hidden
                  />
                  <span className="font-medium text-brand-ink">{name}</span>
                  <span className={online ? 'text-emerald-700' : 'text-brand-muted'}>
                    {online ? t.devicesOnline : t.devicesOffline}
                  </span>
                  {d.schedule_open === false && online ? (
                    <span className="text-amber-700">{t.devicesOutsideSchedule}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={revokingId === d.id}
                  onClick={() => setRevokeTarget(d)}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  {t.devicesRevoke}
                </button>
              </div>
              <dl className="mt-2 grid gap-1 text-brand-muted sm:grid-cols-2">
                <div>
                  <dt className="inline">{t.devicesLastSeen}: </dt>
                  <dd className="inline text-brand-ink">
                    {formatLastSeenRelative(d.last_seen, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="inline">{t.devicesVersion}: </dt>
                  <dd className="inline text-brand-ink">
                    {d.agent_version || '—'}
                    {versionBehind ? (
                      <span className="ml-1 text-amber-700">
                        ({t.devicesVersionBehind.replace('{ver}', recommendedVersion!)})
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="inline">{t.devicesMappedStations}: </dt>
                  <dd className="inline text-brand-ink">
                    {d.mapped_station_labels?.length
                      ? d.mapped_station_labels.join(' · ')
                      : d.mapped_station_count != null && d.mapped_station_count > 0
                        ? String(d.mapped_station_count)
                        : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="inline">{t.devicesLastPrint}: </dt>
                  <dd className="inline text-brand-ink">
                    {d.last_print_at
                      ? `${formatLastSeenRelative(d.last_print_at, locale)} — ${
                          d.last_print_status === 'done'
                            ? t.statusDone
                            : d.last_print_status === 'failed'
                              ? t.statusFailed
                              : d.last_print_status || '—'
                        }`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title={t.devicesRevokeTitle}
        message={
          revokeTarget
            ? t.devicesRevokeMessage.replace('{name}', deviceLabel(revokeTarget, t.devicesUnlabeled))
            : ''
        }
        confirmLabel={t.devicesRevokeConfirm}
        cancelLabel={t.devicesRevokeCancel}
        variant="danger"
        confirming={revokingId != null}
        onConfirm={runRevoke}
      />
    </section>
  );
}
