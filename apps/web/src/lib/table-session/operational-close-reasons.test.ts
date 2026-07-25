import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOperationalCloseReason,
  isSettledCloseReason,
  settledActorReasonToForced,
} from '@/lib/table-session/operational-close-reasons';

describe('operational-close-reasons', () => {
  it('recognizes force/nightly reasons only', () => {
    assert.equal(isOperationalCloseReason('waiter_closed'), true);
    assert.equal(isOperationalCloseReason('owner_forced'), true);
    assert.equal(isOperationalCloseReason('auto_nightly'), true);
    assert.equal(isOperationalCloseReason('frontdesk_closed'), false);
    assert.equal(isOperationalCloseReason('owner_closed'), false);
    assert.equal(isOperationalCloseReason(null), false);
  });

  it('recognizes settled checkout-close reasons only', () => {
    assert.equal(isSettledCloseReason('frontdesk_closed'), true);
    assert.equal(isSettledCloseReason('cashier_closed'), true);
    assert.equal(isSettledCloseReason('owner_closed'), true);
    assert.equal(isSettledCloseReason('frontdesk_forced'), false);
    assert.equal(isSettledCloseReason('auto_nightly'), false);
    assert.equal(isSettledCloseReason(null), false);
  });

  it('maps dashboard actor reasons to forced close reasons', () => {
    assert.equal(settledActorReasonToForced('owner_closed'), 'owner_forced');
    assert.equal(settledActorReasonToForced('frontdesk_closed'), 'frontdesk_forced');
    assert.equal(settledActorReasonToForced('cashier_closed'), 'cashier_forced');
  });
});
