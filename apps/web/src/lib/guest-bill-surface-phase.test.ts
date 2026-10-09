import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guestBillSurfaceShowsSubmitted,
  resolveGuestBillSurfacePhase,
} from './guest-bill-surface-phase';

describe('resolveGuestBillSurfacePhase', () => {
  it('enters awaiting when this phone holds ordering', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'editing',
        phoneHoldsOrdering: true,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: 's1',
        splitStatus: 'requested',
      }),
      'awaiting_payment',
    );
  });

  it('enters awaiting from local call latch before sync', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'editing',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: true,
        sessionId: 's1',
        splitStatus: null,
      }),
      'awaiting_payment',
    );
  });

  it('settles when session closes after awaiting', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'awaiting_payment',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: null,
        splitStatus: null,
      }),
      'settled',
    );
  });

  it('settles when session closes while still on the call-checkout editor', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'editing',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: null,
        splitStatus: null,
      }),
      'settled',
    );
  });

  it('settles when session closes even if local call latch is still set', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'awaiting_payment',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: true,
        sessionId: null,
        splitStatus: null,
      }),
      'settled',
    );
  });

  it('stays settled when split is paid', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'awaiting_payment',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: 's1',
        splitStatus: 'paid',
      }),
      'settled',
    );
  });

  it('returns to editing when by-item ticket paid but table still open', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'awaiting_payment',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: 's1',
        splitStatus: 'requested',
      }),
      'editing',
    );
  });

  it('returns to editing after staff resume (session open, no hold)', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'awaiting_payment',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: 's1',
        splitStatus: 'confirmed',
      }),
      'editing',
    );
  });

  it('keeps settled across empty post-close syncs', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        previousPhase: 'settled',
        phoneHoldsOrdering: false,
        tablePlanHoldsCheckout: false,
        localCalledLatch: false,
        sessionId: null,
        splitStatus: null,
      }),
      'settled',
    );
  });
});

describe('guestBillSurfaceShowsSubmitted', () => {
  it('is true only for awaiting and settled', () => {
    assert.equal(guestBillSurfaceShowsSubmitted('editing'), false);
    assert.equal(guestBillSurfaceShowsSubmitted('awaiting_payment'), true);
    assert.equal(guestBillSurfaceShowsSubmitted('settled'), true);
  });
});
