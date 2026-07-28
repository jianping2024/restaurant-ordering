import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildByItemAllocationsFromPersons,
  buildSplitPersonsFromAllocations,
  calcByItemSplitResults,
} from '@/lib/bill-split-by-item';
import {
  buildBillSplitOrderLines,
  buildByItemLineSpecs,
  byItemSplitLineFromOrderLine,
} from '@/lib/bill-split-by-item-lines';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { sumLineTotals } from '@/lib/cart-totals';
import type { Order } from '@/types';

/** Mirrors submitCheckoutRequestForTable billable total + validateBillSplit for by_item. */
function validateCheckoutByItemSplit(orders: Order[], persons: ReturnType<typeof buildSplitPersonsFromAllocations>) {
  const orderLines = buildBillSplitOrderLines(orders);
  const lineSpecs = buildByItemLineSpecs(orderLines);
  const total = sumBillableSessionTotal(orders);
  const splitLines = orderLines.map((line) =>
    byItemSplitLineFromOrderLine(line, (line.name || line.name_pt || '').trim()),
  );
  const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
  const results = calcByItemSplitResults({ lines: splitLines, allocations });
  return validateBillSplit({
    splitMode: 'by_item',
    total,
    results,
    lineSpecs,
    byItemAllocations: allocations,
  });
}

describe('checkout request billable total authority', () => {
  it('accepts by_item split when total uses sumBillableSessionTotal (sushi chargeable)', () => {
    const orders = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        session_id: 's1',
        table_id: 't1',
        display_name: 'A1',
        status: 'pending',
        total_amount: 17.95,
        created_at: '',
        updated_at: '',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 5,
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

    const orderLines = buildBillSplitOrderLines(orders);
    const lineSpecs = buildByItemLineSpecs(orderLines);
    const limitedKey = orderLines.find((line) => line.id === 'm1')!.key;

    const persons = buildSplitPersonsFromAllocations({
      [limitedKey]: [{ name: 'Guest 1', qty: { num: 5, den: 1 } }],
      [lineSpecs[0]!.key]: [
        { name: 'Guest 1', qty: { num: 2, den: 1 }, guestType: 'adult' },
      ],
    });

    const billableTotal = sumBillableSessionTotal(orders);
    const naiveTotal = sumLineTotals(orderLines);
    assert.equal(billableTotal, 35.9 + 4.5);
    assert.notEqual(naiveTotal, billableTotal);

    const validation = validateCheckoutByItemSplit(orders, persons);
    assert.equal(validation.ok, true);
  });

  it('would reject the same split if checkout used sumLineTotals (regression guard)', () => {
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
            child_unit_price: 10,
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 14.95,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 3,
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

    const orderLines = buildBillSplitOrderLines(orders);
    const lineSpecs = buildByItemLineSpecs(orderLines);
    const limitedKey = orderLines.find((line) => line.id === 'm1')!.key;
    const persons = buildSplitPersonsFromAllocations({
      [limitedKey]: [{ name: 'Guest 1', qty: { num: 3, den: 1 } }],
      [lineSpecs[0]!.key]: [
        { name: 'Guest 1', qty: { num: 1, den: 1 }, guestType: 'adult' },
      ],
    });

    const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
    const splitLines = orderLines.map((line) =>
      byItemSplitLineFromOrderLine(line, (line.name || line.name_pt || '').trim()),
    );
    const results = calcByItemSplitResults({ lines: splitLines, allocations });

    const billableTotal = sumBillableSessionTotal(orders);
    assert.equal(billableTotal, 14.95 + 4.5);

    assert.equal(
      validateBillSplit({
        splitMode: 'by_item',
        total: billableTotal,
        results,
        lineSpecs,
        byItemAllocations: allocations,
      }).ok,
      true,
    );

    assert.equal(
      validateBillSplit({
        splitMode: 'by_item',
        total: sumLineTotals(orderLines),
        results,
        lineSpecs,
        byItemAllocations: allocations,
      }).ok,
      false,
    );
  });
});
