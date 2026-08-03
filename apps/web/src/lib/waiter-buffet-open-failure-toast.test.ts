import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BUFFET_HEADCOUNT_BELOW_PAID_FLOOR } from './buffet-paid-headcount-floor';
import { BUFFET_OPEN_ALREADY_OPEN } from './buffet-waiter-open-intent';
import { DEPENDENCY_UNAVAILABLE } from './dependency-unavailable';
import { classifyWaiterBuffetOpenFailure } from './waiter-buffet-open-failure-toast';

describe('classifyWaiterBuffetOpenFailure', () => {
  it('maps dependency_unavailable to dependency', () => {
    assert.equal(
      classifyWaiterBuffetOpenFailure({ status: 503, code: DEPENDENCY_UNAVAILABLE }),
      'dependency',
    );
  });

  it('keeps business 409 codes distinct', () => {
    assert.equal(
      classifyWaiterBuffetOpenFailure({ status: 409, code: BUFFET_OPEN_ALREADY_OPEN }),
      'already_open',
    );
    assert.equal(
      classifyWaiterBuffetOpenFailure({ status: 409, code: 'session_billing' }),
      'session_billing',
    );
    assert.equal(
      classifyWaiterBuffetOpenFailure({
        status: 409,
        code: BUFFET_HEADCOUNT_BELOW_PAID_FLOOR,
      }),
      'paid_floor',
    );
    assert.equal(classifyWaiterBuffetOpenFailure({ status: 409 }), 'conflict');
  });
});
