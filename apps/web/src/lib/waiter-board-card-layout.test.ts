import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
  WAITER_BOARD_TABLES_GRID_CLASS,
} from './waiter-board-card-layout';

describe('waiter-board-card-layout grid breakpoints', () => {
  it('grouped tables restore md:5 lg:6 with single column on phones', () => {
    assert.equal(
      WAITER_BOARD_TABLES_GRID_CLASS,
      'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3',
    );
  });

  it('pinned checkout uses one fewer column per breakpoint than grouped tables', () => {
    assert.equal(
      WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
      'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3',
    );
  });
});
