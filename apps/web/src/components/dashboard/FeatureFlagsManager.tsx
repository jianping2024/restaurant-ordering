'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { printLocaleOption, SUPPORTED_PRINT_LOCALES, type PrintLocale } from '@/lib/i18n';
import {
  PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX,
  PRINT_AGENT_CREDENTIAL_TTL_DAYS_MIN,
  groupRestaurantFeaturesByModule,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';
import { HAN_BITMAP_FONT_PX_OPTIONS } from '@/lib/print-agent-config';

/** Sole features-page control face — theme `brand-bg` (never hard-coded white). */
const FEATURES_CONTROL_SURFACE =
  'rounded-lg border border-brand-border bg-brand-bg text-brand-text';
const PRINT_LOCALE_OPTION_IDLE = `${FEATURES_CONTROL_SURFACE} hover:border-brand-gold/60`;
const PRINT_LOCALE_OPTION_SELECTED =
  'rounded-lg border border-brand-gold bg-brand-gold/10 text-brand-text';
const FEATURES_INTEGER_INPUT = `w-24 ${FEATURES_CONTROL_SURFACE} px-3 py-2 tabular-nums`;

type Props = {
  embedded?: boolean;
  initialFlags: ResolvedRestaurantFeatureFlags;
  initialCredentialTtlDays: number;
  initialStationSlipShowCategoryGroup: boolean;
  initialHanBitmapFontPx: number;
  initialOrderCooldownSeconds: number;
  initialPrintLocale: PrintLocale;
};

export function FeatureFlagsManager({
  embedded,
  initialFlags,
  initialCredentialTtlDays,
  initialStationSlipShowCategoryGroup,
  initialHanBitmapFontPx,
  initialOrderCooldownSeconds,
  initialPrintLocale,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).featureSettings;
  const [flags, setFlags] = useState(initialFlags);
  const [credentialTtlDays, setCredentialTtlDays] = useState(initialCredentialTtlDays);
  const [stationSlipShowCategoryGroup, setStationSlipShowCategoryGroup] = useState(
    initialStationSlipShowCategoryGroup,
  );
  const [hanBitmapFontPx, setHanBitmapFontPx] = useState(initialHanBitmapFontPx);
  const [orderCooldownSeconds, setOrderCooldownSeconds] = useState(initialOrderCooldownSeconds);
  const [printLocale, setPrintLocale] = useState<PrintLocale>(initialPrintLocale);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/restaurant/features', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flags,
          credentialTtlDays,
          stationSlipShowCategoryGroup,
          hanBitmapFontPx,
          orderCooldownSeconds,
          printLocale,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        flags?: ResolvedRestaurantFeatureFlags;
        credentialTtlDays?: number;
        stationSlipShowCategoryGroup?: boolean;
        hanBitmapFontPx?: number;
        orderCooldownSeconds?: number;
        printLocale?: PrintLocale;
      };

      if (!res.ok) {
        if (json.error === 'migration_required') setError(t.migrationRequired);
        else if (json.error === 'invalid_credential_ttl_days') setError(t.credentialTtlDaysInvalid);
        else if (json.error === 'invalid_han_bitmap_font_px') setError(t.hanBitmapFontPxInvalid);
        else setError(t.saveFail);
        return;
      }

      if (json.flags) setFlags(json.flags);
      if (json.credentialTtlDays != null) setCredentialTtlDays(json.credentialTtlDays);
      if (json.stationSlipShowCategoryGroup != null) {
        setStationSlipShowCategoryGroup(json.stationSlipShowCategoryGroup);
      }
      if (json.hanBitmapFontPx != null) setHanBitmapFontPx(json.hanBitmapFontPx);
      if (json.orderCooldownSeconds != null) setOrderCooldownSeconds(json.orderCooldownSeconds);
      if (json.printLocale) setPrintLocale(json.printLocale);

      router.refresh();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {groupRestaurantFeaturesByModule().map(({ module, features }) => (
          <section key={module.id}>
            <h2 className="text-sm font-medium text-brand-text mb-2">{t[module.labelKey]}</h2>
            <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
              {features.map((def) => (
                <label
                  key={def.key}
                  className="flex items-start gap-3 px-4 py-4 cursor-pointer select-none hover:bg-brand-border/20 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={flags[def.key]}
                    onChange={(e) =>
                      setFlags((prev) => ({ ...prev, [def.key]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-brand-text">
                      {t[def.labelKey]}
                    </span>
                    <span className="block text-[13px] text-brand-text-muted mt-0.5">
                      {t[def.descKey]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}


        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.printLocale}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-4">
            <p className="text-[13px] text-brand-text-muted mb-3">{t.printLocaleDesc}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SUPPORTED_PRINT_LOCALES.map((optionId) => {
                const option = printLocaleOption(optionId);
                const selected = printLocale === optionId;
                return (
                  <button
                    key={optionId}
                    type="button"
                    onClick={() => setPrintLocale(optionId)}
                    className={`px-3 py-2 text-left text-sm transition ${
                      selected ? PRINT_LOCALE_OPTION_SELECTED : PRINT_LOCALE_OPTION_IDLE
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="block font-medium">{option.nativeName}</span>
                    <span className="block text-xs text-brand-text-muted">{option.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.modulePrintAgent}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
            <label className="flex items-start gap-3 px-4 py-4 cursor-pointer select-none hover:bg-brand-border/20 transition-colors">
              <input
                type="checkbox"
                checked={stationSlipShowCategoryGroup}
                onChange={(e) => setStationSlipShowCategoryGroup(e.target.checked)}
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-brand-text">
                  {t.stationSlipShowCategoryGroup}
                </span>
                <span className="block text-[13px] text-brand-text-muted mt-0.5">
                  {t.stationSlipShowCategoryGroupDesc}
                </span>
              </span>
            </label>
            <div className="px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.hanBitmapFontPx}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.hanBitmapFontPxDesc}
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t.hanBitmapFontPx}>
                {HAN_BITMAP_FONT_PX_OPTIONS.map((px) => {
                  const selected = hanBitmapFontPx === px;
                  return (
                    <button
                      key={px}
                      type="button"
                      onClick={() => setHanBitmapFontPx(px)}
                      className={`min-w-[3.25rem] px-3 py-2 text-sm tabular-nums transition ${
                        selected ? PRINT_LOCALE_OPTION_SELECTED : PRINT_LOCALE_OPTION_IDLE
                      }`}
                      aria-pressed={selected}
                    >
                      {px}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.credentialTtlDays}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.credentialTtlDaysDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={credentialTtlDays}
                  min={PRINT_AGENT_CREDENTIAL_TTL_DAYS_MIN}
                  max={PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX}
                  onChange={setCredentialTtlDays}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.credentialTtlDays}
                />
                <span className="text-[13px] text-brand-text-muted">{t.credentialTtlDaysUnit}</span>
              </div>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.moduleOrderCooldown}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-4">
            <label className="block">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.orderCooldownSeconds}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.orderCooldownSecondsDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={orderCooldownSeconds}
                  min={5}
                  max={60}
                  onChange={setOrderCooldownSeconds}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.orderCooldownSeconds}
                />
                <span className="text-[13px] text-brand-text-muted">{t.orderCooldownSecondsUnit}</span>
              </div>
            </label>
          </div>
        </section>
      </div>

      {error ? <p className="mt-3 text-sm text-status-danger">{error}</p> : null}
      {success ? (
        <p className="mt-3 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
          ✓ {t.saved}
        </p>
      ) : null}

      <div className="mt-6">
        <Button onClick={handleSave} loading={saving}>
          {t.save}
        </Button>
      </div>
    </div>
  );
}
