import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBillSyncJobPayload } from './bill-sync-build-payload';
import { buildBillSyncLine, findBillSyncItemCodeConflict } from './bill-sync-payload';
import { sumBillableSessionTotal } from './billable-session-lines';
import { checkoutLinesFromOrders } from './checkout-session-lines';
import {
  TAKEAWAY_ITEM_CODE,
  TAKEAWAY_LINE_NAME,
  buildTakeawayChargeItem,
  parseTakeawayAmount,
  parseTakeawayLines,
  parseTakeawayQty,
  parseTakeawayVatRatePatch,
  resolveTakeawayVatRate,
} from './checkout-takeaway';
import { countSubmittedDishPortions } from './order-list-display';
import { distinctMenuItemIdsFromOrders } from './menu-item-code';
import { applyOrderItemDecrement } from './order-item-void/decrement-order-item';
import { isMenuCatalogItem, kitchenRelevantItems } from './order-items';
import { buildReceiptLinesFromOrders } from './order-receipt-enqueue';
import { deriveOrderStatusFromItems } from './order-status';
import { vatPercentForOrderItem } from './order-line-vat';
import type { Order, OrderItem } from '@/types';

const MENU_ID = '47cd765c-1443-454a-bd75-e73638c310f5';

function takeaway(amount: number, lineId: string, qty = 1): OrderItem {
  return buildTakeawayChargeItem({
    lineId,
    amount,
    qty,
    batchId: 'b1',
    addedAt: '2026-10-23T17:00:00.000Z',
  });
}

function orderWith(items: OrderItem[]): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    display_name: 'A-01',
    session_id: 'sess-1',
    status: 'done',
    total_amount: 0,
    created_at: '2026-10-23T16:00:00.000Z',
    updated_at: '2026-10-23T16:00:00.000Z',
    items,
  };
}

const beer: OrderItem = {
  id: MENU_ID,
  name: 'Beer',
  name_pt: 'Cerveja',
  qty: 2,
  price: 2.25,
  emoji: '🍺',
  item_code: '006',
  item_status: 'done',
};

describe('parseTakeawayAmount', () => {
  const cases: Array<[unknown, number | null]> = [
    [5, 5],
    ['3.5', 3.5],
    [0.1, 0.1],
    [12.34, 12.34],
    [0, null],
    [-1, null],
    [1.234, null],
    [1000.01, null],
    ['abc', null],
    [null, null],
  ];
  for (const [raw, want] of cases) {
    it(`${JSON.stringify(raw)} → ${want}`, () => {
      assert.equal(parseTakeawayAmount(raw), want);
    });
  }
});

describe('parseTakeawayQty', () => {
  it('accepts 1..99 integers only', () => {
    assert.equal(parseTakeawayQty(1), 1);
    assert.equal(parseTakeawayQty(99), 99);
    assert.equal(parseTakeawayQty(0), null);
    assert.equal(parseTakeawayQty(1.5), null);
    assert.equal(parseTakeawayQty(100), null);
  });
});

describe('parseTakeawayLines', () => {
  it('sole POST shape lines[{amount,qty}]', () => {
    assert.deepEqual(parseTakeawayLines({ lines: [{ amount: 1.5, qty: 2 }] }), [
      { amount: 1.5, qty: 2 },
    ]);
    assert.equal(parseTakeawayLines({ amounts: [1.5] }), null);
    assert.equal(parseTakeawayLines({ lines: [{ amount: 1.5, qty: 0 }] }), null);
  });
});

describe('takeaway VAT setting', () => {
  it('resolve falls back to 13 and rounds', () => {
    assert.equal(resolveTakeawayVatRate(undefined), 13);
    assert.equal(resolveTakeawayVatRate('23'), 23);
    assert.equal(resolveTakeawayVatRate(101), 13);
  });
  it('patch: undefined when absent, null when invalid', () => {
    assert.equal(parseTakeawayVatRatePatch({}), undefined);
    assert.equal(parseTakeawayVatRatePatch({ takeawayVatRate: 6 }), 6);
    assert.equal(parseTakeawayVatRatePatch({ takeawayVatRate: 6.5 }), null);
    assert.equal(parseTakeawayVatRatePatch({ takeawayVatRate: -1 }), null);
  });
});

