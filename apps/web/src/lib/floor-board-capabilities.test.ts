import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorBoardCapabilities } from './floor-board-capabilities';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

describe('floorBoardCapabilities', () => {
  it('derives desk powers from Pirata frontdesk/cashier templates', () => {
    const frontdesk = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.frontdesk]));
    assert.equal(frontdesk.canMenuDecrement, true);
    assert.equal(frontdesk.canCallCheckout, true);
    assert.equal(frontdesk.canAssistBillCheckout, true);
    assert.equal(frontdesk.canOpenCheckoutPendingTables, true);
    assert.equal(frontdesk.canTransfer, true);
    assert.equal(frontdesk.canMerge, true);
    assert.equal(frontdesk.canForceClose, true);
    assert.equal(frontdesk.canOpenTableSession, true);
    assert.equal(frontdesk.canViewDiningHeadcount, true);
    assert.equal(frontdesk.canViewTableDetailAmounts, true);

    const cashier = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.cashier]));
    assert.equal(cashier.canCallCheckout, true);
    assert.equal(cashier.canTransfer, true);
    assert.equal(cashier.canMerge, true);
    assert.equal(cashier.canForceClose, true);
    assert.equal(cashier.canOpenTableSession, true);
    assert.equal(cashier.canViewDiningHeadcount, true);
    assert.equal(cashier.canViewTableDetailAmounts, true);
  });

  it('matches Pirata owner (settings-only floor) and waiter (transfer, no merge)', () => {
    const owner = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.owner]));
    assert.equal(owner.canTransfer, false);
    assert.equal(owner.canMerge, false);
    assert.equal(owner.canForceClose, false);
    assert.equal(owner.canViewDiningHeadcount, false);
    assert.equal(owner.canViewTableDetailAmounts, false);

    const waiter = floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]));
    assert.equal(waiter.canTransfer, true);
    assert.equal(waiter.canMerge, false);
    assert.equal(waiter.canForceClose, false);
    assert.equal(waiter.canViewDiningHeadcount, false);
    assert.equal(waiter.canViewTableDetailAmounts, false);
    assert.equal(
      floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.kitchen])).canViewDiningHeadcount,
      false,
    );
    assert.equal(
      floorBoardCapabilities(capabilitiesFromKeys([...ROLE_TEMPLATES.kitchen]))
        .canViewTableDetailAmounts,
      false,
    );
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
    assert.equal(caps.canCallCheckout, false);
    assert.equal(caps.canAssistBillCheckout, false);
    assert.equal(caps.canOpenCheckoutPendingTables, false);
    assert.equal(caps.canTransfer, true);
    assert.equal(caps.canMerge, false);
    assert.equal(caps.canForceClose, false);
  });
});
