/**
 * Sole cloud lookup: has this bill_split (+ optional person scope) already got a fiscal document_id?
 * Source of truth for 「打印发票」issue vs reprint branch (ack-persisted on bill_sync_jobs).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSyncPayload } from '@/lib/bill-sync-payload';

export type IssuedFiscalDocument = {
  documentId: string;
  invoiceNo: string | null;
  jobId: string;
};

function payloadMatchesIssueScope(
  payload: BillSyncPayload | null | undefined,
  issueScopeId: string | undefined,
): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const scope = (payload.issue_scope_id ?? payload.scope_id ?? '').trim();
  const want = (issueScopeId ?? '').trim();
  if (!want) {
    // Whole-table / no person scope: only match jobs that did not target a person.
    const mode = (payload.issue_mode ?? '').trim();
    if (mode === 'person') return false;
    return !scope;
  }
  return scope === want;
}

/** Sole server query for issued fiscal doc copy for a sale + optional person scope. */
export async function loadIssuedFiscalDocument(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sourceSaleId: string;
  /** Person scope id; omit/empty = whole_table issue. */
  issueScopeId?: string | null;
}): Promise<IssuedFiscalDocument | null> {
  const saleId = params.sourceSaleId.trim();
  if (!saleId) return null;

  const { data, error } = await params.admin
    .from('bill_sync_jobs')
    .select('id, document_id, invoice_no, payload')
    .eq('restaurant_id', params.restaurantId)
    .eq('source_sale_id', saleId)
    .eq('status', 'succeeded')
    .not('document_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data?.length) return null;

  const wantScope = params.issueScopeId?.trim() || undefined;
  for (const row of data) {
    const docId = typeof row.document_id === 'string' ? row.document_id.trim() : '';
    if (!docId) continue;
    const payload = row.payload as BillSyncPayload | null;
    if (!payloadMatchesIssueScope(payload, wantScope)) continue;
    return {
      documentId: docId,
      invoiceNo: typeof row.invoice_no === 'string' && row.invoice_no.trim() ? row.invoice_no.trim() : null,
      jobId: row.id,
    };
  }
  return null;
}
