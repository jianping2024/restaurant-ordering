import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReturnToCheckoutPathChooser,
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

  it('locks settle when collected or not whole_table', () => {
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
      'settle',
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
});
