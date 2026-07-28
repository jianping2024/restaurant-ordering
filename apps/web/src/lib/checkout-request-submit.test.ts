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
import { validateSubmittedCheckoutSplit } from '@/lib/checkout-request-submit';
import type { Order } from '@/types';

function sushiChargeableOrders(adultCount: number, sushiQty: number): Order[] {
  return [
    {
      id: 'o1',
      status: 'pending',
      items: [
        {
          id: 'buffet:b1',
          kind: 'buffet_base',
          buffet_id: 'b1',
          adult_count: adultCount,
          child_count: 0,
          adult_unit_price: 14.95,
          child_unit_price: 10,
          name: 'Buffet livre',
          name_pt: 'Buffet livre',
          qty: 1,
          price: 14.95 * adultCount,
          emoji: '',
          item_status: 'done',
        },
        {
          id: 'm1',
          name: 'susi1',
          name_pt: 'susi1',
          qty: sushiQty,
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
}

function wholeTableAssignedPersons(orders: Order[]) {
  const orderLines = buildBillSplitOrderLines(orders);
  const lineSpecs = buildByItemLineSpecs(orderLines);
  const allocations: Record<
    string,
    Array<{ name: string; qty: { num: number; den: number }; guestType?: 'adult' | 'child' }>
  > = {};
  for (const spec of lineSpecs) {
    if (spec.mode === 'buffet') {
      allocations[spec.key] = [{
        name: 'Guest 1',
        qty: { num: spec.adults, den: 1 },
        guestType: 'adult',
      }];
    } else {
      allocations[spec.key] = [{ name: 'Guest 1', qty: { num: spec.lineQty, den: 1 } }];
    }
  }
  return buildSplitPersonsFromAllocations(allocations);
}

describe('validateSubmittedCheckoutSplit', () => {
  it('accepts by_item split when total uses billable session authority (sushi chargeable)', () => {
    const orders = sushiChargeableOrders(1, 3);
    const persons = wholeTableAssignedPersons(orders);
    const orderLines = buildBillSplitOrderLines(orders);
    const lineSpecs = buildByItemLineSpecs(orderLines);
    const splitLines = orderLines.map((line) =>
      byItemSplitLineFromOrderLine(line, (line.name || line.name_pt || '').trim()),
    );
    const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
    const result = calcByItemSplitResults({ lines: splitLines, allocations });

    const outcome = validateSubmittedCheckoutSplit(orders, {
      splitMode: 'by_item',
      persons,
      result,
    });

    assert.equal(outcome.total, 14.95 + 4.5);
    assert.equal(outcome.validation.ok, true);
    assert.equal(result.reduce((sum, row) => sum + row.amount, 0), 19.45);
  });
});
