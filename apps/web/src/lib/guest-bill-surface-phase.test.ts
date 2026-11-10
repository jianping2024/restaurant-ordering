import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guestBillSurfaceShowsSubmitted,
  resolveGuestBillSurfacePhase,
} from './guest-bill-surface-phase';

const base = {
  previousPhase: 'editing' as const,
  phoneHoldsOrdering: false,
  sharedPlanHoldsAwaiting: false,
  localCalledLatch: false,
  sessionId: 's1' as string | null,
  splitStatus: null as 'requested' | 'confirmed' | 'paid' | null,
};

describe('resolveGuestBillSurfacePhase', () => {
  it('enters awaiting when this phone holds ordering', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        phoneHoldsOrdering: true,
        splitStatus: 'requested',
      }),
      'awaiting_payment',
    );
  });

  it('enters awaiting from local call latch before sync', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        localCalledLatch: true,
      }),
      'awaiting_payment',
    );
  });

  it('enters awaiting when the shared plan holds every phone', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        sharedPlanHoldsAwaiting: true,
        splitStatus: 'requested',
      }),
      'awaiting_payment',
    );
  });

  it('settles when session closes after awaiting', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        sessionId: null,
      }),
      'settled',
    );
  });

  it('settles when session closes while still on the call-checkout editor', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        sessionId: null,
      }),
      'settled',
    );
  });

  it('settles when session closes even if local call latch is still set', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        localCalledLatch: true,
        sessionId: null,
      }),
      'settled',
    );
  });

  it('stays settled when split is paid', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        splitStatus: 'paid',
      }),
      'settled',
    );
  });

  it('returns to editing when by-item ticket paid but table still open', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        splitStatus: 'requested',
      }),
      'editing',
    );
  });

  it('returns to editing when unlock frees the shared awaiting hold', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        sharedPlanHoldsAwaiting: false,
        splitStatus: 'confirmed',
      }),
      'editing',
    );
  });

  it('returns to editing after staff resume (session open, no hold)', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'awaiting_payment',
        splitStatus: 'confirmed',
      }),
      'editing',
    );
  });

  it('keeps settled across empty post-close syncs', () => {
    assert.equal(
      resolveGuestBillSurfacePhase({
        ...base,
        previousPhase: 'settled',
        sessionId: null,
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
