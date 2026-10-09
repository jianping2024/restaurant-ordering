'use client';

import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { customerBottomDockSurfaceClass } from '@/lib/customer-menu-bottom-bar-layout';

export type GuestBillCallCheckoutDockAction = {
  label: string;
  amountLabel: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
};

type Props = {
  backHref: string;
  backLabel: string;
  /** Editing bill only — omitted on awaiting/settled (back is the sole dock action). */
  callCheckout?: GuestBillCallCheckoutDockAction | null;
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
          <Button
            className="w-full"
            size="action"
            onClick={callCheckout.onClick}
            loading={callCheckout.busy}
            disabled={callCheckout.disabled}
          >
            🔔 {callCheckout.label} — {callCheckout.amountLabel}
          </Button>
        ) : null}
        <ButtonLink variant="outline" size="action" className="w-full" href={backHref}>
          ← {backLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
