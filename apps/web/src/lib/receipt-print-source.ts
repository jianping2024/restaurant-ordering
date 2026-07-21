import type { ReceiptPrintSource } from '@/lib/order-receipt-enqueue';

/**
 * Intent from who authenticated the print request — not from receipt_variant.
 * Staff checkout auth → staff_manual (ungated); guest / unauthenticated paths → automatic.
 */
export function resolveReceiptPrintSource(hasStaffCheckoutAuth: boolean): ReceiptPrintSource {
  return hasStaffCheckoutAuth ? 'staff_manual' : 'automatic';
}
