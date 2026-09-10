import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bumpCartAddFeedbackKeyIfIncreased } from '@/lib/customer-cart-add-feedback';
import { sumCartQty } from '@/lib/cart-totals';
import { upsertCartItemQty } from '@/lib/customer-cart-lines';
import type { MenuItem } from '@/types';

const sampleItem = {
  id: 'item-1',
  name_pt: 'A',
  name_en: 'A',
  name_zh: 'A',
  price: 1.5,
  emoji: '🍜',
  note_preset_keys: [],
} as unknown as MenuItem;

describe('customer cart add feedback', () => {
  it('sumCartQty uses coerce rules', () => {
    assert.equal(sumCartQty([{ qty: 2 }, { qty: '3' }, { qty: 0 }]), 5);
  });

  it('bumps key only when total qty increases', () => {
    let key = 0;
    const setKey = (updater: number | ((k: number) => number)) => {
      key = typeof updater === 'function' ? updater(key) : updater;
    };

    const empty: { qty: number }[] = [];
    const one = upsertCartItemQty([], sampleItem, 1);
    bumpCartAddFeedbackKeyIfIncreased(setKey, empty, one);
    assert.equal(key, 1);

    const two = upsertCartItemQty(one, sampleItem, 2);
    bumpCartAddFeedbackKeyIfIncreased(setKey, one, two);
    assert.equal(key, 2);

    const back = upsertCartItemQty(two, sampleItem, 1);
    bumpCartAddFeedbackKeyIfIncreased(setKey, two, back);
    assert.equal(key, 2);

    const cleared = upsertCartItemQty(back, sampleItem, 0);
    bumpCartAddFeedbackKeyIfIncreased(setKey, back, cleared);
    assert.equal(key, 2);
  });
});
