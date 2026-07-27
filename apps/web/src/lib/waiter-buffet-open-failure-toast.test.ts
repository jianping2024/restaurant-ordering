import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
      classifyWaiterBuffetOpenFailure({ status: 409, code: 'session_billing' }),
      'session_billing',
    );
    assert.equal(
      classifyWaiterBuffetOpenFailure({
        status: 409,
        code: 'buffet_headcount_below_paid_floor',
      }),
      'paid_floor',
    );
    assert.equal(
      classifyWaiterBuffetOpenFailure({
        status: 409,
        code: 'buffet_headcount_below_sushi_limit_floor',
      }),
      'sushi_limit_floor',
    );
    assert.equal(classifyWaiterBuffetOpenFailure({ status: 409 }), 'conflict');
  });
});
