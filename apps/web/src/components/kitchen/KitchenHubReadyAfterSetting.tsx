'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { showToast } from '@/components/ui/Toast';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { UILanguage } from '@/lib/i18n';
import {
  KITCHEN_READY_AFTER_MINUTES_MAX,
  KITCHEN_READY_AFTER_MINUTES_MIN,
} from '@/lib/print-agent-config';

type Props = {
  restaurantSlug: string;
  lang: UILanguage;
  initialMinutes: number;
};

export function KitchenHubReadyAfterSetting({ restaurantSlug, lang, initialMinutes }: Props) {
  const t = KITCHEN_SCREEN_TEXT[lang];
  const [minutes, setMinutes] = useState(initialMinutes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurantSlug)}/staff/kitchen/settings`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kitchen_ready_after_minutes: minutes }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        kitchen_ready_after_minutes?: number;
        error?: string;
      };
      if (!res.ok) {
        showToast(t.readyAfterMinutesSaveFail, 'error');
        return;
      }
      if (typeof json.kitchen_ready_after_minutes === 'number') {
        setMinutes(json.kitchen_ready_after_minutes);
      }
      showToast(t.readyAfterMinutesSaved, 'success');
    } catch {
      showToast(t.readyAfterMinutesSaveFail, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-brand-border bg-brand-card px-4 py-4">
      <p className="text-lg font-medium text-brand-text">{t.readyAfterMinutesLabel}</p>
      <p className="mt-1 text-sm text-brand-text-muted">{t.readyAfterMinutesHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <IntegerInput
          value={minutes}
          min={KITCHEN_READY_AFTER_MINUTES_MIN}
          max={KITCHEN_READY_AFTER_MINUTES_MAX}
          onChange={setMinutes}
          className="w-24 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text tabular-nums"
          aria-label={t.readyAfterMinutesLabel}
        />
        <span className="text-sm text-brand-text-muted">{t.readyAfterMinutesUnit}</span>
        <Button type="button" onClick={() => void handleSave()} loading={saving}>
          {t.readyAfterMinutesSave}
        </Button>
      </div>
    </section>
  );
}
