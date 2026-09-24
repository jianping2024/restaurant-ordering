/**
 * Sole staff action: print fiscal invoice — auto-issue when not yet issued, else reprint.
 * Does NOT close the table. Reuses bill_sync_jobs + Agent IssueFromBillDraft / ReprintDocument.
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import type { BillSyncAutoIssueFields } from '@/lib/bill-sync-build-payload';
import { billSyncDocumentTypeForPayment } from '@/lib/bill-sync-payload';
import {
  enqueueStaffBillSync,
  fetchStaffBillSyncStatus,
  waitUntilStaffBillSyncSettled,
  type StaffBillSyncJob,
} from '@/lib/staff-bill-sync-client';

export type PrintFiscalInvoiceResult =
  | {
      ok: true;
      billSplitId: string;
      tableId: string;
      job: StaffBillSyncJob;
      invoiceNo?: string;
      mode: 'issue' | 'reprint';
    }
  | {
      ok: false;
      code: string;
      message?: string;
      job?: StaffBillSyncJob | null;
    };

export type PrintFiscalInvoiceDeps = {
  enqueue?: typeof enqueueStaffBillSync;
  waitSettled?: typeof waitUntilStaffBillSyncSettled;
  fetchStatus?: typeof fetchStaffBillSyncStatus;
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

export type ReprintFiscalInvoiceInput = {
  restaurantSlug: string;
  billSplitId: string;
  documentId: string;
  issueScopeId?: string;
};

/** Sole probe: cloud copy of issued fiscal doc for this sale + scope (null → need issue modal). */
export async function fetchIssuedFiscalDocumentForPrint(input: {
  restaurantSlug: string;
  billSplitId: string;
  issueScopeId?: string;
  fetchStatus?: typeof fetchStaffBillSyncStatus;
}): Promise<{ documentId: string; invoiceNo: string | null } | null> {
  const fetchStatus = input.fetchStatus ?? fetchStaffBillSyncStatus;
  const status = await fetchStatus({
    restaurantSlug: input.restaurantSlug,
    billSplitId: input.billSplitId,
    issueScopeId: input.issueScopeId,
  });
  const issued = status.issued;
  if (!issued?.document_id?.trim()) return null;
  return {
    documentId: issued.document_id.trim(),
    invoiceNo: issued.invoice_no?.trim() || null,
  };
}

/** Sole orchestration for Farvoo「打印发票」first issue via bill_sync auto_issue. */
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

  return settlePrintJob({
    deps,
    restaurantSlug: input.restaurantSlug,
    billSplitId: enqueued.billSplitId || billSplitId,
    tableId: enqueued.tableId,
    requestId: enqueued.job.request_id || requestId,
    enqueuedJob: enqueued.job,
    mode: 'issue',
  });
}

/** Sole orchestration for Farvoo「打印发票」reprint via bill_sync reprint_document_id. */
export async function runStaffReprintFiscalInvoice(
  input: ReprintFiscalInvoiceInput,
  options?: PrintFiscalInvoiceDeps,
): Promise<PrintFiscalInvoiceResult> {
  const deps = {
    enqueue: options?.enqueue ?? enqueueStaffBillSync,
    waitSettled: options?.waitSettled ?? waitUntilStaffBillSyncSettled,
    mintRequestId: options?.mintRequestId ?? mintBrowserUuid,
  };

  const billSplitId = input.billSplitId.trim();
  const documentId = input.documentId.trim();
  if (!billSplitId) return { ok: false, code: 'missing_bill_split_id' };
  if (!documentId) return { ok: false, code: 'missing_document_id' };

  const requestId = deps.mintRequestId();
  const enqueued = await deps.enqueue({
    restaurantSlug: input.restaurantSlug,
    billSplitId,
    requestId,
    reprintDocumentId: documentId,
    issueScopeId: input.issueScopeId,
  });
  if (!enqueued.ok) {
    return {
      ok: false,
      code: enqueued.error,
      message: enqueued.message,
      job: enqueued.job ?? null,
    };
  }

  return settlePrintJob({
    deps,
    restaurantSlug: input.restaurantSlug,
    billSplitId: enqueued.billSplitId || billSplitId,
    tableId: enqueued.tableId,
    requestId: enqueued.job.request_id || requestId,
    enqueuedJob: enqueued.job,
    mode: 'reprint',
  });
}

async function settlePrintJob(params: {
  deps: Required<Pick<PrintFiscalInvoiceDeps, 'waitSettled'>> & {
    enqueue: typeof enqueueStaffBillSync;
    mintRequestId: () => string;
  };
  restaurantSlug: string;
  billSplitId: string;
  tableId: string;
  requestId: string;
  enqueuedJob: StaffBillSyncJob;
  mode: 'issue' | 'reprint';
}): Promise<PrintFiscalInvoiceResult> {
  const { deps, restaurantSlug, billSplitId, tableId, requestId, enqueuedJob, mode } = params;
  if (enqueuedJob.status === 'succeeded') {
    return {
      ok: true,
      billSplitId,
      tableId,
      job: enqueuedJob,
      invoiceNo: enqueuedJob.invoice_no ?? undefined,
      mode,
    };
  }

  const settled = await deps.waitSettled({
    restaurantSlug,
    billSplitId,
    requestId,
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
    billSplitId,
    tableId,
    job: settled,
    invoiceNo: settled.invoice_no ?? undefined,
    mode,
  };
}
