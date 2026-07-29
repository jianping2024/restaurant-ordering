import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorBoardCapabilities } from './floor-board-capabilities';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('floorBoardCapabilities', () => {
  it('derives desk powers from frontdesk/cashier templates', () => {
    for (const preset of ['frontdesk', 'cashier'] as const) {
      const caps = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES[preset]]));
      assert.equal(caps.canMenuDecrement, true);
      assert.equal(caps.canCheckoutClose, true);
      assert.equal(caps.canAssistBillCheckout, true);
      assert.equal(caps.canOpenCheckoutPendingTables, true);
      assert.equal(caps.canTransfer, true);
      assert.equal(caps.canMerge, true);
    }
  });

  it('derives transfer/merge for owner and waiter presets', () => {
    for (const preset of ['owner', 'waiter'] as const) {
      const caps = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES[preset]]));
      assert.equal(caps.canTransfer, true);
      assert.equal(caps.canMerge, true);
    }
  });

  it('allows session pre_bill print for frontdesk only', () => {
    assert.equal(
      floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]))
        .canPrintSessionPreBill,
      true,
    );
    assert.equal(
      floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier])).canPrintSessionPreBill,
      false,
    );
    assert.equal(
      floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.waiter])).canPrintSessionPreBill,
      false,
    );
  });

  it('keeps waiter order-assist only', () => {
    const caps = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]));
    assert.equal(caps.canMenuDecrement, false);
    assert.equal(caps.canCheckoutClose, false);
    assert.equal(caps.canAssistBillCheckout, false);
    assert.equal(caps.canOpenCheckoutPendingTables, false);
    assert.equal(caps.canTransfer, true);
    assert.equal(caps.canMerge, true);
  });
});
