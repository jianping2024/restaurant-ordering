import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, SplitResult } from '@/types';
import { enqueueReceiptPrint } from '@/lib/order-receipt-enqueue';
import { receiptPayerNameForPrint } from '@/lib/receipt-payer-label';

export function normalizeSplitRows(split: BillSplit): SplitResult[] {
  const rows = (split.result || []) as SplitResult[];
  if (rows.length > 0) return rows;
  if (split.total_amount > 0) {
    return [{ name: 'Total', amount: Number(split.total_amount) }];
  }
  return [];
}

export function applyDiscountToRows(rows: SplitResult[], discountRate: number): SplitResult[] {
  const rate = Math.min(100, Math.max(0, discountRate));
  const factor = 1 - rate / 100;
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount) * factor,
  }));
}

export type ConfirmPaymentResult =
  | {
      ok: true;
      all_paid: boolean;
      result: SplitResult[];
      final_amount: number;
    }
  | { ok: false; status: number; code: string; message?: string };

export async function confirmBillSplitPayment(params: {
  admin: SupabaseClient;
  restaurantId: string;
  restaurantName?: string | null;
  printLocale: string | null;
  billSplitId: string;
  personIndex: number;
  discountRate?: number;
  receiptPrinterId?: string;
}): Promise<ConfirmPaymentResult> {
  const {
    admin,
    restaurantId,
    restaurantName,
    printLocale,
    billSplitId,
    personIndex,
    discountRate = 0,
    receiptPrinterId,
  } = params;

  const { data: split, error: loadErr } = await admin
    .from('bill_splits')
    .select('*')
    .eq('id', billSplitId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (loadErr || !split) {
    return { ok: false, status: 404, code: 'bill_split_not_found', message: loadErr?.message };
  }

  const bill = split as BillSplit;
  const baseRows = normalizeSplitRows(bill);
  if (baseRows.length === 0) {
    return { ok: false, status: 400, code: 'empty_split' };
  }

  if (personIndex < 0 || personIndex >= baseRows.length) {
    return { ok: false, status: 400, code: 'invalid_person_index' };
  }

  const discountedRows = applyDiscountToRows(baseRows, discountRate);
  const row = discountedRows[personIndex];
  if (row.paid) {
    return { ok: false, status: 409, code: 'already_paid' };
  }

  const nextResult = discountedRows.map((item, idx) =>
    idx === personIndex ? { ...item, paid: true } : item,
  );
  const allPaid = nextResult.every((item) => !!item.paid);
  const finalAmount = nextResult.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const { error: billErr } = await admin
    .from('bill_splits')
    .update({
      status: allPaid ? 'paid' : 'requested',
      total_amount: allPaid ? finalAmount : bill.total_amount,
      result: nextResult,
    })
    .eq('id', billSplitId);

  if (billErr) {
    return { ok: false, status: 500, code: 'bill_update_failed', message: billErr.message };
  }

  const tableNumber = bill.table_number;
  const sessionId = bill.session_id;

  const printTarget = receiptPrinterId?.trim() || undefined;

  if (sessionId && nextResult.length > 1) {
    await enqueueReceiptPrint({
      admin,
      restaurantId,
      restaurantName,
      printLocale,
      sessionId,
      tableNumber,
      variant: 'split_payment',
      payerName: receiptPayerNameForPrint(row.name, personIndex),
      personAmount: row.amount,
      amountPaid: row.amount,
      paymentMethod: 'Cash',
      billSplitId,
      personIndex,
      receiptPrinterId: printTarget,
    });
  }

  if (allPaid && sessionId) {
    const { error: sessionErr } = await admin
      .from('table_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionErr) {
      return { ok: false, status: 500, code: 'session_close_failed', message: sessionErr.message };
    }

    await enqueueReceiptPrint({
      admin,
      restaurantId,
      restaurantName,
      printLocale,
      sessionId,
      tableNumber,
      variant: 'final',
      amountPaid: finalAmount,
      paymentMethod: 'Cash',
      receiptPrinterId: printTarget,
    });
  }

  return { ok: true, all_paid: allPaid, result: nextResult, final_amount: finalAmount };
}
