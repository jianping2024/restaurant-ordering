import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplitOrderLine } from '@/lib/bill-split-by-item-lines';
import {
  buildGuestReviewableItems,
  mineByItemFeedbackOrderKeys,
} from '@/lib/guest-reviewable-items';
import type { SplitPerson } from '@/types';

const ORDER = '11111111-1111-4111-8111-111111111111';
const DISH_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DISH_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DISH_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PARTY_ME = '22222222-2222-4222-8222-222222222222';
const PARTY_OTHER = '33333333-3333-4333-8333-333333333333';

function menuLine(
  key: string,
  id: string,
  qty: number,
  extras: Partial<BillSplitOrderLine> = {},
): BillSplitOrderLine {
  return {
    key,
    id,
    name: id,
    name_pt: id,
    qty,
    price: 10,
    emoji: '🍣',
    order_id: ORDER,
    ...extras,
  };
}

describe('buildGuestReviewableItems', () => {
  const orderLines = [
    menuLine(`${DISH_A}::10`, DISH_A, 2),
    menuLine(`${DISH_B}::10`, DISH_B, 1),
    menuLine(`${DISH_C}::10`, DISH_C, 3),
  ];

  it('whole_table / even lists the full session catalog', () => {
    for (const splitMode of ['whole_table', 'even'] as const) {
      const items = buildGuestReviewableItems({
        splitMode,
        orderLines,
        splitOrderLines: orderLines,
        persons: [],
        mineTicketKeys: [],
        lang: 'zh',
        fallbackOrderId: ORDER,
      });
      assert.equal(items.length, 3);
      assert.deepEqual(
        items.map((row) => row.menu_item_id).sort(),
        [DISH_A, DISH_B, DISH_C].sort(),
      );
      const byId = new Map(items.map((row) => [row.menu_item_id, row]));
      assert.equal(byId.get(DISH_A)?.qtyLabel, '2');
      assert.equal(byId.get(DISH_B)?.qtyLabel, '1');
    }
  });

  it('by_item lists only this phone ticket shares', () => {
    const persons: SplitPerson[] = [
      {
        name: 'Me',
        party_id: PARTY_ME,
        item_shares: [
          { key: `${DISH_A}::10`, qty_num: 1, qty_den: 1, party_id: PARTY_ME },
          { key: `${DISH_B}::10`, qty_num: 1, qty_den: 2, party_id: PARTY_ME },
        ],
      },
      {
        name: 'Other',
        party_id: PARTY_OTHER,
        item_shares: [
          { key: `${DISH_C}::10`, qty_num: 3, qty_den: 1, party_id: PARTY_OTHER },
        ],
      },
    ];
    const items = buildGuestReviewableItems({
      splitMode: 'by_item',
      orderLines,
      splitOrderLines: orderLines,
      persons,
      mineTicketKeys: [`p:${PARTY_ME}`],
      lang: 'zh',
      fallbackOrderId: ORDER,
    });
    assert.equal(items.length, 2);
    const byId = new Map(items.map((row) => [row.menu_item_id, row]));
    assert.equal(byId.get(DISH_A)?.qtyLabel, '1');
    assert.equal(byId.get(DISH_B)?.qtyLabel, '1/2');
    assert.equal(byId.has(DISH_C), false);
  });

  it('by_item formats 1/3 without float dump', () => {
    const persons: SplitPerson[] = [
      {
        name: 'Me',
        party_id: PARTY_ME,
        item_shares: [
          { key: `${DISH_A}::10`, qty_num: 1, qty_den: 3, party_id: PARTY_ME },
        ],
      },
    ];
    const items = buildGuestReviewableItems({
      splitMode: 'by_item',
      orderLines,
      splitOrderLines: orderLines,
      persons,
      mineTicketKeys: [`p:${PARTY_ME}`],
      lang: 'zh',
      fallbackOrderId: ORDER,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.qtyLabel, '1/3');
  });

  it('by_item with no mine tickets yields empty', () => {
    const items = buildGuestReviewableItems({
      splitMode: 'by_item',
      orderLines,
      splitOrderLines: orderLines,
      persons: [
        {
          name: 'Other',
          party_id: PARTY_OTHER,
          item_shares: [
            { key: `${DISH_C}::10`, qty_num: 1, qty_den: 1, party_id: PARTY_OTHER },
          ],
        },
      ],
      mineTicketKeys: [],
      lang: 'zh',
      fallbackOrderId: ORDER,
    });
    assert.equal(items.length, 0);
  });

  it('skips buffet_base and voided lines on whole_table', () => {
    const mixed = [
      menuLine(`${DISH_A}::10`, DISH_A, 1),
      menuLine('buffet:x', 'buffet:x', 1, { kind: 'buffet_base' }),
      menuLine(`${DISH_B}::10`, DISH_B, 1, { item_status: 'voided' }),
    ];
    const items = buildGuestReviewableItems({
      splitMode: 'whole_table',
      orderLines: mixed,
      splitOrderLines: mixed,
      persons: [],
      mineTicketKeys: [],
      lang: 'zh',
      fallbackOrderId: ORDER,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.menu_item_id, DISH_A);
  });
});

describe('mineByItemFeedbackOrderKeys', () => {
  it('returns order:menu keys for mine shares only', () => {
    const keys = mineByItemFeedbackOrderKeys({
      persons: [
        {
          name: 'Me',
          party_id: PARTY_ME,
          item_shares: [
            { key: 'L1', qty_num: 1, qty_den: 1, party_id: PARTY_ME },
            { key: 'L2', qty_num: 0, qty_den: 1, party_id: PARTY_ME },
          ],
        },
        {
          name: 'Other',
          party_id: PARTY_OTHER,
          item_shares: [{ key: 'L3', qty_num: 1, qty_den: 1, party_id: PARTY_OTHER }],
        },
      ],
      mineTicketKeys: new Set([`p:${PARTY_ME}`]),
      catalogByLineKey: new Map([
        ['L1', { menuItemId: DISH_A, orderId: ORDER }],
        ['L2', { menuItemId: DISH_B, orderId: ORDER }],
        ['L3', { menuItemId: DISH_C, orderId: ORDER }],
      ]),
    });
    assert.deepEqual([...keys], [`${ORDER}:${DISH_A}`]);
  });
});
