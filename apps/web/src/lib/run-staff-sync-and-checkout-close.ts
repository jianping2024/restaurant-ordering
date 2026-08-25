/**
 * Sole staff compound action: fiscal bill-sync then settled checkout close.
 * Fail-closed on sync; re-check fingerprint before close (no dirty close).
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import {
  enqueueStaffBillSync,
  fetchStaffBillSyncStatus,
  waitUntilStaffBillSyncSettled,
  type StaffBillSyncJob,
} from '@/lib/staff-bill-sync-client';
import { runWaiterTableCheckoutClose } from '@/lib/waiter-table-checkout-close';

export type SyncAndCheckoutCloseResult =
  | { ok: true; printFailed?: boolean; billSplitId: string; tableId: string }
  | {
      ok: false;
      stage: 'sync' | 'dirty' | 'close';
      code: string;
      message?: string;
      job?: StaffBillSyncJob | null;
    };

const MAX_DIRTY_RESYNC = 2;

export type SyncAndCheckoutCloseDeps = {
  fetchStatus?: typeof fetchStaffBillSyncStatus;
  enqueue?: typeof enqueueStaffBillSync;
  waitSettled?: typeof waitUntilStaffBillSyncSettled;
  closeTable?: typeof runWaiterTableCheckoutClose;
  mintRequestId?: () => string;
};

async function syncOnceUntilSucceeded(
  input: {
    restaurantSlug: string;
    billSplitId?: string;
    tableId?: string;
  },
  deps: Required<
    Pick<SyncAndCheckoutCloseDeps, 'enqueue' | 'waitSettled' | 'mintRequestId'>
  >,
): Promise<
  | { ok: true; billSplitId: string; tableId: string; job: StaffBillSyncJob }
  | { ok: false; code: string; message?: string; job?: StaffBillSyncJob | null }
> {
  const requestId = deps.mintRequestId();
  const enqueued = await deps.enqueue({
    restaurantSlug: input.restaurantSlug,
    billSplitId: input.billSplitId,
    tableId: input.tableId,
    requestId,
  });
  if (!enqueued.ok) {
    return {
      ok: false,
      code: enqueued.error,
      message: enqueued.message,
      job: enqueued.job ?? null,
    };
  }

  const billSplitId = enqueued.billSplitId;
  const tableId = enqueued.tableId;
  if (!billSplitId) {
    return { ok: false, code: 'missing_bill_split_id' };
  }

  if (enqueued.reused === 'already_synced' && enqueued.job.status === 'succeeded') {
    return { ok: true, billSplitId, tableId, job: enqueued.job };
  }

  if (enqueued.job.status === 'succeeded') {
    return { ok: true, billSplitId, tableId, job: enqueued.job };
  }

  const settled = await deps.waitSettled({
    restaurantSlug: input.restaurantSlug,
    billSplitId,
    requestId: enqueued.job.request_id || requestId,
  });
  if (!settled || settled.status !== 'succeeded') {
    return {
      ok: false,
      code: settled?.error_code || 'sync_failed',
      message: settled?.error_message || undefined,
      job: settled,
    };
  }
  return { ok: true, billSplitId, tableId, job: settled };
}

/**
 * Sync (or skip when already content_unchanged) → fingerprint gate → checkout close.
 * Pass either `billSplitId` (checkout detail) or `tableId` (floor ensure/reuse).
 */
export async function runStaffSyncAndCheckoutClose(
  input: {
    restaurantSlug: string;
    billSplitId?: string;
    tableId?: string;
    printBill: boolean;
  },
  options?: SyncAndCheckoutCloseDeps,
): Promise<SyncAndCheckoutCloseResult> {
  const deps = {
    fetchStatus: options?.fetchStatus ?? fetchStaffBillSyncStatus,
    enqueue: options?.enqueue ?? enqueueStaffBillSync,
    waitSettled: options?.waitSettled ?? waitUntilStaffBillSyncSettled,
    closeTable: options?.closeTable ?? runWaiterTableCheckoutClose,
    mintRequestId: options?.mintRequestId ?? mintBrowserUuid,
  };

  let billSplitId = input.billSplitId?.trim() ?? '';
  let tableId = input.tableId?.trim() ?? '';

  if (billSplitId) {
    const status = await deps.fetchStatus({
      restaurantSlug: input.restaurantSlug,
      billSplitId,
    });
    if (!status.available) {
      return { ok: false, stage: 'sync', code: 'bill_sync_disabled' };
    }
    if (!status.content_unchanged) {
      const synced = await syncOnceUntilSucceeded(
        { restaurantSlug: input.restaurantSlug, billSplitId },
        deps,
      );
      if (!synced.ok) {
        return {
          ok: false,
          stage: 'sync',
          code: synced.code,
          message: synced.message,
          job: synced.job,
        };
      }
      billSplitId = synced.billSplitId;
      tableId = synced.tableId || tableId;
    }
  } else {
    const synced = await syncOnceUntilSucceeded(
      { restaurantSlug: input.restaurantSlug, tableId },
      deps,
    );
    if (!synced.ok) {
      return {
        ok: false,
        stage: 'sync',
        code: synced.code,
        message: synced.message,
        job: synced.job,
      };
    }
    billSplitId = synced.billSplitId;
    tableId = synced.tableId;
  }

  for (let dirty = 0; dirty <= MAX_DIRTY_RESYNC; dirty++) {
    const gate = await deps.fetchStatus({
      restaurantSlug: input.restaurantSlug,
      billSplitId,
    });
    if (gate.content_unchanged) break;
    if (dirty === MAX_DIRTY_RESYNC) {
      return { ok: false, stage: 'dirty', code: 'bill_changed', job: gate.job };
    }
    const resync = await syncOnceUntilSucceeded(
      { restaurantSlug: input.restaurantSlug, billSplitId },
      deps,
    );
    if (!resync.ok) {
      return {
        ok: false,
        stage: 'sync',
        code: resync.code,
        message: resync.message,
        job: resync.job,
      };
    }
    billSplitId = resync.billSplitId;
    tableId = resync.tableId || tableId;
  }

  if (!tableId) {
    return { ok: false, stage: 'close', code: 'missing_table_id' };
  }

  const close = await deps.closeTable({
    tableId,
    printBill: input.printBill,
  });
  if (!close.ok) {
    if (close.code === 'no_session') {
      return { ok: true, billSplitId, tableId };
    }
    return {
      ok: false,
      stage: 'close',
      code: close.code,
      message: close.message,
    };
  }
  return {
    ok: true,
    printFailed: close.printFailed,
    billSplitId,
    tableId,
  };
}
