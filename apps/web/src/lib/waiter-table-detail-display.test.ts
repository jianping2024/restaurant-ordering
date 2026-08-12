import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatWaiterOrderedItemsSessionTotal,
  formatWaiterTableDetailHeading,
} from '@/lib/waiter-table-detail-display';

describe('formatWaiterTableDetailHeading', () => {
  it('joins details title and display_name without a table prefix (zh)', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', '002'), '桌台详情 · 002');
  });

  it('joins details title and display_name without a table prefix (en)', () => {
    assert.equal(formatWaiterTableDetailHeading('en', '002'), 'Table details · 002');
  });

  it('joins details title and display_name without a table prefix (pt)', () => {
    assert.equal(formatWaiterTableDetailHeading('pt', '002'), 'Detalhes da mesa · 002');
  });

  it('passes through custom display names unchanged', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', 'VIP-A'), '桌台详情 · VIP-A');
  });

  it('supports loading placeholder', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', '…'), '桌台详情 · …');
  });
});

describe('formatWaiterOrderedItemsSessionTotal', () => {
  it('formats zh total line', () => {
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('zh', 105.3), {
      mealsLine: null,
      totalLine: '合计: €105.30',
    });
  });

  it('formats en/pt total line', () => {
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('en', 27.95), {
      mealsLine: null,
      totalLine: 'Total: €27.95',
    });
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('pt', 27.95), {
      mealsLine: null,
      totalLine: 'Total: €27.95',
    });
  });

  it('includes meals line when meals > 0 (zh)', () => {
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('zh', 595.35, 300), {
      mealsLine: '饮食: €300.00',
      totalLine: '合计: €595.35',
    });
  });

  it('includes meals line when meals > 0 (en)', () => {
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('en', 595.35, 300), {
      mealsLine: 'Food & drink: €300.00',
      totalLine: 'Total: €595.35',
    });
  });

  it('omits meals line when meals is zero', () => {
    assert.deepEqual(formatWaiterOrderedItemsSessionTotal('zh', 105.3, 0), {
      mealsLine: null,
      totalLine: '合计: €105.30',
    });
  });

  it('hides zero or negative totals', () => {
    assert.equal(formatWaiterOrderedItemsSessionTotal('zh', 0), null);
    assert.equal(formatWaiterOrderedItemsSessionTotal('zh', -1), null);
    assert.equal(formatWaiterOrderedItemsSessionTotal('zh', 0, 10), null);
  });
});
