import { WHOLE_TABLE_PAYER_KEY } from '@/lib/split-person-label';
import type { SplitMode, SplitPerson, SplitResult } from '@/types';

export type CheckoutRequestPayload = {
  splitMode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  customerNif?: string | null;
};

export function wholeTableCheckoutPayload(total: number): CheckoutRequestPayload {
  const name = WHOLE_TABLE_PAYER_KEY;
  return {
    splitMode: 'custom',
    persons: [{ name }],
    result: [{ name, amount: total }],
    customerNif: null,
  };
}
