import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
  WAITER_BOARD_TABLES_GRID_CLASS,
} from './waiter-board-card-layout';

describe('waiter-board-card-layout grid breakpoints', () => {
  it('grouped tables cap at 3 columns (1 → 2 → 3)', () => {
    assert.equal(
      WAITER_BOARD_TABLES_GRID_CLASS,
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
    );
  });

  it('pinned checkout matches the same max column count', () => {
    assert.equal(
      WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
    );
  });
});
