import type { getMessages } from '@/lib/i18n/messages';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];

export function resolveBillPrintButtonLabel(
  checkoutT: CheckoutT,
  busy: boolean,
  cooldownSeconds: number,
): string {
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
