import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countVisibleCategoryPills } from './customer-menu-category-overflow';

describe('countVisibleCategoryPills', () => {
  it('shows every chip when the full row fits without More', () => {
    assert.equal(
      countVisibleCategoryPills({
        containerWidth: 400,
        chipWidths: [80, 80, 80],
        moreWidth: 72,
      }),
      3,
    );
  });

  it('reserves More and packs remaining chips when the row overflows', () => {
    assert.equal(
      countVisibleCategoryPills({
        containerWidth: 260,
        chipWidths: [80, 80, 80, 80],
        moreWidth: 72,
      }),
      2,
    );
  });

  it('can show only More when no chip fits beside it', () => {
    assert.equal(
      countVisibleCategoryPills({
        containerWidth: 80,
        chipWidths: [120, 120],
        moreWidth: 72,
      }),
      0,
    );
  });
});
