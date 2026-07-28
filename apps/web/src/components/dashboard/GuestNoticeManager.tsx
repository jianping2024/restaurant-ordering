'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  type GuestOrderingNotice,
  type GuestOrderingNoticeLocaleFields,
  resolveGuestOrderingNoticeForDisplay,
} from '@/lib/guest-ordering-notice';

type Props = {
  initialNotice: GuestOrderingNotice;
};

type LocaleKey = keyof GuestOrderingNoticeLocaleFields;

const LOCALE_KEYS: LocaleKey[] = ['pt', 'en', 'zh'];

function LocaleFieldsEditor({
  label,
  values,
  onChange,
  multiline,
  placeholders,
}: {
  label: string;
  values: GuestOrderingNoticeLocaleFields;
  onChange: (next: GuestOrderingNoticeLocaleFields) => void;
  multiline?: boolean;
  placeholders: GuestOrderingNoticeLocaleFields;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-brand-text">{label}</p>
      {LOCALE_KEYS.map((locale) => (
        <div key={locale}>
          <label className="mb-1 block text-[12px] uppercase tracking-wide text-brand-text-muted">
            {locale}
          </label>
          {multiline ? (
            <textarea
              value={values[locale]}
              onChange={(event) =>
                onChange({ ...values, [locale]: event.target.value })
              }
              rows={4}
              placeholder={placeholders[locale]}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-text-muted/70 focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/30"
            />
          ) : (
            <Input
              value={values[locale]}
              onChange={(event) =>
                onChange({ ...values, [locale]: event.target.value })
              }
              placeholder={placeholders[locale]}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function GuestNoticeManager({ initialNotice }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).guestNoticeSettings;
  const [notice, setNotice] = useState(initialNotice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const preview = useMemo(
    () => resolveGuestOrderingNoticeForDisplay(notice, lang),
    [notice, lang],
  );

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/dashboard/guest-notice', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notice),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        notice?: GuestOrderingNotice;
      };
      if (!res.ok) {
        if (json.error === 'notice_pt_title_required') setError(t.errorTitleRequired);
        else if (json.error === 'notice_pt_body_required') setError(t.errorBodyRequired);
        else if (json.error === 'restaurant_suspended') setError(t.errorSuspended);
        else setError(t.saveFail);
        return;
      }
      if (json.notice) setNotice(json.notice);
      setSuccess(true);
      router.refresh();
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-brand-gold">{t.title}</h1>
        <p className="mt-1 text-sm text-brand-text-muted">{t.subtitle}</p>
      </div>

      {error ? <p className="mesa-alert-danger mb-4 text-sm px-4 py-2">{error}</p> : null}
      {success ? <p className="mesa-alert-success mb-4 text-sm px-4 py-2">{t.saveOk}</p> : null}

      <div className="space-y-6 rounded-xl border border-brand-border bg-brand-card p-4 sm:p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={notice.enabled}
            onChange={(event) =>
              setNotice((current) => ({ ...current, enabled: event.target.checked }))
            }
            className="mt-1 h-4 w-4 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
          />
          <span>
            <span className="block text-sm font-medium text-brand-text">{t.enabledLabel}</span>
            <span className="mt-0.5 block text-[13px] text-brand-text-muted">{t.enabledHint}</span>
          </span>
        </label>

        <LocaleFieldsEditor
          label={t.titleFieldsLabel}
          values={notice.title}
          onChange={(title) => setNotice((current) => ({ ...current, title }))}
          placeholders={{
            pt: t.titlePlaceholderPt,
            en: t.titlePlaceholderEn,
            zh: t.titlePlaceholderZh,
          }}
        />

        <LocaleFieldsEditor
          label={t.bodyFieldsLabel}
          values={notice.body}
          onChange={(body) => setNotice((current) => ({ ...current, body }))}
          multiline
          placeholders={{
            pt: t.bodyPlaceholderPt,
            en: t.bodyPlaceholderEn,
            zh: t.bodyPlaceholderZh,
          }}
        />

        <div className="rounded-xl border border-brand-border/70 bg-brand-bg/60 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-text-muted">
            {t.previewLabel}
          </p>
          {preview ? (
            <div className="mt-3 space-y-2">
              <p className="font-heading text-lg text-brand-gold">{preview.title}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text">
                {preview.body}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-brand-text-muted">{t.previewEmpty}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="gold" loading={saving} onClick={() => void handleSave()}>
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
