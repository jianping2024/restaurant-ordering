import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import { isLimitedBillableRow, sumBillableSessionTotal } from '@/lib/billable-session-lines';
import {
  buildBillSplitOrderLines,
  buildByItemSplitOrderLines,
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

  it('uses billable projection for limited sushi lines (free portions are €0)', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 3,
            price: 1.5,
            emoji: '',
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
            added_at: '2026-01-01T00:00:00.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    const splitLines = buildByItemSplitOrderLines(orders);
    const limitedCatalog = buildBillSplitOrderLines(orders).find((line) =>
      isLimitedBillableRow({ key: line.key }),
    );
    assert.ok(limitedCatalog);
    assert.equal(limitedCatalog?.qty, 3);

    const specs = buildByItemLineSpecs(splitLines);
    const limited = specs.find((spec) => isLimitedBillableRow({ key: spec.key }));
    assert.equal(limited, undefined);

    const splitTotal = specs.reduce((sum, spec) => sum + spec.lineTotal, 0);
    assert.equal(splitTotal, sumBillableSessionTotal(orders));
  });

  it('splits only chargeable qty for limited sushi (not physical qty)', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 1,
            child_count: 0,
            adult_unit_price: 14.95,
            child_unit_price: 9.5,
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 14.95,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 4,
            price: 0,
            emoji: '',
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
            added_at: '2026-01-01T00:00:00.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    const specs = buildByItemLineSpecs(buildByItemSplitOrderLines(orders));
    const limited = specs.find((spec) => isLimitedBillableRow({ key: spec.key }));
    assert.ok(limited && limited.mode === 'menu');
    if (limited?.mode === 'menu') {
      assert.equal(limited.lineQty, 2);
      assert.equal(limited.lineTotal, 9);
      assert.equal(limited.unitPrice, 4.5);
    }
  });
});
