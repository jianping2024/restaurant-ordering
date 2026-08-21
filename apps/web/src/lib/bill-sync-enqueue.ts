import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { billSyncContentFingerprint } from '@/lib/bill-sync-content-fingerprint';
import { buildBillSyncJobPayload } from '@/lib/bill-sync-build-payload';
import type { BillSyncPayload } from '@/lib/bill-sync-payload';
import { parseSplitMode } from '@/lib/checkout-split-intent';
import type { Order, SplitPerson } from '@/types';

export type EnqueueBillSyncInput = {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  tableDisplayName: string;
  /** Persisted bill_splits.split_mode; drives whole_table vs split payload. */
  splitMode: string | null | undefined;
  persons: SplitPerson[] | null | undefined;
  orders: Order[];
  itemCodeByMenuId: Record<string, string>;
  vatRateByMenuId: Record<string, number>;
  /** Default VAT when menu id missing (buffet synthetic). */
  defaultVatRatePercent: number;
  createdBy: string | null;
  requestId?: string;
};

export type BillSyncJobRef = {
  id: string;
  status: string;
  request_id: string;
  content_fingerprint: string;
};

export type EnqueueBillSyncResult =
  | { ok: true; job: BillSyncJobRef; reused?: 'request_id' | 'in_flight' }
  | {
      ok: false;
      error: string;
      status: number;
      message?: string;
      job?: BillSyncJobRef;
    };

type JobRow = {
  id: string;
  status: string;
  request_id: string;
  payload: BillSyncPayload | null;
};

function jobRef(row: JobRow, fingerprint?: string): BillSyncJobRef {
  const content_fingerprint =
    fingerprint ??
    (row.payload ? billSyncContentFingerprint(row.payload) : '');
  return {
    id: row.id,
    status: row.status,
    request_id: row.request_id,
    content_fingerprint,
  };
}

/**
 * Sole server enqueue for fiscal bill-sync jobs.
 * Payload shape from {@link buildBillSyncJobPayload} only.
 */
export async function enqueueBillSyncJob(
  input: EnqueueBillSyncInput,
): Promise<EnqueueBillSyncResult> {
  const requestId = input.requestId?.trim() || randomUUID();
  const splitMode = parseSplitMode(input.splitMode) ?? 'whole_table';
  const built = buildBillSyncJobPayload({
    requestId,
    billSplitId: input.billSplitId,
    tableDisplayName: input.tableDisplayName,
    splitMode,
    persons: Array.isArray(input.persons) ? input.persons : [],
    orders: input.orders,
    itemCodeByMenuId: input.itemCodeByMenuId,
    vatRateByMenuId: input.vatRateByMenuId,
    defaultVatRatePercent: input.defaultVatRatePercent,
  });
  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }
  const payload = built.payload;
  const contentFp = billSyncContentFingerprint(payload);

  const { data: existingByRequest } = await input.admin
    .from('bill_sync_jobs')
    .select('id, status, request_id, payload')
    .eq('restaurant_id', input.restaurantId)
    .eq('request_id', requestId)
    .maybeSingle();

  if (existingByRequest) {
    return {
      ok: true,
      reused: 'request_id',
      job: jobRef(existingByRequest as JobRow, contentFp),
    };
  }

  const { data: recentRows, error: recentErr } = await input.admin
    .from('bill_sync_jobs')
    .select('id, status, request_id, payload')
    .eq('restaurant_id', input.restaurantId)
    .eq('source_sale_id', input.billSplitId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentErr) {
    return {
      ok: false,
      error: 'lookup_failed',
      status: 500,
      message: recentErr.message,
    };
  }

  const recent = (recentRows ?? []) as JobRow[];
  const inFlight = recent.find((row) => row.status === 'pending' || row.status === 'processing');
  if (inFlight) {
    return {
      ok: true,
      reused: 'in_flight',
      job: jobRef(inFlight),
    };
  }

  const lastSucceeded = recent.find((row) => row.status === 'succeeded');
  if (lastSucceeded?.payload) {
    const priorFp = billSyncContentFingerprint(lastSucceeded.payload);
    if (priorFp === contentFp) {
      return {
        ok: false,
        error: 'already_synced',
        status: 409,
        job: {
          id: lastSucceeded.id,
          status: lastSucceeded.status,
          request_id: lastSucceeded.request_id,
          content_fingerprint: priorFp,
        },
      };
    }
  }

  const { data: inserted, error } = await input.admin
    .from('bill_sync_jobs')
    .insert({
      restaurant_id: input.restaurantId,
      request_id: requestId,
      source_system: 'farvoo',
      source_sale_id: input.billSplitId,
      table_display_name: payload.table_display_name,
      scope_type: payload.scope_type,
      payload,
      status: 'pending',
      created_by: input.createdBy,
    })
    .select('id, status, request_id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      error: 'insert_failed',
      status: 500,
      message: error?.message,
    };
  }

  return {
    ok: true,
    job: {
      id: inserted.id as string,
      status: inserted.status as string,
      request_id: inserted.request_id as string,
      content_fingerprint: contentFp,
    },
  };
}
