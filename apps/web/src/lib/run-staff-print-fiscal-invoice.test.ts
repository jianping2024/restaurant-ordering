import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runStaffPrintFiscalInvoice } from './run-staff-print-fiscal-invoice';

describe('runStaffPrintFiscalInvoice', () => {
  it('maps CASH → FS and waits for succeeded job', async () => {
    const out = await runStaffPrintFiscalInvoice(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        paymentMethod: 'CASH',
      },
      {
        mintRequestId: () => 'req-1',
        enqueue: async (input) => {
          assert.equal(input.autoIssue?.document_type, 'FS');
          assert.equal(input.autoIssue?.issue_mode, 'whole_table');
          return {
            ok: true,
            job: { id: 'j1', status: 'pending', request_id: 'req-1' },
            billSplitId: 'split-1',
            tableId: 't1',
          };
        },
        waitSettled: async () => ({
          id: 'j1',
          status: 'succeeded',
          request_id: 'req-1',
          invoice_no: 'FS 1/1',
        }),
      },
    );
    assert.equal(out.ok, true);
    if (out.ok) {
      assert.equal(out.invoiceNo, 'FS 1/1');
      assert.equal(out.tableId, 't1');
    }
  });

  it('maps CARD → FT and person issue_scope_id', async () => {
    const out = await runStaffPrintFiscalInvoice(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        paymentMethod: 'CARD',
        issueScopeId: 'scope-a',
      },
      {
        mintRequestId: () => 'req-2',
        enqueue: async (input) => {
          assert.equal(input.autoIssue?.document_type, 'FT');
          assert.equal(input.autoIssue?.issue_mode, 'person');
          assert.equal(input.autoIssue?.issue_scope_id, 'scope-a');
          return {
            ok: true,
            job: {
              id: 'j2',
              status: 'succeeded',
              request_id: 'req-2',
              invoice_no: 'FT 2/1',
            },
            billSplitId: 'split-1',
            tableId: 't1',
          };
        },
        waitSettled: async () => {
          throw new Error('should not wait when already succeeded');
        },
      },
    );
    assert.equal(out.ok, true);
  });

  it('does not close table on failure', async () => {
    const out = await runStaffPrintFiscalInvoice(
      {
        restaurantSlug: 'r1',
        billSplitId: 'split-1',
        paymentMethod: 'CASH',
      },
      {
        mintRequestId: () => 'req-3',
        enqueue: async () => ({
          ok: false,
          status: 409,
          error: 'collection_required',
        }),
        waitSettled: async () => null,
      },
    );
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.code, 'collection_required');
  });
});
