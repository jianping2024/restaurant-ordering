import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runStaffSyncAndCheckoutClose } from './run-staff-sync-and-checkout-close';
import type { StaffBillSyncJob } from './staff-bill-sync-client';

const succeededJob: StaffBillSyncJob = {
  id: 'j1',
  status: 'succeeded',
  request_id: 'r1',
};

describe('runStaffSyncAndCheckoutClose', () => {
  it('skips enqueue when content_unchanged then closes', async () => {
    let enqueued = false;
    let closed = false;
    const out = await runStaffSyncAndCheckoutClose(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        tableId: 'table-1',
        printBill: false,
      },
      {
        fetchStatus: async () => ({
          job: succeededJob,
          content_unchanged: true,
          available: true,
          status: 200,
        }),
        enqueue: async () => {
          enqueued = true;
          return {
            ok: true,
            job: succeededJob,
            billSplitId: 'split-1',
            tableId: 'table-1',
          };
        },
        closeTable: async () => {
          closed = true;
          return { ok: true };
        },
      },
    );
    assert.equal(out.ok, true);
    assert.equal(enqueued, false);
    assert.equal(closed, true);
  });

  it('does not close when sync fails', async () => {
    let closed = false;
    const out = await runStaffSyncAndCheckoutClose(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        tableId: 'table-1',
        printBill: false,
      },
      {
        fetchStatus: async () => ({
          job: null,
          content_unchanged: false,
          available: true,
          status: 200,
        }),
        enqueue: async () => ({
          ok: false,
          status: 400,
          error: 'empty_lines',
        }),
        closeTable: async () => {
          closed = true;
          return { ok: true };
        },
      },
    );
    assert.equal(out.ok, false);
    if (!out.ok) {
      assert.equal(out.stage, 'sync');
      assert.equal(out.code, 'empty_lines');
    }
    assert.equal(closed, false);
  });

  it('aborts close when fingerprint stays dirty after resyncs', async () => {
    let closed = false;
    let enqueueCount = 0;
    const out = await runStaffSyncAndCheckoutClose(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        tableId: 'table-1',
        printBill: true,
      },
      {
        fetchStatus: async () => ({
          job: succeededJob,
          content_unchanged: false,
          available: true,
          status: 200,
        }),
        enqueue: async () => {
          enqueueCount += 1;
          return {
            ok: true,
            job: succeededJob,
            billSplitId: 'split-1',
            tableId: 'table-1',
          };
        },
        waitSettled: async () => succeededJob,
        closeTable: async () => {
          closed = true;
          return { ok: true };
        },
        mintRequestId: () => 'req-fixed',
      },
    );
    assert.equal(out.ok, false);
    if (!out.ok) {
      assert.equal(out.stage, 'dirty');
      assert.equal(out.code, 'bill_changed');
    }
    assert.equal(closed, false);
    assert.ok(enqueueCount >= 1);
  });

  it('treats close no_session as success after sync', async () => {
    const out = await runStaffSyncAndCheckoutClose(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        tableId: 'table-1',
        printBill: false,
      },
      {
        fetchStatus: async () => ({
          job: succeededJob,
          content_unchanged: true,
          available: true,
          status: 200,
        }),
        closeTable: async () => ({
          ok: false,
          stage: 'close',
          code: 'no_session',
        }),
      },
    );
    assert.equal(out.ok, true);
  });
});
