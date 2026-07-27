import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCheckoutPinnedSectionTitle,
  isWaiterBoardTableCardClickable,
} from './waiter-board-permissions';

describe('isWaiterBoardTableCardClickable', () => {
  it('allows frontdesk to click checkout tables', () => {
    assert.equal(isWaiterBoardTableCardClickable(true, 'checkout'), true);
  });

  it('blocks waiter staff from clicking checkout tables', () => {
    assert.equal(isWaiterBoardTableCardClickable(false, 'checkout'), false);
  });

  it('allows waiter staff to click dining and idle tables', () => {
    assert.equal(isWaiterBoardTableCardClickable(false, 'dining'), true);
    assert.equal(isWaiterBoardTableCardClickable(false, 'idle'), true);
  });
});

describe('formatCheckoutPinnedSectionTitle', () => {
  it('prefixes table count in pinned section title', () => {
    assert.equal(
      formatCheckoutPinnedSectionTitle(1, '{n} 桌 待结账（等收银）'),
      '1 桌 待结账（等收银）',
    );
    assert.equal(
      formatCheckoutPinnedSectionTitle(3, '{n} table(s) awaiting checkout (cashier)'),
      '3 table(s) awaiting checkout (cashier)',
    );
  });
});
