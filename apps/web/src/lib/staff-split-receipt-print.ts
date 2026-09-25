import {
  requestOrderReceiptPrint,
  type OrderReceiptPrintResult,
} from '@/lib/request-order-receipt-print';
import { receiptPaymentMethodLabel } from '@/lib/bill-sync-payload';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { StaffCheckoutBillPrintTarget } from '@/lib/staff-checkout-bill-print';

/** Manual split_payment receipt — same path as dashboard checkout; not gated by bill_receipt_print. */
export async function requestStaffSplitReceiptPrint(params: {
  slug: string;
  billSplit: StaffCheckoutBillPrintTarget;
  payment: SessionCollectedPayment;
  /** Live cash tender. Omit on ledger reprint so the sheet shows the obligation. */
  amountPaid?: number;
  /** Whole-table collect prints one final sheet. Split modes stay split_payment. */
  receiptVariant?: 'split_payment' | 'final';
}): Promise<OrderReceiptPrintResult> {
  const { slug, billSplit, payment, amountPaid, receiptVariant = 'split_payment' } = params;
  if (payment.person_index == null || payment.person_index < 0) {
    return { ok: false, error: 'invalid_person_index' };
  }
  return requestOrderReceiptPrint({
    slug,
    tableId: billSplit.table_id,
    sessionId: billSplit.session_id ?? undefined,
    billSplitId: billSplit.id,
    receiptVariant,
    personIndex: payment.person_index,
    payerName: payment.person_name,
    personAmount: payment.amount,
    amountPaid: amountPaid ?? payment.amount,
    paymentMethod: receiptPaymentMethodLabel(payment.payment_method),
    collectedPaymentId: payment.id,
  });
}
