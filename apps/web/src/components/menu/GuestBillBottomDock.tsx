'use client';

import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { customerBottomDockSurfaceClass } from '@/lib/customer-menu-bottom-bar-layout';

export type GuestBillCallCheckoutDockAction = {
  label: string;
  /** Appended as「— €x」; omitted when the dock summary already states the amount. */
  amountLabel?: string;
  /** Leading glyph; none when omitted. */
  icon?: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
};

/** By-item claim only: whose bill, how much, how many dishes — beside the one CTA. */
export type GuestBillDockSummary = {
  title: string;
  /** The title is a blocking prompt (name missing) rather than a plain caption. */
  warn: boolean;
  amountLabel: string;
  sub: string;
};

type Props = {
  backHref: string;
  backLabel: string;
  /** Editing bill only — omitted on awaiting/settled (back is the sole dock action). */
  callCheckout?: GuestBillCallCheckoutDockAction | null;
  summary?: GuestBillDockSummary | null;
  gateBanner?: ReactNode;
};

/**
 * Sole guest bill bottom dock: optional「呼叫结账」(primary) then「返回点单」(outline, bottom).
 * Yields while a bill-page text field is focused — sole rule in globals.css via
 * `data-guest-call-checkout-dock`.
 */
export function GuestBillBottomDock({
  backHref,
  backLabel,
  callCheckout = null,
  summary = null,
  gateBanner = null,
}: Props) {
  return (
    <div
      data-guest-call-checkout-dock=""
      className={`${customerBottomDockSurfaceClass} w-full max-w-mobile`}
    >
      <div className="space-y-2 px-4 py-3">
        {gateBanner}
        {callCheckout ? (
          <div className="flex items-center gap-3">
            {summary ? (
              <div className="min-w-0 flex-1" data-guest-dock-summary="">
                <p
                  className={`truncate text-[13px] ${
                    summary.warn ? 'text-red-500 font-semibold' : 'text-brand-text-muted'
                  }`}
                >
                  {summary.title}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold text-brand-text tabular-nums">
                    {summary.amountLabel}
                  </span>
                  <span className="text-[13px] text-brand-text-muted">{summary.sub}</span>
                </p>
              </div>
            ) : null}
            <Button
              className={summary ? 'shrink-0 min-w-[9.75rem]' : 'w-full'}
              size="action"
              onClick={callCheckout.onClick}
              loading={callCheckout.busy}
              disabled={callCheckout.disabled}
            >
              {callCheckout.icon ? `${callCheckout.icon} ` : ''}
              {callCheckout.label}
              {callCheckout.amountLabel ? ` — ${callCheckout.amountLabel}` : ''}
            </Button>
          </div>
        ) : null}
        <ButtonLink variant="outline" size="action" className="w-full" href={backHref}>
          ← {backLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
