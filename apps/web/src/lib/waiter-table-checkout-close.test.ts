import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runWaiterTableCheckoutClose } from './waiter-table-checkout-close';

/** Print-on-close is decided by `printBill` arg (from checkout.print_pre_bill capability). */
describe('checkout close print decision', () => {
  it('documents capability-driven printBill flag', () => {
    const printBillFromCaps = (hasPreBill: boolean) => hasPreBill;
    assert.equal(printBillFromCaps(true), true);
    assert.equal(printBillFromCaps(false), false);
  });
});

describe('runWaiterTableCheckoutClose', () => {
  const base = {
    tableId: 'table-1',
  };

  it('closes with print_bill and surfaces printFailed when print_ok is false', async () => {
    let closeBody: { table_id?: string; print_bill?: boolean } | null = null;
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: true },
      {
        postClose: async (body) => {
          closeBody = body;
          return { status: 200, body: { ok: true, print_ok: false } };
        },
      },
    );
    assert.deepEqual(outcome, { ok: true, printFailed: true });
    assert.deepEqual(closeBody, { table_id: 'table-1', print_bill: true });
  });

  it('does not set printFailed when print succeeds', async () => {
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: true },
      {
        postClose: async () => ({ status: 200, body: { ok: true, print_ok: true } }),
      },
    );
    assert.deepEqual(outcome, { ok: true, printFailed: false });
  });

  it('closes without print_bill when printBill is false', async () => {
    let closeBody: { table_id?: string; print_bill?: boolean } | null = null;
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: false },
      {
        postClose: async (body) => {
          closeBody = body;
          return { status: 200, body: { ok: true } };
        },
      },
    );
    assert.deepEqual(outcome, { ok: true, printFailed: false });
    assert.deepEqual(closeBody, { table_id: 'table-1', print_bill: false });
  });

  it('maps no_session from close API', async () => {
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: false },
      {
        postClose: async () => ({ status: 404, body: { error: 'no_session' } }),
      },
    );
    assert.deepEqual(outcome, { ok: false, stage: 'close', code: 'no_session' });
  });
});
