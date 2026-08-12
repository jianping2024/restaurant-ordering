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
import {
  HAN_BITMAP_FONT_PX_MAX,
  HAN_BITMAP_FONT_PX_MIN,
  KITCHEN_READY_AFTER_MINUTES_MAX,
  KITCHEN_READY_AFTER_MINUTES_MIN,
} from '@/lib/print-agent-config';
import {
  OPERATION_LOG_RETENTION_DAYS_MAX,
  OPERATION_LOG_RETENTION_DAYS_MIN,
} from '@/lib/operation-logs/retention-days';
import {
  SUSHI_PER_PERSON_PER_ROUND_CAP_MAX,
  SUSHI_PER_PERSON_PER_ROUND_CAP_MIN,
  SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MAX,
  SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MIN,
  SUSHI_ROUND_COOLDOWN_SECONDS_MAX,
  SUSHI_ROUND_COOLDOWN_SECONDS_MIN,
  SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MAX,
  SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MIN,
} from '@/lib/table-order-round/settings';

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
  initialOperationLogRetentionDays: number;
  initialPrintLocale: PrintLocale;
  initialKitchenReadyAfterMinutes: number;
  initialSushiRoundOrderingEnabled: boolean;
  initialSushiPerPersonPerRoundCap: number;
  initialSushiRoundConfirmTimeoutSeconds: number;
  initialSushiRoundCooldownSeconds: number;
  initialSushiRoundDeferCooldownSeconds: number;
};

