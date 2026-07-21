import type { getMessages } from '@/lib/i18n/messages';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];

export function resolveBillPrintButtonLabel(
  billSplit: OrderHistoryBillSplitSummary | undefined,
  checkoutT: CheckoutT,
  busy: boolean,
  cooldownSeconds: number,
): string {
  if (!billSplit) return checkoutT.printBill;
  if (busy) return checkoutT.printBillOperating;
  if (cooldownSeconds > 0) {
    return checkoutT.printBillCooldown.replace('{n}', String(cooldownSeconds));
  }
  return checkoutT.printBill;
}

export function resolveSplitReceiptPrintLabel(
  checkoutT: CheckoutT,
  busy: boolean,
  cooldownSeconds: number,
): string {
  if (busy) return checkoutT.printReceiptOperating;
  if (cooldownSeconds > 0) {
    return checkoutT.printReceiptCooldown.replace('{n}', String(cooldownSeconds));
  }
  return checkoutT.printReceipt;
}
