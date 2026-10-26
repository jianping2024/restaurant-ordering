'use client';

import type { Language } from '@/types';
import type { SushiSendGuidance } from '@/lib/table-order-round/send-guidance';
import {
  SUSHI_ROUND_MESSAGES,
  formatSushiSendGuidanceMessage,
} from '@/lib/i18n/sushi-round-messages';
import { customerMenuBottomBarGuidanceClass } from '@/lib/customer-menu-bottom-bar-layout';

type StepState = 'done' | 'current';

const NOTICE_TONE_CLASS: Record<SushiSendGuidance['kind'], string> = {
  unsent: 'mesa-alert-warning',
  countdown: 'mesa-alert-warning',
  failed: 'mesa-alert-danger',
  sent: 'mesa-alert-success',
};

/**
 * Sole guidance notice line (footer strip + round review sheet). Not a live
 * region: the countdown re-renders every second and would spam screen readers.
 */
export function SushiSendGuidanceNotice({
  guidance,
  lang,
  className = '',
}: {
  guidance: SushiSendGuidance;
  lang: Language;
  className?: string;
}) {
  return (
    <p
      className={`flex h-8 min-w-0 items-center truncate px-3 text-[13px] font-semibold tabular-nums ${NOTICE_TONE_CLASS[guidance.kind]} ${className}`}
    >
      <span className="truncate">{formatSushiSendGuidanceMessage(guidance, SUSHI_ROUND_MESSAGES[lang])}</span>
    </p>
  );
}

function StepDot({ state, mark }: { state: StepState; mark: string }) {
  return state === 'done' ? (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[11px] font-bold text-brand-on-gold"
    >
      ✓
    </span>
  ) : (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand-gold text-[11px] font-bold text-brand-gold"
    >
      {mark}
    </span>
  );
}

function Step({ state, mark, label }: { state: StepState; mark: string; label: string }) {
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-1.5">
      <StepDot state={state} mark={mark} />
      <span
        className={`truncate text-[12px] tabular-nums ${
          state === 'current' ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
        }`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Sole sushi footer guidance strip: 加入本轮 → 送厨 steps + one notice line.
 * Mounted only inside the footer dock (`data-mesa-bottom-dock-guidance` lifts
 * scroll pad + toasts via `--mesa-bottom-dock-extra`).
 */
export function SushiSendGuidanceStrip({
  guidance,
  lang,
}: {
  guidance: SushiSendGuidance;
  lang: Language;
}) {
  const t = SUSHI_ROUND_MESSAGES[lang];
  const sent = guidance.kind === 'sent';
  const sendLabel =
    guidance.kind === 'countdown'
      ? `${guidance.seconds}s`
      : sent
        ? t.guidanceStepSent
        : t.guidanceStepSend;
  const sendMark = guidance.kind === 'countdown' ? '…' : guidance.kind === 'failed' ? '!' : '2';

  return (
    <div className={customerMenuBottomBarGuidanceClass} data-mesa-bottom-dock-guidance="">
      <div className="flex h-6 min-w-0 items-center gap-2" aria-hidden>
        <Step state="done" mark="1" label={t.guidanceStepJoin} />
        <span className="h-0.5 w-8 shrink-0 rounded-full bg-brand-gold sm:w-12" />
        <Step state={sent ? 'done' : 'current'} mark={sendMark} label={sendLabel} />
      </div>
      <SushiSendGuidanceNotice guidance={guidance} lang={lang} />
    </div>
  );
}
