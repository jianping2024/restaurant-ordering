import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReturnToCheckoutPathChooser,
  initialStaffCheckoutPathChoice,
  resolveCheckoutDetailPhase,
} from './checkout-detail-phase';

describe('checkout-detail-phase', () => {
  it('initial pathChoice opens whole_table on settle; other modes stay undecided', () => {
    assert.equal(initialStaffCheckoutPathChoice('whole_table'), 'whole_table');
    assert.equal(initialStaffCheckoutPathChoice('even'), 'undecided');
    assert.equal(initialStaffCheckoutPathChoice('by_item'), 'undecided');
  });

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

  it('keeps even and by_item on split_edit and settles a paid whole table', () => {
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
