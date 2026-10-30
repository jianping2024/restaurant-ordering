'use client';

import Link from 'next/link';
import { ProFeatureBadge } from '@/components/dashboard/ProFeatureBadge';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  groupRestaurantFeaturesForFeatureSettings,
  pickRestaurantFeatureFlagsForModules,
  type RestaurantFeatureKey,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';
import {
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
} from '@/lib/table-order-round/settings';
import {
  ORDER_COOLDOWN_SECONDS_MAX,
  ORDER_COOLDOWN_SECONDS_MIN,
} from '@/lib/order-submit-cooldown-client';
import { FEATURES_INTEGER_INPUT } from '@/components/dashboard/feature-settings-control-chrome';

type Props = {
  embedded?: boolean;
  initialFlags: ResolvedRestaurantFeatureFlags;
  /** Pro-gated toggles not effective for this restaurant: shown locked with an upgrade link. */
  proLockedFeatureKeys?: readonly RestaurantFeatureKey[];
  initialOrderCooldownSeconds: number;
  initialOperationLogRetentionDays: number;
  initialKitchenReadyAfterMinutes: number;
  initialTakeawayVatRate: number;
  initialSushiRoundOrderingEnabled: boolean;
  initialSushiPerPersonPerRoundCap: number;
  initialSushiRoundConfirmTimeoutSeconds: number;
  initialSushiRoundCooldownSeconds: number;
  initialSushiMenuVegetarianFilterEnabled: boolean;
  initialSushiMenuAllergenFilterEnabled: boolean;
};

