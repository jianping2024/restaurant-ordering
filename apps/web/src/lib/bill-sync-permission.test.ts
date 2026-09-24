import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mayFiscalBillQueue } from './bill-sync-permission';
import { capabilitiesFromKeys } from '@/lib/permissions/can';

describe('mayFiscalBillQueue', () => {
  it('requires checkout.sync_bill and tables.checkout_close', () => {
    assert.equal(mayFiscalBillQueue(capabilitiesFromKeys(['checkout.sync_bill'])), false);
    assert.equal(mayFiscalBillQueue(capabilitiesFromKeys(['tables.checkout_close'])), false);
    assert.equal(
      mayFiscalBillQueue(
        capabilitiesFromKeys(['checkout.sync_bill', 'tables.checkout_close']),
      ),
      true,
    );
  });
});
