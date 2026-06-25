'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  formToCloudConfig,
  type PrintAgentSettingsForm,
} from '@/lib/print-agent-config';
import { getMessages } from '@/lib/i18n/messages';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { TimeHmInput } from '@/components/ui/TimeHmInput';

const TIMEZONES = [
  'Europe/Lisbon',
  'Atlantic/Azores',
  'Asia/Shanghai',
  'Europe/London',
  'UTC',
] as const;

export function PrintAgentSchedulePanel({
  initialForm,
}: {
  initialForm: PrintAgentSettingsForm;
}) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const ba = getMessages(lang).buffetAdmin;
  const [form, setForm] = useState<PrintAgentSettingsForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof PrintAgentSettingsForm>(key: K, value: PrintAgentSettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let config;
      try {
        config = formToCloudConfig(form);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'invalid_time');
        return;
      }
      const res = await fetch('/api/print-agent/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = (await res.json()) as { form?: PrintAgentSettingsForm; error?: string };
      if (!res.ok) {
        setError(data.error || 'save_failed');
        return;
      }
      if (data.form) {
        setForm(data.form);
      }
      setSaved(true);
    } catch {
      setError('network');
    } finally {
      setSaving(false);
    }
  }, [form]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/print-agent/settings', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { form?: PrintAgentSettingsForm };
        if (data.form) setForm(data.form);
      } catch {
        /* keep SSR initial */
      }
    })();
  }, []);

  const errLabel =
    error === 'end_before_start'
      ? t.scheduleErrEndBeforeStart
      : error === 'invalid_time'
        ? t.scheduleErrInvalidTime
        : error
          ? `${t.scheduleErrPrefix}${error}`
          : null;

  const warmMinutesSuffix =
    form.warmAfterActivitySec >= 60
      ? `≈ ${Math.round(form.warmAfterActivitySec / 60)} ${lang === 'zh' ? '分钟' : 'min'}`
      : undefined;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-6">
      <div>
        <h2 className="font-heading text-lg text-brand-text">{t.scheduleTitle}</h2>
        <p className="text-[13px] text-brand-text-muted mt-1 max-w-2xl leading-relaxed">{t.scheduleSubtitle}</p>
        <p
          className="mt-3 max-w-2xl rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-brand-text"
          role="note"
        >
          {t.scheduleApplyNote}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-3">
          <span className="text-sm text-brand-text-muted font-medium block">{t.scheduleTimezone}</span>
          <select
            value={form.timezone}
            onChange={(e) => setField('timezone', e.target.value)}
            className="w-full max-w-md rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5 text-[13px] text-brand-text"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-3 sm:col-span-1">
          <legend className="text-sm text-brand-text-muted font-medium block pb-1">{t.scheduleLunch}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <TimeHmInput
              label={ba.start}
              value={form.lunchStart}
              onChange={(v) => setField('lunchStart', v)}
              placeholder="12:00"
            />
            <span className="pb-2.5 text-brand-text-muted text-[13px]">–</span>
            <TimeHmInput
              label={ba.end}
              value={form.lunchEnd}
              onChange={(v) => setField('lunchEnd', v)}
              placeholder="15:00"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3 sm:col-span-1">
          <legend className="text-sm text-brand-text-muted font-medium block pb-1">{t.scheduleDinner}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <TimeHmInput
              label={ba.start}
              value={form.dinnerStart}
              onChange={(v) => setField('dinnerStart', v)}
              placeholder="19:30"
            />
            <span className="pb-2.5 text-brand-text-muted text-[13px]">–</span>
            <TimeHmInput
              label={ba.end}
              value={form.dinnerEnd}
              onChange={(v) => setField('dinnerEnd', v)}
              placeholder="23:00"
            />
          </div>
        </fieldset>
      </div>

      <details className="text-[13px]">
        <summary className="cursor-pointer text-brand-text-muted hover:text-brand-text">
          {t.schedulePollAdvanced}
        </summary>
        <div className="mt-4 space-y-6">
          <p className="text-[12px] text-brand-text-muted leading-relaxed max-w-2xl">{t.schedulePollIntro}</p>

          <PollIntervalField
            label={t.scheduleAfterPrint}
            hint={t.scheduleAfterPrintHint}
            min={0}
            max={60}
            value={form.afterPrintIntervalSec}
            onChange={(n) => setField('afterPrintIntervalSec', n)}
          />

          <div className="space-y-4 rounded-xl border border-brand-border/70 bg-brand-bg/40 p-4">
            <p className="text-sm font-medium text-brand-text">{t.schedulePollEmptyQueue}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <PollIntervalField
                label={t.scheduleWarm}
                hint={t.scheduleWarmHint}
                min={2}
                max={60}
                value={form.warmIntervalSec}
                onChange={(n) => setField('warmIntervalSec', n)}
              />
              <PollIntervalField
                label={t.scheduleWarmAfter}
                hint={t.scheduleWarmAfterHint}
                min={60}
                max={7200}
                value={form.warmAfterActivitySec}
                onChange={(n) => setField('warmAfterActivitySec', n)}
                suffix={warmMinutesSuffix}
              />
              <PollIntervalField
                className="sm:col-span-2"
                label={t.scheduleIdle}
                hint={t.scheduleIdleHint}
                min={3}
                max={120}
                value={form.idleIntervalSec}
                onChange={(n) => setField('idleIntervalSec', n)}
              />
            </div>
          </div>
        </div>
      </details>

      {errLabel && <p className="text-[13px] text-red-600">{errLabel}</p>}
      {saved && (
        <p
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-emerald-900 dark:text-emerald-100"
          role="status"
        >
          {t.scheduleSaved}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="text-[13px] px-4 py-2 rounded-lg bg-brand-gold text-brand-on-gold font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '…' : t.scheduleSave}
        </button>
      </div>

    </div>
  );
}

function PollIntervalField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
  className = '',
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="text-sm text-brand-text-muted font-medium block">{label}</span>
      <p className="text-[12px] text-brand-text-muted leading-relaxed">{hint}</p>
      <div className="flex items-center gap-2 max-w-xs">
        <IntegerInput
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-brand-border bg-brand-card px-4 py-2.5 text-[15px] text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
        />
        {suffix && <span className="text-[12px] text-brand-text-muted shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}
