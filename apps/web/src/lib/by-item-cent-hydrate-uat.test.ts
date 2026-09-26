import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateByItemShareAmounts,
  buildByItemAllocationsFromRows,
  calcByItemSplitResults,
  parseConsumerRowQty,
} from './bill-split-by-item';
import { buildByItemLineSpecs } from './bill-split-by-item-lines';
import {
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
} from './checkout-split-continuation';
import type { BillSplitOrderLine } from './bill-split-by-item-lines';
import type { SessionCollectedPayment } from './checkout-session-payments';

const WATER = '420667ec-e0d4-4343-8f00-99a0beba61b1::1.85';
const BUFFET = 'buffet:6b5606fc-29c7-4656-b428-8dd6b314306f';

describe('hydrate A-03 water split after collect', () => {
  it('keeps 2.78/2.77/1.85 (not 3.18/3.17/1.05)', () => {
    const persons = [
      {
        name: '客人 1',
        item_shares: [{ key: BUFFET, qty_num: 1, qty_den: 1, guest_type: 'adult' as const }],
      },
      { name: '客人 2', item_shares: [{ key: WATER, qty_num: 3, qty_den: 2 }] },
      { name: '客人 3', item_shares: [{ key: WATER, qty_num: 3, qty_den: 2 }] },
      { name: '客人 4', item_shares: [{ key: WATER, qty_num: 1, qty_den: 1 }] },
    ];
    const orderLines: BillSplitOrderLine[] = [
      {
        key: BUFFET,
        id: 'buffet:6b5606fc-29c7-4656-b428-8dd6b314306f',
        name: 'Buffet',
        name_pt: 'Buffet',
        emoji: '',
        price: 19.95,
        qty: 1,
        kind: 'buffet_base',
        buffet_id: '6b5606fc-29c7-4656-b428-8dd6b314306f',
        adult_count: 1,
        child_count: 0,
        adult_unit_price: 19.95,
        child_unit_price: 10,
      },
      {
        key: WATER,
        id: '420667ec-e0d4-4343-8f00-99a0beba61b1',
        name: 'Water',
        name_pt: 'Water',
        emoji: '',
        price: 1.85,
        qty: 4,
      },
    ];
    const lineSpecs = buildByItemLineSpecs(orderLines);
    const split = {
      id: 'x',
      split_mode: 'by_item' as const,
      persons,
      result: [
        { name: '客人 1', amount: 19.95, paid: true },
        { name: '客人 2', amount: 2.78, paid: true },
        { name: '客人 3', amount: 2.77, paid: true },
        { name: '客人 4', amount: 1.85, paid: false },
      ],
    };
    const payments = [
      { person_name: '客人 1', amount: 19.95, person_index: 0 },
      { person_name: '客人 2', amount: 2.78, person_index: 1 },
      { person_name: '客人 3', amount: 2.77, person_index: 2 },
    ] as SessionCollectedPayment[];
    const locks = buildLockedPersonLineMins(split as never, true, payments);
    const rows = buildByItemConsumerRowsFromPersons(persons, lineSpecs, locks);
    for (const row of rows[WATER] ?? []) {
      const qty = parseConsumerRowQty(row);
      assert.ok(qty, `row ${row.name} must parse: ${JSON.stringify(row)}`);
    }
    const allocations = buildByItemAllocationsFromRows(lineSpecs, rows);
    assert.deepEqual(
      allocations[WATER]?.map((share) => ({
        name: share.name,
        num: share.qty.num,
        den: share.qty.den,
      })),
      [
        { name: '客人 2', num: 3, den: 2 },
        { name: '客人 3', num: 3, den: 2 },
        { name: '客人 4', num: 1, den: 1 },
      ],
    );
    assert.deepEqual(
      allocateByItemShareAmounts(
        { key: WATER, name: 'w', mode: 'menu', qty: 4, unitPrice: 1.85 },
        allocations[WATER]!,
      ),
      [2.78, 2.77, 1.85],
    );
    const results = calcByItemSplitResults({
      lines: [
        {
          key: BUFFET,
          name: 'Buffet',
          mode: 'buffet',
          adults: 1,
          children: 0,
          adultUnitPrice: 19.95,
          childUnitPrice: 10,
        },
        { key: WATER, name: 'Water', mode: 'menu', qty: 4, unitPrice: 1.85 },
      ],
      allocations,
      personOrder: ['客人 1', '客人 2', '客人 3', '客人 4'],
    });
    assert.deepEqual(
      results.map((row) => ({ name: row.name, amount: row.amount })),
      [
        { name: '客人 1', amount: 19.95 },
        { name: '客人 2', amount: 2.78 },
        { name: '客人 3', amount: 2.77 },
        { name: '客人 4', amount: 1.85 },
      ],
    );
  });
});
