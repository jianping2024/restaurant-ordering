import {
  parseSessionCollectedPayments,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { CustomerBillResponse } from '@/lib/request-customer-context';
import type { BillSplit } from '@/types';

export type CheckoutResumedFromBillContext =
  | {
      kind: 'continuation';
      split: BillSplit;
      collectedPayments: SessionCollectedPayment[];
    }
  | { kind: 'fresh' }
  | { kind: 'unchanged' };

export function collectedPaymentsFromBillContext(
  ctx: CustomerBillResponse,
): SessionCollectedPayment[] {
  return parseSessionCollectedPayments(ctx.collected_payments);
}

/** Detect whether staff resumed ordering while the guest stays on the checkout success screen. */
export function detectCheckoutResumedFromBillContext(
  ctx: CustomerBillResponse,
): CheckoutResumedFromBillContext {
  if (ctx.active_session?.status === 'open' && ctx.existing_split?.status === 'confirmed') {
    return {
      kind: 'continuation',
      split: ctx.existing_split,
      collectedPayments: collectedPaymentsFromBillContext(ctx),
    };
  }
  if (ctx.active_session?.status === 'open' && !ctx.existing_split) {
    return { kind: 'fresh' };
  }
  return { kind: 'unchanged' };
}
