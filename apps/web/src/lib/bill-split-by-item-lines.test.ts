import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  buildBillSplitOrderLines,
  buildByItemLineSpecs,
} from './bill-split-by-item-lines';

describe('buildBillSplitOrderLines', () => {
  it('merges same menu item across orders into one catalog line', () => {
    const dish = {
      id: 'd1',
      name: 'Sumol',
      name_pt: 'Sumol',
      qty: 1,
      price: 2,
      emoji: '🥤',
    };
    const orders = [
      {
        id: 'o1',
        items: [dish],
      },
      {
        id: 'o2',
        items: [{ ...dish, qty: 2 }],
      },
    ] as Order[];

    const lines = buildBillSplitOrderLines(orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.key, 'd1::2');
    assert.equal(lines[0]?.qty, 3);
  });

  it('buildByItemLineSpecs matches merged qty', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'd1',
            name: 'Sumol',
            name_pt: 'Sumol',
            qty: 2,
            price: 2,
            emoji: '🥤',
          },
        ],
      },
    ] as Order[];

    const lines = buildBillSplitOrderLines(orders);
    const specs = buildByItemLineSpecs(lines);
    assert.equal(specs[0]?.mode, 'menu');
    if (specs[0]?.mode === 'menu') {
      assert.equal(specs[0].lineQty, 2);
      assert.equal(specs[0].lineTotal, 4);
    }
  });
});