describe('takeaway line classification', () => {
  const line = takeaway(5, 'l1');

  it('fixed name, default qty 1, not a menu dish', () => {
    assert.equal(line.name_pt, TAKEAWAY_LINE_NAME);
    assert.equal(line.qty, 1);
    assert.equal(line.id, 'takeaway:l1');
    assert.equal(isMenuCatalogItem(line), false);
  });

  it('qty multiplies billable total', () => {
    const multi = takeaway(2.5, 'm1', 3);
    assert.equal(multi.qty, 3);
    assert.equal(sumBillableSessionTotal([orderWith([multi])]), 7.5);
    const screen = checkoutLinesFromOrders([orderWith([multi])], 'zh');
    assert.equal(screen[0]?.quantityLabel, '× 3');
    assert.equal(screen[0]?.lineTotal, 7.5);
  });

  it('receipt lines keep unit price and qty for take-away', () => {
    const lines = buildReceiptLinesFromOrders(
      [orderWith([takeaway(2.5, 'r1', 3)])],
      'pt',
      { byMenuId: {}, byBuffetId: {}, takeaway: 13 },
    );
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.qty, 3);
    assert.equal(lines[0]?.unit_price, 2.5);
    assert.match(lines[0]!.display_name, /TAKE AWAY/);
  });

  it('never reaches kitchen or menu_items lookups', () => {
    const orders = [orderWith([beer, line])];
    assert.deepEqual(kitchenRelevantItems([beer, line]), [beer]);
    assert.deepEqual(distinctMenuItemIdsFromOrders(orders), [MENU_ID]);
    assert.equal(countSubmittedDishPortions(orders), 2);
  });

  it('order with only take-away lines is done (nothing to cook)', () => {
    assert.equal(deriveOrderStatusFromItems([line]), 'done');
  });

  it('is billed and removable at checkout', () => {
    const orders = [orderWith([beer, line, takeaway(3.5, 'l2')])];
    assert.equal(sumBillableSessionTotal(orders), 4.5 + 5 + 3.5);
    const rows = checkoutLinesFromOrders(orders, 'zh');
    const ids = rows.map((r) => r.takeawayLineId).filter(Boolean);
    assert.deepEqual(ids, ['takeaway:l1', 'takeaway:l2']);

    const removed = applyOrderItemDecrement(orders[0]!.items, 1, 'done');
    assert.equal(removed.ok, true);
    if (!removed.ok) return;
    assert.equal(removed.outcome, 'voided');
    assert.equal(sumBillableSessionTotal([orderWith(removed.nextItems)]), 4.5 + 3.5);
  });

  it('trash voids multi-qty take-away in one step', () => {
    const multi = takeaway(2, 'mq', 4);
    const removed = applyOrderItemDecrement([multi], 0, 'done');
    assert.equal(removed.ok, true);
    if (!removed.ok) return;
    assert.equal(removed.outcome, 'voided');
    assert.equal(sumBillableSessionTotal([orderWith(removed.nextItems)]), 0);
  });

  it('VAT comes from the restaurant take-away rate', () => {
    assert.equal(vatPercentForOrderItem(line, { byMenuId: {}, byBuffetId: {}, takeaway: 13 }), 13);
    assert.equal(vatPercentForOrderItem(line, { byMenuId: {}, byBuffetId: {}, takeaway: null }), null);
  });
});

