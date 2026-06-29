import type { CustomerBillResponse } from '@/lib/request-customer-context';
import type { BillSplit } from '@/types';

export type CheckoutResumedFromBillContext =
  | {
      kind: 'continuation';
      split: BillSplit;
      hasCollectedPayments: boolean;
    }
  | { kind: 'fresh' }
  | { kind: 'unchanged' };

/** Detect whether staff resumed ordering while the guest stays on the checkout success screen. */
export function detectCheckoutResumedFromBillContext(
  ctx: CustomerBillResponse,
): CheckoutResumedFromBillContext {
  if (ctx.active_session?.status === 'open' && ctx.existing_split?.status === 'confirmed') {
    return {
      kind: 'continuation',
      split: ctx.existing_split,
      hasCollectedPayments: ctx.has_collected_payments,
    };
  }
  if (ctx.active_session?.status === 'open' && !ctx.existing_split) {
    return { kind: 'fresh' };
  }
  return { kind: 'unchanged' };
}
