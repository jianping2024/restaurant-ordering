/**
 * Sole staff action: enqueue fiscal auto_issue bill-sync and wait for Agent success.
 * Does NOT close the table (collection / last payment still owns close).
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import type { BillSyncAutoIssueFields } from '@/lib/bill-sync-build-payload';
import { billSyncDocumentTypeForPayment } from '@/lib/bill-sync-payload';
import {
  enqueueStaffBillSync,
  waitUntilStaffBillSyncSettled,
  type StaffBillSyncJob,
} from '@/lib/staff-bill-sync-client';

export type PrintFiscalInvoiceResult =
  | { ok: true; billSplitId: string; tableId: string; job: StaffBillSyncJob; invoiceNo?: string }
  | {
      ok: false;
      code: string;
      message?: string;
      job?: StaffBillSyncJob | null;
    };

export type PrintFiscalInvoiceDeps = {
  enqueue?: typeof enqueueStaffBillSync;
  waitSettled?: typeof waitUntilStaffBillSyncSettled;
  mintRequestId?: () => string;
};

export type PrintFiscalInvoiceInput = {
  restaurantSlug: string;
  billSplitId: string;
  paymentMethod: string;
  customerNif?: string;
  customerName?: string;
  /** Person scope for split invoices; omit for whole_table. */
  issueScopeId?: string;
};

/** Sole orchestration for Farvoo「打印发票」via bill_sync_jobs + Agent auto_issue. */
export async function runStaffPrintFiscalInvoice(
  input: PrintFiscalInvoiceInput,
  options?: PrintFiscalInvoiceDeps,
): Promise<PrintFiscalInvoiceResult> {
  const deps = {
    enqueue: options?.enqueue ?? enqueueStaffBillSync,
    waitSettled: options?.waitSettled ?? waitUntilStaffBillSyncSettled,
    mintRequestId: options?.mintRequestId ?? mintBrowserUuid,
  };

  const billSplitId = input.billSplitId.trim();
  if (!billSplitId) {
    return { ok: false, code: 'missing_bill_split_id' };
  }
  const paymentMethod = input.paymentMethod.trim().toUpperCase();
  if (!paymentMethod) {
    return { ok: false, code: 'missing_payment_method' };
  }

  const document_type = billSyncDocumentTypeForPayment(paymentMethod);
  const autoIssue: BillSyncAutoIssueFields = {
    auto_issue: true,
    payment_method: paymentMethod,
    document_type,
    ...(input.customerNif?.trim() ? { customer_nif: input.customerNif.trim() } : {}),
    ...(input.customerName?.trim() ? { customer_name: input.customerName.trim() } : {}),
    ...(input.issueScopeId?.trim()
      ? { issue_mode: 'person' as const, issue_scope_id: input.issueScopeId.trim() }
      : { issue_mode: 'whole_table' as const }),
  };

  const requestId = deps.mintRequestId();
  const enqueued = await deps.enqueue({
    restaurantSlug: input.restaurantSlug,
    billSplitId,
    requestId,
    autoIssue,
  });
  if (!enqueued.ok) {
    return {
      ok: false,
      code: enqueued.error,
      message: enqueued.message,
      job: enqueued.job ?? null,
    };
  }

  const settledId = enqueued.billSplitId || billSplitId;
  if (enqueued.job.status === 'succeeded') {
    return {
      ok: true,
      billSplitId: settledId,
      tableId: enqueued.tableId,
      job: enqueued.job,
      invoiceNo: enqueued.job.invoice_no ?? undefined,
    };
  }

  const settled = await deps.waitSettled({
    restaurantSlug: input.restaurantSlug,
    billSplitId: settledId,
    requestId: enqueued.job.request_id || requestId,
  });
  if (!settled || settled.status !== 'succeeded') {
    return {
      ok: false,
      code: settled?.error_code || 'invoice_failed',
      message: settled?.error_message || undefined,
      job: settled,
    };
  }
  return {
    ok: true,
    billSplitId: settledId,
    tableId: enqueued.tableId,
    job: settled,
    invoiceNo: settled.invoice_no ?? undefined,
  };
}
