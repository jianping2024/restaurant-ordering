import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldPromptCheckoutZeroHeadcount } from './checkout-zero-headcount-prompt';

describe('shouldPromptCheckoutZeroHeadcount', () => {
  it('prompts only when dine-in, buffet restaurant, headcount not confirmed, and not acknowledged', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: true,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: false,
        orderingChannel: 'dine_in',
      }),
      true,
    );
  });

  it('skips takeaway sessions even with buffet and zero headcount', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: true,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: false,
        orderingChannel: 'takeaway',
      }),
      false,
    );
  });

  it('skips when no active buffets', () => {
    assert.equal(
      shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets: false,
        guestCountConfirmed: false,
        acknowledgedZeroHeadcount: false,
        orderingChannel: 'dine_in',
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
        orderingChannel: 'dine_in',
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
        orderingChannel: 'dine_in',
      }),
      false,
    );
  });
});
