import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isNonBlockingCheckoutClosePrintError,
  runWaiterTableCheckoutClose,
} from './waiter-table-checkout-close';

/** Print-on-close is decided by `printBill` arg (from checkout.print_pre_bill capability). */
describe('checkout close print decision', () => {
  it('documents capability-driven printBill flag', () => {
    const printBillFromCaps = (hasPreBill: boolean) => hasPreBill;
    assert.equal(printBillFromCaps(true), true);
    assert.equal(printBillFromCaps(false), false);
  });

  it('treats only no_orders as non-blocking print failure', () => {
    assert.equal(isNonBlockingCheckoutClosePrintError('no_orders'), true);
    assert.equal(isNonBlockingCheckoutClosePrintError('unauthorized'), false);
    assert.equal(isNonBlockingCheckoutClosePrintError('network_error'), false);
    assert.equal(isNonBlockingCheckoutClosePrintError('insert_failed'), false);
  });
});

describe('runWaiterTableCheckoutClose', () => {
  const base = {
    slug: 'demo',
    tableId: 'table-1',
    sessionId: 'session-1',
  };

  it('skips print on no_orders and still closes', async () => {
    let closeCalls = 0;
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: true },
      {
        requestBillPrint: async () => ({ ok: false, error: 'no_orders' }),
        postClose: async () => {
          closeCalls += 1;
          return { status: 200, body: { ok: true } };
        },
      },
    );
    assert.deepEqual(outcome, { ok: true });
    assert.equal(closeCalls, 1);
  });

  it('blocks close on other print failures', async () => {
    let closeCalls = 0;
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: true },
      {
        requestBillPrint: async () => ({ ok: false, error: 'unauthorized' }),
        postClose: async () => {
          closeCalls += 1;
          return { status: 200, body: { ok: true } };
        },
      },
    );
    assert.deepEqual(outcome, { ok: false, stage: 'print', code: 'unauthorized' });
    assert.equal(closeCalls, 0);
  });

  it('closes without printing when printBill is false', async () => {
    let printCalls = 0;
    const outcome = await runWaiterTableCheckoutClose(
      { ...base, printBill: false },
      {
        requestBillPrint: async () => {
          printCalls += 1;
          return { ok: true };
        },
        postClose: async () => ({ status: 200, body: { ok: true } }),
      },
    );
    assert.deepEqual(outcome, { ok: true });
    assert.equal(printCalls, 0);
  });
});