export function FeatureFlagsManager({
  embedded,
  initialFlags,
  proLockedFeatureKeys = [],
  initialOrderCooldownSeconds,
  initialOperationLogRetentionDays,
  initialKitchenReadyAfterMinutes,
  initialTakeawayVatRate,
  initialSushiRoundOrderingEnabled,
  initialSushiPerPersonPerRoundCap,
  initialSushiRoundConfirmTimeoutSeconds,
  initialSushiRoundCooldownSeconds,
  initialSushiMenuVegetarianFilterEnabled,
  initialSushiMenuAllergenFilterEnabled,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).featureSettings;
  const proBadgeLabel = getMessages(lang).premiumUpgrade.proBadge;
  const [flags, setFlags] = useState(initialFlags);
  const [takeawayCloseConfirmOpen, setTakeawayCloseConfirmOpen] = useState(false);
  const [orderCooldownSeconds, setOrderCooldownSeconds] = useState(initialOrderCooldownSeconds);
  const [operationLogRetentionDays, setOperationLogRetentionDays] = useState(
    initialOperationLogRetentionDays,
  );
  const [kitchenReadyAfterMinutes, setKitchenReadyAfterMinutes] = useState(
    initialKitchenReadyAfterMinutes,
  );
  const [takeawayVatRate, setTakeawayVatRate] = useState(initialTakeawayVatRate);
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
  const [sushiMenuVegetarianFilterEnabled, setSushiMenuVegetarianFilterEnabled] = useState(
    initialSushiMenuVegetarianFilterEnabled,
  );
  const [sushiMenuAllergenFilterEnabled, setSushiMenuAllergenFilterEnabled] = useState(
    initialSushiMenuAllergenFilterEnabled,
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
          flags: Object.fromEntries(
            Object.entries(
              pickRestaurantFeatureFlagsForModules(
                flags,
                groupRestaurantFeaturesForFeatureSettings().map((g) => g.module.id),
              ),
            ).filter(([key]) => !proLockedFeatureKeys.includes(key as RestaurantFeatureKey)),
          ),
          orderCooldownSeconds,
          operationLogRetentionDays,
          kitchenReadyAfterMinutes,
          takeawayVatRate,
          sushiRoundOrderingEnabled,
          sushiPerPersonPerRoundCap,
          sushiRoundConfirmTimeoutSeconds,
          sushiRoundCooldownSeconds,
          sushiMenuVegetarianFilterEnabled,
          sushiMenuAllergenFilterEnabled,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        flags?: ResolvedRestaurantFeatureFlags;
        orderCooldownSeconds?: number;
        operationLogRetentionDays?: number;
        kitchenReadyAfterMinutes?: number;
        takeawayVatRate?: number;
        sushiRoundOrderingEnabled?: boolean;
        sushiPerPersonPerRoundCap?: number;
        sushiRoundConfirmTimeoutSeconds?: number;
        sushiRoundCooldownSeconds?: number;
        sushiMenuVegetarianFilterEnabled?: boolean;
        sushiMenuAllergenFilterEnabled?: boolean;
      };

      if (!res.ok) {
        if (json.error === 'migration_required') setError(t.migrationRequired);
        else if (json.error === 'takeaway_group_has_open_sessions') {
          setError(t.takeawayCloseBlockedOpenSessions);
        } else if (json.error === 'invalid_kitchen_ready_after_minutes') {
          setError(t.kitchenReadyAfterMinutesInvalid);
        } else if (json.error === 'invalid_operation_log_retention_days') {
          setError(t.operationLogRetentionDaysInvalid);
        } else if (json.error === 'invalid_takeaway_vat_rate') {
          setError(t.takeawayVatRateInvalid);
        } else if (json.error?.startsWith('invalid_sushi_')) setError(t.sushiRoundInvalid);
        else setError(t.saveFail);
        return;
      }

      if (json.flags) setFlags(json.flags);
      if (json.orderCooldownSeconds != null) setOrderCooldownSeconds(json.orderCooldownSeconds);
      if (json.operationLogRetentionDays != null) {
        setOperationLogRetentionDays(json.operationLogRetentionDays);
      }
      if (json.kitchenReadyAfterMinutes != null) {
        setKitchenReadyAfterMinutes(json.kitchenReadyAfterMinutes);
      }
      if (json.takeawayVatRate != null) setTakeawayVatRate(json.takeawayVatRate);
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
      if (json.sushiMenuVegetarianFilterEnabled != null) {
        setSushiMenuVegetarianFilterEnabled(json.sushiMenuVegetarianFilterEnabled);
      }
      if (json.sushiMenuAllergenFilterEnabled != null) {
        setSushiMenuAllergenFilterEnabled(json.sushiMenuAllergenFilterEnabled);
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
        {groupRestaurantFeaturesForFeatureSettings().map(({ module, features }) => (
          <section key={module.id}>
            <h2 className="text-sm font-medium text-brand-text mb-2">{t[module.labelKey]}</h2>
            <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
              {features.map((def) => {
                const proLocked = def.premiumKey != null && proLockedFeatureKeys.includes(def.key);
                const parentKey = def.requiresFeatureKey;
                const parentOff =
                  parentKey != null &&
                  (!flags[parentKey] || proLockedFeatureKeys.includes(parentKey));
                const locked = proLocked || parentOff;
                const nested = parentKey != null;
                return (
                <label
                  key={def.key}
                  className={`flex items-start gap-3 px-4 py-4 select-none transition-colors ${
                    nested ? 'pl-8' : ''
                  } ${
                    locked ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-brand-border/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={flags[def.key] && !locked}
                    onChange={(e) => {
                      const key = def.key as RestaurantFeatureKey;
                      const checked = e.target.checked;
                      if (key === 'takeaway_ordering' && !checked && flags.takeaway_ordering) {
                        setTakeawayCloseConfirmOpen(true);
                        return;
                      }
                      setFlags((prev) => {
                        const next = { ...prev, [key]: checked };
                        if (key === 'menu_dish_video_enabled' && !checked) {
                          next.menu_dish_list_video_enabled = false;
                        }
                        return next;
                      });
                    }}
                    className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-brand-text">
                      {t[def.labelKey]}
                      {def.premiumKey ? (
                        <ProFeatureBadge label={proBadgeLabel} />
                      ) : null}
                    </span>
                    <span className="block text-[13px] text-brand-text-muted mt-0.5">
                      {t[def.descKey]}
                    </span>
                    {proLocked && def.premiumKey ? (
                      <Link
                        href={`/dashboard/upgrade?feature=${def.premiumKey}`}
                        className="mt-1 inline-block text-[13px] text-brand-gold underline-offset-4 hover:underline"
                      >
                        {t.proLockedHint}
                      </Link>
                    ) : null}
                  </span>
                </label>
                );
              })}
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
                  min={ORDER_COOLDOWN_SECONDS_MIN}
                  max={ORDER_COOLDOWN_SECONDS_MAX}
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
            <label className="flex items-start gap-3 px-4 py-4 cursor-pointer">
              <input
                type="checkbox"
                checked={sushiMenuVegetarianFilterEnabled}
                onChange={(e) => setSushiMenuVegetarianFilterEnabled(e.target.checked)}
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-brand-text">
                  {t.sushiMenuVegetarianFilterEnabled}
                </span>
                <span className="block text-[13px] text-brand-text-muted mt-0.5">
                  {t.sushiMenuVegetarianFilterEnabledDesc}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 px-4 py-4 cursor-pointer">
              <input
                type="checkbox"
                checked={sushiMenuAllergenFilterEnabled}
                onChange={(e) => setSushiMenuAllergenFilterEnabled(e.target.checked)}
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-brand-text">
                  {t.sushiMenuAllergenFilterEnabled}
                </span>
                <span className="block text-[13px] text-brand-text-muted mt-0.5">
                  {t.sushiMenuAllergenFilterEnabledDesc}
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
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-brand-text mb-2">{t.moduleCheckoutTakeaway}</h2>
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-4">
            <label className="block">
              <span className="block text-[15px] font-medium text-brand-text">
                {t.takeawayVatRate}
              </span>
              <span className="block text-[13px] text-brand-text-muted mt-0.5 mb-3">
                {t.takeawayVatRateDesc}
              </span>
              <div className="flex items-center gap-2">
                <IntegerInput
                  value={takeawayVatRate}
                  min={0}
                  max={100}
                  onChange={setTakeawayVatRate}
                  className={FEATURES_INTEGER_INPUT}
                  aria-label={t.takeawayVatRate}
                />
                <span className="text-[13px] text-brand-text-muted">%</span>
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

      <Modal
        open={takeawayCloseConfirmOpen}
        onClose={() => setTakeawayCloseConfirmOpen(false)}
        title={t.takeawayCloseConfirmTitle}
        size="sm"
      >
        <p className="text-sm text-brand-text-muted mb-4">{t.takeawayCloseConfirmBody}</p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTakeawayCloseConfirmOpen(false)}
          >
            {t.takeawayCloseConfirmCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setFlags((prev) => ({ ...prev, takeaway_ordering: false }));
              setTakeawayCloseConfirmOpen(false);
            }}
          >
            {t.takeawayCloseConfirmOk}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
