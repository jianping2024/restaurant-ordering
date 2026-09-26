import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BILL_SYNC_FS_GROSS_THRESHOLD,
  billSyncDocumentTypeForPayment,
  resolveCollectPaymentTender,
} from './bill-sync-payload';

describe('resolveCollectPaymentTender', () => {
  it('builds CASH / MULTIBANCO single lines', () => {
    const cash = resolveCollectPaymentTender({ uiMethod: 'CASH', dueAmount: 12.5 });
    assert.equal(cash.ok, true);
    if (!cash.ok) return;
    assert.equal(cash.paymentMethod, 'CASH');
    assert.deepEqual(cash.payment_lines, [{ method: 'CASH', amount: '12.50' }]);

    const mb = resolveCollectPaymentTender({ uiMethod: 'MULTIBANCO', dueAmount: 12.5 });
    assert.equal(mb.ok, true);
    if (!mb.ok) return;
    assert.equal(mb.paymentMethod, 'MULTIBANCO');
    assert.deepEqual(mb.payment_lines, [{ method: 'MULTIBANCO', amount: '12.50' }]);
  });

  it('normalizes MIXED card=full → MULTIBANCO and both sides → MIXED', () => {
    const full = resolveCollectPaymentTender({
      uiMethod: 'MIXED',
      dueAmount: 20,
      multibancoAmount: 20,
    });
    assert.equal(full.ok, true);
    if (!full.ok) return;
    assert.equal(full.paymentMethod, 'MULTIBANCO');

    const mixed = resolveCollectPaymentTender({
      uiMethod: 'MIXED',
      dueAmount: 20,
      multibancoAmount: 15,
    });
    assert.equal(mixed.ok, true);
    if (!mixed.ok) return;
    assert.equal(mixed.paymentMethod, 'MIXED');
    assert.deepEqual(mixed.payment_lines, [
      { method: 'MULTIBANCO', amount: '15.00' },
      { method: 'CASH', amount: '5.00' },
    ]);
  });

  it('rejects MIXED when multibanco amount is 0', () => {
    const zeroMb = resolveCollectPaymentTender({
      uiMethod: 'MIXED',
      dueAmount: 10,
      multibancoAmount: 0,
    });
    assert.equal(zeroMb.ok, false);
    if (zeroMb.ok) return;
    assert.equal(zeroMb.error, 'mixed_need_both_sides');
  });
});

describe('billSyncDocumentTypeForPayment', () => {
  it('CASH ≤ threshold → FS; CASH > threshold → FT', () => {
    assert.equal(billSyncDocumentTypeForPayment('CASH', BILL_SYNC_FS_GROSS_THRESHOLD), 'FS');
    assert.equal(
      billSyncDocumentTypeForPayment('CASH', BILL_SYNC_FS_GROSS_THRESHOLD + 0.01),
      'FT',
    );
  });

  it('MULTIBANCO / MIXED → FT regardless of amount', () => {
    assert.equal(billSyncDocumentTypeForPayment('MULTIBANCO', 1), 'FT');
    assert.equal(billSyncDocumentTypeForPayment('MIXED', 1), 'FT');
  });
});
