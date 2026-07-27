import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCustomerOrderingIntroCopy, CUSTOMER_ORDERING_INTRO_SPLIT_STEP_INDEX } from './customer-ordering-intro-messages';
import { getGuestSplitGuidance } from './guest-split-mode-messages';

describe('customer ordering intro copy', () => {
  it('injects split step from guest split guidance', () => {
    const copy = getCustomerOrderingIntroCopy('zh');
    const split = getGuestSplitGuidance('zh').introStep;
    assert.equal(copy.steps.length, 4);
    assert.equal(copy.steps[CUSTOMER_ORDERING_INTRO_SPLIT_STEP_INDEX].title, split.title);
    assert.equal(copy.steps[CUSTOMER_ORDERING_INTRO_SPLIT_STEP_INDEX].body, split.body);
  });
});
