import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorBoardCapabilities } from './floor-board-capabilities';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('floorBoardCapabilities', () => {
  it('derives desk powers from frontdesk/cashier templates', () => {
    const frontdesk = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]));
    assert.equal(frontdesk.canMenuDecrement, true);
    assert.equal(frontdesk.canCheckoutClose, true);
    assert.equal(frontdesk.canAssistBillCheckout, true);
    assert.equal(frontdesk.canOpenCheckoutPendingTables, true);
    assert.equal(frontdesk.canTransfer, true);
    assert.equal(frontdesk.canMerge, true);
    assert.equal(frontdesk.canForceClose, true);
    assert.equal(frontdesk.canOpenTableSession, true);

    const cashier = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier]));
    assert.equal(cashier.canCheckoutClose, true);
    assert.equal(cashier.canTransfer, true);
    assert.equal(cashier.canMerge, true);
    assert.equal(cashier.canForceClose, false);
    assert.equal(cashier.canOpenTableSession, true);
  });

  it('derives transfer/merge/force-close for owner and transfer/merge for waiter', () => {
    const owner = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.owner]));
    assert.equal(owner.canTransfer, true);
    assert.equal(owner.canMerge, true);
    assert.equal(owner.canForceClose, true);

    const waiter = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]));
    assert.equal(waiter.canTransfer, true);
    assert.equal(waiter.canMerge, true);
    assert.equal(waiter.canForceClose, false);
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
    assert.equal(caps.canForceClose, false);
  });
});
