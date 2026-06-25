import type { SplitMode, SplitPerson, SplitResult } from '@/types';

export type CheckoutRequestPayload = {
  splitMode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  customerNif?: string | null;
};

export function wholeTableCheckoutPayload(
  total: number,
  payerLabel: string,
): CheckoutRequestPayload {
  const name = payerLabel.trim().slice(0, 80) || 'Table';
  return {
    splitMode: 'custom',
    persons: [{ name }],
    result: [{ name, amount: total }],
    customerNif: null,
  };
}