describe('takeaway fiscal lines', () => {
  const orders = [orderWith([beer, takeaway(0.1, 'a'), takeaway(0.2, 'b'), takeaway(0.3, 'c')])];
  const base = {
    requestId: '22222222-2222-4222-8222-222222222222',
    billSplitId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    tableDisplayName: 'A-01',
    orders,
    itemCodeByMenuId: { [MENU_ID]: '006' },
  };

  it('whole_table: one TAKEAWAY line per charge, not merged, qty 1, open_price', () => {
    const built = buildBillSyncJobPayload({
      ...base,
      splitMode: 'whole_table',
      persons: [{ name: '__whole_table__' }],
      vatRates: { byMenuId: { [MENU_ID]: 23 }, byBuffetId: {}, takeaway: 13 },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const ta = (built.payload.lines ?? []).filter((l) => l.item_code === TAKEAWAY_ITEM_CODE);
    assert.deepEqual(
      ta.map((l) => [l.name, l.qty, l.unit_price_gross, l.vat_rate, l.open_price]),
      [
        [TAKEAWAY_LINE_NAME, '1.00', '0.10', '13.00', true],
        [TAKEAWAY_LINE_NAME, '1.00', '0.20', '13.00', true],
        [TAKEAWAY_LINE_NAME, '1.00', '0.30', '13.00', true],
      ],
    );
    const beerLine = built.payload.lines?.find((l) => l.item_code === '006');
    assert.equal(beerLine?.open_price, undefined);
    assert.equal(built.payload.gross_total, '5.10');
  });

  it('whole_table: take-away qty>1 keeps unit price and multiplies line_gross', () => {
    const built = buildBillSyncJobPayload({
      ...base,
      orders: [orderWith([takeaway(2.5, 'q3', 3)])],
      splitMode: 'whole_table',
      persons: [{ name: '__whole_table__' }],
      vatRates: { byMenuId: {}, byBuffetId: {}, takeaway: 13 },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const ta = (built.payload.lines ?? []).filter((l) => l.item_code === TAKEAWAY_ITEM_CODE);
    assert.equal(ta.length, 1);
    assert.deepEqual(
      [ta[0]?.qty, ta[0]?.unit_price_gross, ta[0]?.line_gross, ta[0]?.open_price],
      ['3.00', '2.50', '7.50', true],
    );
    assert.equal(built.payload.gross_total, '7.50');
  });

  it('by_item: each guest invoice carries only their take-away share (half = 0.50 qty)', () => {
    const lines = [takeaway(5, 'p1'), takeaway(2, 'p2')];
    const built = buildBillSyncJobPayload({
      ...base,
      orders: [orderWith(lines)],
      splitMode: 'by_item',
      persons: [
        {
          name: 'Ana',
          item_shares: [
            { key: 'takeaway:p1::5', qty_num: 1, qty_den: 1 },
            { key: 'takeaway:p2::2', qty_num: 1, qty_den: 2 },
          ],
        },
        { name: 'Bruno', item_shares: [{ key: 'takeaway:p2::2', qty_num: 1, qty_den: 2 }] },
      ],
      vatRates: { byMenuId: {}, byBuffetId: {}, takeaway: 13 },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const byName = Object.fromEntries(
      (built.payload.splits ?? []).map((s) => [
        s.name,
        s.lines.map((l) => [l.item_code, l.qty, l.unit_price_gross, l.line_gross, l.open_price]),
      ]),
    );
    assert.deepEqual(byName.Ana, [
      [TAKEAWAY_ITEM_CODE, '1.00', '5.00', '5.00', true],
      [TAKEAWAY_ITEM_CODE, '0.50', '2.00', '1.00', true],
    ]);
    assert.deepEqual(byName.Bruno, [[TAKEAWAY_ITEM_CODE, '0.50', '2.00', '1.00', true]]);
  });

  it('fails closed without a take-away VAT rate', () => {
    const built = buildBillSyncJobPayload({
      ...base,
      splitMode: 'whole_table',
      persons: [{ name: '__whole_table__' }],
      vatRates: { byMenuId: { [MENU_ID]: 23 }, byBuffetId: {}, takeaway: null },
    });
    assert.equal(built.ok, false);
  });
});

describe('findBillSyncItemCodeConflict open_price', () => {
  const line = (price: number, open: boolean) => {
    const built = buildBillSyncLine({
      item_code: TAKEAWAY_ITEM_CODE,
      name: TAKEAWAY_LINE_NAME,
      qty: 1,
      unit_price_gross: price,
      line_gross: price,
      vat_rate_percent: 13,
      open_price: open,
    });
    assert.ok(!('error' in built));
    return built as Exclude<typeof built, { error: string }>;
  };

  it('allows different prices when both lines are open-price', () => {
    assert.equal(findBillSyncItemCodeConflict([line(0.1, true), line(0.2, true)]), null);
  });

  it('still rejects different prices on catalog lines', () => {
    assert.deepEqual(findBillSyncItemCodeConflict([line(0.1, false), line(0.2, false)]), {
      item_code: TAKEAWAY_ITEM_CODE,
    });
  });
});
