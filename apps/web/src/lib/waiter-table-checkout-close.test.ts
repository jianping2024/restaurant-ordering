import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runWaiterTableCheckoutClose } from './waiter-table-checkout-close';

describe('runWaiterTableCheckoutClose', () => {
  it('returns ok when close API succeeds', async () => {
    const outcome = await runWaiterTableCheckoutClose(
      { tableId: 't1', printBill: false },
      {
        postClose: async () => ({ status: 200, body: { ok: true, session_id: 's1' } }),
      },
    );
    assert.deepEqual(outcome, { ok: true, printFailed: false });
  });

  it('marks printFailed when print was requested and print_ok is false', async () => {
    const outcome = await runWaiterTableCheckoutClose(
      { tableId: 't1', printBill: true },
      {
        postClose: async () => ({
          status: 200,
          body: { ok: true, session_id: 's1', print_ok: false },
        }),
      },
    );
    assert.deepEqual(outcome, { ok: true, printFailed: true });
  });

  it('maps no_session errors', async () => {
    const outcome = await runWaiterTableCheckoutClose(
      { tableId: 't1', printBill: false },
      {
        postClose: async () => ({ status: 404, body: { error: 'no_session' } }),
      },
    );
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.code, 'no_session');
    }
  });
});
