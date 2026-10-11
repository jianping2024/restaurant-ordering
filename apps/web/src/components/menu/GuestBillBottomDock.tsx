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

/** By-item claim only: one row above the CTA — whose bill · how many dishes, amount right. */
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
          <>
            {summary ? (
              <div className="flex items-baseline gap-3" data-guest-dock-summary="">
                <p className="min-w-0 flex-1 truncate text-[13px]">
                  <span
                    className={
                      summary.warn ? 'text-red-500 font-semibold' : 'text-brand-text-muted'
                    }
                  >
                    {summary.title}
                  </span>
                  <span className="text-brand-text-muted"> · {summary.sub}</span>
                </p>
                <span className="shrink-0 text-[22px] font-semibold leading-none text-brand-text tabular-nums">
                  {summary.amountLabel}
                </span>
              </div>
            ) : null}
            <Button
              className="w-full"
              size="action"
              onClick={callCheckout.onClick}
              loading={callCheckout.busy}
              disabled={callCheckout.disabled}
            >
              {callCheckout.icon ? `${callCheckout.icon} ` : ''}
              {callCheckout.label}
              {callCheckout.amountLabel ? ` — ${callCheckout.amountLabel}` : ''}
            </Button>
          </>
        ) : null}
        <ButtonLink variant="outline" size="action" className="w-full" href={backHref}>
          ← {backLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
