import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
  WAITER_BOARD_TABLES_GRID_CLASS,
} from './waiter-board-card-layout';
import { WAITER_BOARD_LANE_TO_CARD_CLEARANCE } from './waiter-board-card-theme';

describe('waiter-board-card-layout grid breakpoints', () => {
  it('grouped tables cap at 3 columns (1 → 2 → 3) and use sole lane scroll-margin', () => {
    assert.match(WAITER_BOARD_TABLES_GRID_CLASS, /grid-cols-1/);
    assert.match(WAITER_BOARD_TABLES_GRID_CLASS, /sm:grid-cols-2/);
    assert.match(WAITER_BOARD_TABLES_GRID_CLASS, /lg:grid-cols-3/);
    assert.equal(
      WAITER_BOARD_TABLES_GRID_CLASS.includes(
        WAITER_BOARD_LANE_TO_CARD_CLEARANCE.gridScrollMargin,
      ),
      true,
    );
  });

  it('pinned checkout matches column count but not lane scroll-margin (above dock)', () => {
    assert.match(WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS, /grid-cols-1/);
    assert.match(WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS, /sm:grid-cols-2/);
    assert.match(WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS, /lg:grid-cols-3/);
    assert.equal(
      WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS.includes(
        WAITER_BOARD_LANE_TO_CARD_CLEARANCE.gridScrollMargin,
      ),
      false,
    );
  });
});
