'use client';

import type { BuffetServiceMode } from '@mesa/shared';
import type { getMessages } from '@/lib/i18n/messages';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  t: BuffetAdminMessages;
  mode: BuffetServiceMode;
  embedded?: boolean;
};

/** Read-only: buffet_service_mode is set only via Ops (create / restaurant edit). */
export function BuffetServiceModePanel({ t, mode, embedded = false }: Props) {
  const shellClass = embedded
    ? 'border-b border-brand-border/60 bg-brand-bg/30 px-4 sm:px-5 py-3'
    : 'rounded-2xl border border-brand-border/80 bg-brand-card shadow-sm px-4 sm:px-5 py-3.5';

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-brand-text">{t.serviceModeTitle}</h2>
          <p className="text-[11px] text-brand-text-muted mt-1 leading-snug">
            {t.serviceModeOpsOnlyHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`flex items-center gap-2 text-[13px] whitespace-nowrap rounded-lg border px-3 py-1.5 ${
              mode === 'classic'
                ? 'border-brand-gold/50 bg-brand-gold/10 text-brand-text'
                : 'border-brand-border text-brand-text-muted'
            }`}
            aria-current={mode === 'classic' ? 'true' : undefined}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                mode === 'classic'
                  ? 'border-brand-gold bg-brand-gold'
                  : 'border-brand-border bg-transparent'
              }`}
              aria-hidden
            />
            {t.serviceModeClassic}
          </span>
          <span
            className={`flex items-center gap-2 text-[13px] whitespace-nowrap rounded-lg border px-3 py-1.5 ${
              mode === 'sushi'
                ? 'border-brand-gold/50 bg-brand-gold/10 text-brand-text'
                : 'border-brand-border text-brand-text-muted'
            }`}
            aria-current={mode === 'sushi' ? 'true' : undefined}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                mode === 'sushi'
                  ? 'border-brand-gold bg-brand-gold'
                  : 'border-brand-border bg-transparent'
              }`}
              aria-hidden
            />
            {t.serviceModeSushi}
          </span>
        </div>
      </div>
    </div>
  );
}
