import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldAutoOpenRoundReview } from './auto-open-round-review';

describe('shouldAutoOpenRoundReview', () => {
  it('opens when collecting with unsent qty', () => {
    assert.equal(
      shouldAutoOpenRoundReview({ tableReviewQty: 3, status: 'collecting' }),
      true,
    );
    assert.equal(shouldAutoOpenRoundReview({ tableReviewQty: 2, status: null }), true);
  });

  it('does not open with empty basket', () => {
    assert.equal(
      shouldAutoOpenRoundReview({ tableReviewQty: 0, status: 'collecting' }),
      false,
    );
  });

  it('does not open during countdown or cooldown', () => {
    assert.equal(
      shouldAutoOpenRoundReview({ tableReviewQty: 4, status: 'pending_confirm' }),
      false,
    );
    assert.equal(
      shouldAutoOpenRoundReview({ tableReviewQty: 4, status: 'cooldown' }),
      false,
    );
  });

  it('may open on finalize_failed when qty remains', () => {
    assert.equal(
      shouldAutoOpenRoundReview({ tableReviewQty: 1, status: 'finalize_failed' }),
      true,
    );
  });
});
