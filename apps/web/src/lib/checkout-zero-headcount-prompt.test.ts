import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldPromptCheckoutZeroHeadcount } from './checkout-zero-headcount-prompt';

describe('shouldPromptCheckoutZeroHeadcount', () => {
  it('prompts only when buffet restaurant, headcount not confirmed, and not acknowledged', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: true,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: false,
      }),
      true,
    );
  });

  it('skips when no active buffets', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: false,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: false,
      }),
      false,
    );
  });

  it('skips when headcount already confirmed', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: true,
        guestCountConfirmed: true,
        acknowledgedZeroHeadcount: false,
      }),
      false,
    );
  });

  it('skips when staff already confirmed zero', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: true,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: true,
      }),
      false,
    );
  });
});
