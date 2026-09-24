import { mintBrowserUuid } from '@/lib/browser-uuid';

export type StaffBillSyncJob = {
  id: string;
  status: string;
  request_id?: string;
  error_code?: string | null;
  error_message?: string | null;
  content_fingerprint?: string | null;
  invoice_no?: string | null;
  document_id?: string | null;
};

export type StaffBillSyncIssued = {
  document_id: string;
  invoice_no: string | null;
};

export type StaffBillSyncStatus = {
  job: StaffBillSyncJob | null;
  content_unchanged: boolean;
  available: boolean;
  status: number;
  error?: string;
  message?: string;
  /** Sole cloud copy of issued fiscal doc for sale + optional person scope. */
  issued?: StaffBillSyncIssued | null;
};

/** Sole GET for bill-sync latest job + content_unchanged + issued document. */
export async function fetchStaffBillSyncStatus(input: {
  restaurantSlug: string;
  billSplitId: string;
  issueScopeId?: string;
}): Promise<StaffBillSyncStatus> {
  const qs = new URLSearchParams({
    source_sale_id: input.billSplitId,
  });
  if (input.issueScopeId?.trim()) qs.set('issue_scope_id', input.issueScopeId.trim());
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/bill-syncs?${qs}`,
    { credentials: 'include' },
  );
  if (res.status === 403) {
    return { job: null, content_unchanged: false, available: false, status: 403, issued: null };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    return {
      job: null,
      content_unchanged: false,
      available: true,
      status: res.status,
      error: data.error,
      message: data.message,
      issued: null,
    };
  }
  const data = (await res.json()) as {
    job?: StaffBillSyncJob | null;
    content_unchanged?: boolean;
    issued?: StaffBillSyncIssued | null;
  };
  return {
    job: data.job ?? null,
    content_unchanged: data.content_unchanged === true,
    available: true,
    status: res.status,
    issued: data.issued ?? null,
  };
}

export type EnqueueStaffBillSyncResult =
  | {
      ok: true;
      job: StaffBillSyncJob;
      billSplitId: string;
      tableId: string;
      reused?: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message?: string;
      job?: StaffBillSyncJob | null;
      available?: boolean;
    };

/** Sole POST for fiscal bill-sync enqueue (issue or reprint on same pipe). */
export async function enqueueStaffBillSync(input: {
  restaurantSlug: string;
  billSplitId?: string;
  tableId?: string;
  requestId?: string;
  autoIssue?: {
    auto_issue: true;
    customer_nif?: string;
    customer_name?: string;
    payment_method: string;
    document_type?: 'FT' | 'FS';
    issue_mode?: 'whole_table' | 'person';
    issue_scope_id?: string;
  } | null;
  /** When set, Agent only reprints (existing ReprintDocument). */
  reprintDocumentId?: string;
  issueScopeId?: string;
}): Promise<EnqueueStaffBillSyncResult> {
  const requestId = input.requestId?.trim() || mintBrowserUuid();
  const body: Record<string, unknown> = { request_id: requestId };
  if (input.billSplitId?.trim()) body.bill_split_id = input.billSplitId.trim();
  if (input.tableId?.trim()) body.table_id = input.tableId.trim();
  if (input.reprintDocumentId?.trim()) {
    body.reprint_document_id = input.reprintDocumentId.trim();
    if (input.issueScopeId?.trim()) body.issue_scope_id = input.issueScopeId.trim();
  } else if (input.autoIssue?.auto_issue) {
    body.auto_issue = true;
    body.payment_method = input.autoIssue.payment_method;
    if (input.autoIssue.document_type) body.document_type = input.autoIssue.document_type;
    if (input.autoIssue.customer_nif) body.customer_nif = input.autoIssue.customer_nif;
    if (input.autoIssue.customer_name) body.customer_name = input.autoIssue.customer_name;
    if (input.autoIssue.issue_mode) body.issue_mode = input.autoIssue.issue_mode;
    if (input.autoIssue.issue_scope_id) body.issue_scope_id = input.autoIssue.issue_scope_id;
  }

  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/bill-syncs`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    job?: StaffBillSyncJob;
    bill_split_id?: string;
    table_id?: string;
    reused?: string | null;
  };

  if (res.status === 403) {
    return {
      ok: false,
      status: 403,
      error: data.error ?? 'forbidden',
      message: data.message,
      available: false,
    };
  }
  if (res.status === 409 && data.error === 'already_synced') {
    return {
      ok: true,
      job: data.job ?? {
        id: '',
        status: 'succeeded',
        request_id: requestId,
      },
      billSplitId: data.bill_split_id ?? input.billSplitId?.trim() ?? '',
      tableId: data.table_id ?? input.tableId?.trim() ?? '',
      reused: 'already_synced',
    };
  }
  if (!res.ok || !data.job) {
    return {
      ok: false,
      status: res.status,
      error: data.error ?? 'sync_failed',
      message: data.message,
      job: data.job ?? null,
    };
  }
  return {
    ok: true,
    job: data.job,
    billSplitId: data.bill_split_id ?? input.billSplitId?.trim() ?? '',
    tableId: data.table_id ?? input.tableId?.trim() ?? '',
    reused: data.reused ?? null,
  };
}

/** Wait until job for requestId is succeeded/failed (lifecycle one-shots, not product polling). */
export async function waitUntilStaffBillSyncSettled(input: {
  restaurantSlug: string;
  billSplitId: string;
  requestId: string;
  refresh?: () => Promise<StaffBillSyncStatus>;
}): Promise<StaffBillSyncJob | null> {
  const refresh =
    input.refresh ??
    (() =>
      fetchStaffBillSyncStatus({
        restaurantSlug: input.restaurantSlug,
        billSplitId: input.billSplitId,
      }));

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 400 + i * 150));
    const latest = await refresh();
    const job = latest.job;
    if (!job) continue;
    if (job.request_id && job.request_id !== input.requestId) continue;
    if (job.status === 'succeeded' || job.status === 'failed') return job;
  }
  return null;
}
