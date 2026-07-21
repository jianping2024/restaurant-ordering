import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorBoardCapabilities, isFloorBoardRole } from './floor-board-capabilities';

describe('floorBoardCapabilities', () => {
  it('gives desk roles checkout and decrement powers', () => {
    for (const role of ['frontdesk', 'cashier'] as const) {
      const caps = floorBoardCapabilities(role);
      assert.equal(caps.canMenuDecrement, true);
      assert.equal(caps.canCheckoutClose, true);
      assert.equal(caps.canForceCloseTable, true);
      assert.equal(caps.canAssistBillCheckout, true);
      assert.equal(caps.canOpenCheckoutPendingTables, true);
    }
  });

  it('allows session pre_bill print for frontdesk only', () => {
    assert.equal(floorBoardCapabilities('frontdesk').canPrintSessionPreBill, true);
    assert.equal(floorBoardCapabilities('cashier').canPrintSessionPreBill, false);
    assert.equal(floorBoardCapabilities('waiter').canPrintSessionPreBill, false);
  });

  it('keeps waiter order-assist only', () => {
    const caps = floorBoardCapabilities('waiter');
    assert.equal(caps.canMenuDecrement, false);
    assert.equal(caps.canCheckoutClose, false);
    assert.equal(caps.canForceCloseTable, false);
    assert.equal(caps.canAssistBillCheckout, false);
    assert.equal(caps.canOpenCheckoutPendingTables, false);
  });
});

describe('isFloorBoardRole', () => {
  it('accepts floor board roles only', () => {
    assert.equal(isFloorBoardRole('waiter'), true);
    assert.equal(isFloorBoardRole('kitchen'), false);
    assert.equal(isFloorBoardRole(null), false);
  });
});
