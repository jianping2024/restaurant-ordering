import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBillSyncJobPayload } from './bill-sync-build-payload';
import { billSyncByItemScopeId } from './bill-sync-scope-id';
import type { Order, SplitPerson } from '@/types';

const BILL_SPLIT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const MENU_ID = 'menu-beer';

const orders: Order[] = [
  {
    id: ORDER_ID,
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    display_name: 'A-02',
    session_id: 'sess-1',
    status: 'done',
    total_amount: 4.5,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
    items: [
      {
        id: MENU_ID,
        name: 'Beer',
        name_pt: 'Cerveja',
        qty: 2,
        price: 2.25,
        emoji: '🍺',
        item_code: '006',
        category_code_path: ['BE'],
      },
    ],
  },
];

function menuLineKey(): string {
  // Same key shape as buildBillableSessionItems / by-item catalog.
  return `${MENU_ID}::2.25`;
}

describe('billSyncByItemScopeId', () => {
  it('is stable for same bill + person and differs across persons', () => {
    const a = billSyncByItemScopeId(BILL_SPLIT_ID, 'Jacky');
    const b = billSyncByItemScopeId(BILL_SPLIT_ID, 'Jacky');
    const c = billSyncByItemScopeId(BILL_SPLIT_ID, 'Tom');
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f-]{36}$/i);
  });
});

describe('buildBillSyncJobPayload', () => {
  it('builds whole_table for even/custom/whole_table', () => {
    for (const splitMode of ['whole_table', 'even', 'custom'] as const) {
      const built = buildBillSyncJobPayload({
        requestId: '22222222-2222-4222-8222-222222222222',
        billSplitId: BILL_SPLIT_ID,
        tableDisplayName: 'A-02',
        splitMode,
        persons: [{ name: 'Jacky' }, { name: 'Tom' }],
        orders,
        itemCodeByMenuId: { [MENU_ID]: '006' },
        vatRateByMenuId: { [MENU_ID]: 23 },
        defaultVatRatePercent: 23,
      });
      assert.equal(built.ok, true);
      if (!built.ok) return;
      assert.equal(built.payload.scope_type, 'whole_table');
      assert.equal(built.payload.gross_total, '4.50');
      assert.equal(built.payload.lines?.length, 1);
      assert.equal(built.payload.splits, undefined);
    }
  });

  it('builds split payload for by_item with stable scope_id per person', () => {
    const key = menuLineKey();
    const persons: SplitPerson[] = [
      { name: 'Jacky', item_shares: [{ key, qty_num: 1, qty_den: 1 }] },
      { name: 'Tom', item_shares: [{ key, qty_num: 1, qty_den: 1 }] },
    ];
    const built = buildBillSyncJobPayload({
      requestId: '33333333-3333-4333-8333-333333333333',
      billSplitId: BILL_SPLIT_ID,
      tableDisplayName: 'A-02',
      splitMode: 'by_item',
      persons,
      orders,
      itemCodeByMenuId: { [MENU_ID]: '006' },
      vatRateByMenuId: { [MENU_ID]: 23 },
      defaultVatRatePercent: 23,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.payload.scope_type, 'split');
    assert.equal(built.payload.lines, undefined);
    assert.equal(built.payload.gross_total, undefined);
    assert.equal(built.payload.splits?.length, 2);
    const jacky = built.payload.splits?.[0];
    const tom = built.payload.splits?.[1];
    assert.equal(jacky?.name, 'Jacky');
    assert.equal(tom?.name, 'Tom');
    assert.equal(jacky?.scope_id, billSyncByItemScopeId(BILL_SPLIT_ID, 'Jacky'));
    assert.equal(tom?.scope_id, billSyncByItemScopeId(BILL_SPLIT_ID, 'Tom'));
    assert.equal(jacky?.gross_total, '2.25');
    assert.equal(tom?.gross_total, '2.25');
    assert.equal(jacky?.lines[0]?.item_code, '006');
    assert.equal(jacky?.lines[0]?.qty, '1.00');
  });
});
