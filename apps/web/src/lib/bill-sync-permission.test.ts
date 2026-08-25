import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maySyncAndCheckoutClose } from './bill-sync-permission';
import { capabilitiesFromKeys } from './permissions/can';

describe('maySyncAndCheckoutClose', () => {
  it('requires both checkout.sync_bill and tables.checkout_close', () => {
    assert.equal(maySyncAndCheckoutClose(capabilitiesFromKeys(['checkout.sync_bill'])), false);
    assert.equal(maySyncAndCheckoutClose(capabilitiesFromKeys(['tables.checkout_close'])), false);
    assert.equal(
      maySyncAndCheckoutClose(
        capabilitiesFromKeys(['checkout.sync_bill', 'tables.checkout_close']),
      ),
      true,
    );
  });
});
