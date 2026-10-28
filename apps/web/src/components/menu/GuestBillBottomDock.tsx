'use client';

import { type ReactNode, useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { customerBottomDockSurfaceClass } from '@/lib/customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from '@/lib/customer-menu-chrome-layout';

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
 * `data-guest-call-checkout-dock`. iOS keyboard-dismiss (Safari ✓ bar / hide-keyboard
 * icon) only blurs the window and leaves the field as `activeElement`; the next touch
 * refocuses the window, `:focus` matches again and the dock vanishes under the finger.
 * So window blur also blurs that field — the one place the rule's focus stays truthful.
 */
export function GuestBillBottomDock({
  backHref,
  backLabel,
  callCheckout = null,
  summary = null,
  gateBanner = null,
}: Props) {
  useEffect(() => {
    const blurBillTextField = () => {
      const el = document.activeElement;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.closest('[data-guest-bill-page]')
      ) {
        el.blur();
      }
    };
    window.addEventListener('blur', blurBillTextField);
    return () => window.removeEventListener('blur', blurBillTextField);
  }, []);

  return (
    <div
      data-guest-call-checkout-dock=""
      className={`${customerBottomDockSurfaceClass} ${CUSTOMER_MENU_SHELL_WIDTH_CLASS}`}
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