export function FeatureFlagsManager({
  embedded,
  initialFlags,
  initialCredentialTtlDays,
  initialStationSlipShowCategoryGroup,
  initialHanBitmapFontPx,
  initialOrderCooldownSeconds,
  initialOperationLogRetentionDays,
  initialPrintLocale,
  initialKitchenReadyAfterMinutes,
  initialSushiRoundOrderingEnabled,
  initialSushiPerPersonPerRoundCap,
  initialSushiRoundConfirmTimeoutSeconds,
  initialSushiRoundCooldownSeconds,
  initialSushiRoundDeferCooldownSeconds,
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
  const [operationLogRetentionDays, setOperationLogRetentionDays] = useState(
    initialOperationLogRetentionDays,
  );
  const [printLocale, setPrintLocale] = useState<PrintLocale>(initialPrintLocale);
  const [kitchenReadyAfterMinutes, setKitchenReadyAfterMinutes] = useState(
    initialKitchenReadyAfterMinutes,
  );
  const [sushiRoundOrderingEnabled, setSushiRoundOrderingEnabled] = useState(
    initialSushiRoundOrderingEnabled,
  );
  const [sushiPerPersonPerRoundCap, setSushiPerPersonPerRoundCap] = useState(
    initialSushiPerPersonPerRoundCap,
  );
  const [sushiRoundConfirmTimeoutSeconds, setSushiRoundConfirmTimeoutSeconds] = useState(
    initialSushiRoundConfirmTimeoutSeconds,
  );
  const [sushiRoundCooldownSeconds, setSushiRoundCooldownSeconds] = useState(
    initialSushiRoundCooldownSeconds,
  );
  const [sushiRoundDeferCooldownSeconds, setSushiRoundDeferCooldownSeconds] = useState(
    initialSushiRoundDeferCooldownSeconds,
  );
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
          operationLogRetentionDays,
          printLocale,
          kitchenReadyAfterMinutes,
          sushiRoundOrderingEnabled,
          sushiPerPersonPerRoundCap,
          sushiRoundConfirmTimeoutSeconds,
          sushiRoundCooldownSeconds,
          sushiRoundDeferCooldownSeconds,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        flags?: ResolvedRestaurantFeatureFlags;
        credentialTtlDays?: number;
        stationSlipShowCategoryGroup?: boolean;
        hanBitmapFontPx?: number;
        orderCooldownSeconds?: number;
        operationLogRetentionDays?: number;
        printLocale?: PrintLocale;
        kitchenReadyAfterMinutes?: number;
        sushiRoundOrderingEnabled?: boolean;
        sushiPerPersonPerRoundCap?: number;
        sushiRoundConfirmTimeoutSeconds?: number;
        sushiRoundCooldownSeconds?: number;
        sushiRoundDeferCooldownSeconds?: number;
      };

      if (!res.ok) {
        if (json.error === 'migration_required') setError(t.migrationRequired);
        else if (json.error === 'invalid_credential_ttl_days') setError(t.credentialTtlDaysInvalid);
        else if (json.error === 'invalid_han_bitmap_font_px') setError(t.hanBitmapFontPxInvalid);
        else if (json.error === 'invalid_kitchen_ready_after_minutes') {
          setError(t.kitchenReadyAfterMinutesInvalid);
        }
        else if (json.error === 'invalid_operation_log_retention_days') {
          setError(t.operationLogRetentionDaysInvalid);
        }
        else if (json.error?.startsWith('invalid_sushi_')) setError(t.sushiRoundInvalid);
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
      if (json.operationLogRetentionDays != null) {
        setOperationLogRetentionDays(json.operationLogRetentionDays);
      }
      if (json.printLocale) setPrintLocale(json.printLocale);
      if (json.kitchenReadyAfterMinutes != null) {
        setKitchenReadyAfterMinutes(json.kitchenReadyAfterMinutes);
      }
      if (json.sushiRoundOrderingEnabled != null) {
        setSushiRoundOrderingEnabled(json.sushiRoundOrderingEnabled);
      }
      if (json.sushiPerPersonPerRoundCap != null) {
        setSushiPerPersonPerRoundCap(json.sushiPerPersonPerRoundCap);
      }
      if (json.sushiRoundConfirmTimeoutSeconds != null) {
        setSushiRoundConfirmTimeoutSeconds(json.sushiRoundConfirmTimeoutSeconds);
      }
      if (json.sushiRoundCooldownSeconds != null) {
        setSushiRoundCooldownSeconds(json.sushiRoundCooldownSeconds);
      }
      if (json.sushiRoundDeferCooldownSeconds != null) {
        setSushiRoundDeferCooldownSeconds(json.sushiRoundDeferCooldownSeconds);
      }

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
              {module.id === 'kitchen' ? (
                <label className="block px-4 py-4">
                  <span className="block text-[15px] font-medium text-brand-text">
                    {t.kitchenReadyAfterMinutes}
                  </span>
                  <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                    {t.kitchenReadyAfterMinutesDesc}
                  </span>
                  <div className="flex items-center gap-2">
                    <IntegerInput
                      value={kitchenReadyAfterMinutes}
                      min={KITCHEN_READY_AFTER_MINUTES_MIN}
                      max={KITCHEN_READY_AFTER_MINUTES_MAX}
                      onChange={setKitchenReadyAfterMinutes}
                      className={FEATURES_INTEGER_INPUT}
                      aria-label={t.kitchenReadyAfterMinutes}
                    />
                    <span className="text-[13px] text-brand-text-muted">
                      {t.kitchenReadyAfterMinutesUnit}
                    </span>
                  </div>
                </label>
              ) : null}
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
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.hanBitmapFontPx}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.hanBitmapFontPxDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={hanBitmapFontPx}
                  min={HAN_BITMAP_FONT_PX_MIN}
                  max={HAN_BITMAP_FONT_PX_MAX}
                  onChange={setHanBitmapFontPx}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.hanBitmapFontPx}
                />
                <span className="text-[13px] text-brand-text-muted">{t.hanBitmapFontPxUnit}</span>
              </div>
            </label>
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

        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.moduleSushiRound}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
            <label className="flex items-start gap-3 px-4 py-4 cursor-pointer">
              <input
                type="checkbox"
                checked={sushiRoundOrderingEnabled}
                onChange={(e) => setSushiRoundOrderingEnabled(e.target.checked)}
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-brand-text">
                  {t.sushiRoundOrderingEnabled}
                </span>
                <span className="block text-[13px] text-brand-text-muted mt-0.5">
                  {t.sushiRoundOrderingEnabledDesc}
                </span>
              </span>
            </label>
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.sushiPerPersonPerRoundCap}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.sushiPerPersonPerRoundCapDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={sushiPerPersonPerRoundCap}
                  min={SUSHI_PER_PERSON_PER_ROUND_CAP_MIN}
                  max={SUSHI_PER_PERSON_PER_ROUND_CAP_MAX}
                  onChange={setSushiPerPersonPerRoundCap}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.sushiPerPersonPerRoundCap}
                />
                <span className="text-[13px] text-brand-text-muted">
                  {t.sushiPerPersonPerRoundCapUnit}
                </span>
              </div>
            </label>
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.sushiRoundConfirmTimeoutSeconds}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.sushiRoundConfirmTimeoutSecondsDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={sushiRoundConfirmTimeoutSeconds}
                  min={SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MIN}
                  max={SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MAX}
                  onChange={setSushiRoundConfirmTimeoutSeconds}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.sushiRoundConfirmTimeoutSeconds}
                />
                <span className="text-[13px] text-brand-text-muted">
                  {t.sushiRoundConfirmTimeoutSecondsUnit}
                </span>
              </div>
            </label>
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.sushiRoundCooldownSeconds}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.sushiRoundCooldownSecondsDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={sushiRoundCooldownSeconds}
                  min={SUSHI_ROUND_COOLDOWN_SECONDS_MIN}
                  max={SUSHI_ROUND_COOLDOWN_SECONDS_MAX}
                  onChange={setSushiRoundCooldownSeconds}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.sushiRoundCooldownSeconds}
                />
                <span className="text-[13px] text-brand-text-muted">
                  {t.sushiRoundCooldownSecondsUnit}
                </span>
              </div>
            </label>
            <label className="block px-4 py-4">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.sushiRoundDeferCooldownSeconds}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.sushiRoundDeferCooldownSecondsDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={sushiRoundDeferCooldownSeconds}
                  min={SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MIN}
                  max={SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MAX}
                  onChange={setSushiRoundDeferCooldownSeconds}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.sushiRoundDeferCooldownSeconds}
                />
                <span className="text-[13px] text-brand-text-muted">
                  {t.sushiRoundDeferCooldownSecondsUnit}
                </span>
              </div>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.moduleOperationLogs}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-4">
            <label className="block">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.operationLogRetentionDays}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.operationLogRetentionDaysDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={operationLogRetentionDays}
                  min={OPERATION_LOG_RETENTION_DAYS_MIN}
                  max={OPERATION_LOG_RETENTION_DAYS_MAX}
                  onChange={setOperationLogRetentionDays}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.operationLogRetentionDays}
                />
                <span className="text-[13px] text-brand-text-muted">
                  {t.operationLogRetentionDaysUnit}
                </span>
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
