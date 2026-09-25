import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReturnToCheckoutPathChooser,
  checkoutSplitCloseAllowed,
  resolveCheckoutDetailPhase,
} from './checkout-detail-phase';

describe('checkout-detail-phase', () => {
  it('resolves path_chooser / split_edit / settle for whole_table zero collect', () => {
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'undecided',
      }),
      'path_chooser',
    );
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'split',
      }),
      'split_edit',
    );
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'whole_table',
      }),
      'settle',
    );
  });

  it('keeps even, by_item, and custom on split_edit and settles a paid whole table', () => {
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'whole_table',
        collected: 1,
        pathChoice: 'undecided',
      }),
      'settle',
    );
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'even',
        collected: 0,
        pathChoice: 'undecided',
      }),
      'split_edit',
    );
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'by_item',
        collected: 4,
        pathChoice: 'undecided',
      }),
      'split_edit',
    );
    assert.equal(
      resolveCheckoutDetailPhase({
        splitMode: 'custom',
        collected: 0,
        pathChoice: 'undecided',
      }),
      'split_edit',
    );
  });

  it('allows return to path chooser only while whole_table zero-collect after a choice', () => {
    assert.equal(
      canReturnToCheckoutPathChooser({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'whole_table',
      }),
      true,
    );
    assert.equal(
      canReturnToCheckoutPathChooser({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'split',
      }),
      true,
    );
    assert.equal(
      canReturnToCheckoutPathChooser({
        splitMode: 'whole_table',
        collected: 0,
        pathChoice: 'undecided',
      }),
      false,
    );
    assert.equal(
      canReturnToCheckoutPathChooser({
        splitMode: 'whole_table',
        collected: 5,
        pathChoice: 'whole_table',
      }),
      false,
    );
    assert.equal(
      canReturnToCheckoutPathChooser({
        splitMode: 'even',
        collected: 0,
        pathChoice: 'whole_table',
      }),
      false,
    );
  });

  it('blocks by-item close while pool remains; allows when pool empty and payable paid', () => {
    assert.equal(
      checkoutSplitCloseAllowed({
        splitMode: 'by_item',
        byItemComplete: false,
        rows: [{ amount: 3.5, paid: true }],
      }),
      false,
    );
    assert.equal(
      checkoutSplitCloseAllowed({
        splitMode: 'by_item',
        byItemComplete: true,
        rows: [
          { amount: 3.5, paid: true },
          { amount: 0, paid: false },
        ],
      }),
      true,
    );
    assert.equal(
      checkoutSplitCloseAllowed({
        splitMode: 'even',
        byItemComplete: false,
        rows: [
          { amount: 23, paid: true },
          { amount: 23, paid: false },
        ],
      }),
      false,
    );
    assert.equal(
      checkoutSplitCloseAllowed({
        splitMode: 'custom',
        byItemComplete: false,
        rows: [
          { amount: 10, paid: true },
          { amount: 0, paid: false },
        ],
      }),
      true,
    );
  });
});
