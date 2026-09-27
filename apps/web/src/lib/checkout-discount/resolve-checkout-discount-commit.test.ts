import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCheckoutDiscountCommit } from './resolve-checkout-discount-commit';

describe('resolveCheckoutDiscountCommit', () => {
  it('asks for reason when rate > 0 and server has no reason', () => {
    assert.deepEqual(
      resolveCheckoutDiscountCommit({
        rate: 10,
        serverRate: 0,
        serverReason: null,
        previousRate: 0,
      }),
      { kind: 'needs_reason', rate: 10, previousRate: 0 },
    );
  });

  it('persists when rate > 0 and server already has a reason', () => {
    assert.deepEqual(
      resolveCheckoutDiscountCommit({
        rate: 15,
        serverRate: 10,
        serverReason: 'owner_approved',
        previousRate: 10,
      }),
      { kind: 'persist', rate: 15 },
    );
  });

  it('persists clearing discount to 0 when server had a rate', () => {
    assert.deepEqual(
      resolveCheckoutDiscountCommit({
        rate: 0,
        serverRate: 10,
        serverReason: 'owner_approved',
        previousRate: 10,
      }),
      { kind: 'persist', rate: 0 },
    );
  });

  it('clears draft when committed rate matches server (no stale re-read path)', () => {
    assert.deepEqual(
      resolveCheckoutDiscountCommit({
        rate: 0,
        serverRate: 0,
        serverReason: null,
        previousRate: 0,
      }),
      { kind: 'clear_draft' },
    );
    assert.deepEqual(
      resolveCheckoutDiscountCommit({
        rate: 10,
        serverRate: 10,
        serverReason: 'other',
        previousRate: 10,
      }),
      { kind: 'clear_draft' },
    );
  });

  it('treats blank server reason as missing', () => {
    assert.equal(
      resolveCheckoutDiscountCommit({
        rate: 5,
        serverRate: 0,
        serverReason: '   ',
        previousRate: 0,
      }).kind,
      'needs_reason',
    );
  });
});
