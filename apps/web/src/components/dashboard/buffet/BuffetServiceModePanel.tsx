'use client';

import type { BuffetServiceMode } from '@/lib/buffet-service-mode';
import type { getMessages } from '@/lib/i18n/messages';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  t: BuffetAdminMessages;
  mode: BuffetServiceMode;
  saving: boolean;
  embedded?: boolean;
  onSave: (mode: BuffetServiceMode) => void;
};

export function BuffetServiceModePanel({
  t,
  mode,
  saving,
  embedded = false,
  onSave,
}: Props) {
  const shellClass = embedded
    ? 'border-b border-brand-border/60 bg-brand-bg/30 px-4 sm:px-5 py-3'
    : 'rounded-2xl border border-brand-border/80 bg-brand-card shadow-sm px-4 sm:px-5 py-3.5';

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-brand-text">{t.serviceModeTitle}</h2>
          <p className="text-[11px] text-brand-text-muted mt-1 leading-snug">
            {t.serviceModeHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-[13px] text-brand-text cursor-pointer whitespace-nowrap rounded-lg border border-brand-border px-3 py-1.5 has-[:checked]:border-brand-gold/50 has-[:checked]:bg-brand-gold/10">
            <input
              type="radio"
              name="buffet-service-mode"
              className="text-brand-gold focus:ring-brand-gold/40"
              checked={mode === 'classic'}
              disabled={saving}
              onChange={() => onSave('classic')}
            />
            {t.serviceModeClassic}
          </label>
          <label className="flex items-center gap-2 text-[13px] text-brand-text cursor-pointer whitespace-nowrap rounded-lg border border-brand-border px-3 py-1.5 has-[:checked]:border-brand-gold/50 has-[:checked]:bg-brand-gold/10">
            <input
              type="radio"
              name="buffet-service-mode"
              className="text-brand-gold focus:ring-brand-gold/40"
              checked={mode === 'sushi'}
              disabled={saving}
              onChange={() => onSave('sushi')}
            />
            {t.serviceModeSushi}
          </label>
          {saving ? (
            <span className="text-[12px] text-brand-text-muted px-2">{t.saving}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
