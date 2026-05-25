'use client';

import { Button } from '@/components/ui/Button';
import { TimeHmInput } from '@/components/ui/TimeHmInput';
import type { getMessages } from '@/lib/i18n/messages';
import { dbTimeToHm, hmToDbTime } from '@/lib/buffet-pricing-admin';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  t: BuffetAdminMessages;
  enabled: boolean;
  draftFrom: string;
  savedFrom: string | null;
  saving: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onDraftFromChange: (value: string) => void;
  onSave: () => void;
};

export function BuffetFridayWeekendPanel({
  t,
  enabled,
  draftFrom,
  savedFrom,
  saving,
  onEnabledChange,
  onDraftFromChange,
  onSave,
}: Props) {
  const savedHm = savedFrom ? dbTimeToHm(savedFrom) : '';
  const pendingDb = enabled ? hmToDbTime(draftFrom) : null;
  const isDirty = enabled !== !!savedFrom || (enabled && pendingDb !== savedFrom);

  let statusLabel: string;
  let statusClass: string;
  if (isDirty) {
    statusLabel = enabled
      ? t.fridayWeekendStatusPending.replace('{time}', draftFrom || '—')
      : t.fridayWeekendStatusPendingOff;
    statusClass = 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  } else if (savedHm) {
    statusLabel = t.fridayWeekendStatusActiveShort.replace('{time}', savedHm);
    statusClass = 'border-brand-gold/40 bg-brand-gold/12 text-brand-gold';
  } else {
    statusLabel = t.fridayWeekendStatusOffShort;
    statusClass = 'border-brand-border bg-brand-bg/60 text-brand-text-muted';
  }

  return (
    <div className="rounded-xl border border-brand-border/70 bg-brand-bg/40 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-brand-text">{t.fridayWeekendTitle}</h2>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] text-brand-text-muted mt-1 leading-snug">{t.fridayWeekendHintShort}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
          <label className="flex items-center gap-2 text-[13px] text-brand-text cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              className="rounded border-brand-border"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
            {t.fridayWeekendEnable}
          </label>
          {enabled && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-brand-text-muted whitespace-nowrap">{t.fridayWeekendFrom}</span>
              <TimeHmInput value={draftFrom} onChange={onDraftFromChange} className="!max-w-[5.5rem]" />
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="gold"
            loading={saving}
            disabled={!isDirty || (enabled && !hmToDbTime(draftFrom))}
            onClick={onSave}
          >
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
