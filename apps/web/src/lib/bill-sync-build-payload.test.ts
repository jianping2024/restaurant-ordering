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

  it('splits adult/child buffet codes so by_item sync does not item_code_conflict', () => {
    const buffetId = '6b5606fc-29c7-4656-b428-8dd6b314306f';
    const aguaId = '6b8dd8ee-03aa-426f-9c9b-5fe0d30ceb54';
    const vitalId = 'eeb0bc06-d43a-443f-b7e6-25de8a2a4c80';
    const buffetOrders: Order[] = [
      {
        id: 'b6ca17ab-0000-4000-8000-000000000001',
        restaurant_id: 'rest-1',
        table_id: 'table-1',
        display_name: 'A-20',
        session_id: 'sess-1',
        status: 'pending',
        total_amount: 32.3,
        created_at: '2026-08-21T00:00:00.000Z',
        updated_at: '2026-08-21T00:00:00.000Z',
        items: [
          {
            id: `buffet:${buffetId}`,
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 27.95,
            buffet_id: buffetId,
            adult_count: 1,
            child_count: 1,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            item_status: 'done',
          },
          {
            id: aguaId,
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 1.85,
            item_status: 'pending',
          },
          {
            id: vitalId,
            name: 'Vitalis 750ml',
            name_pt: 'Vitalis 750ml',
            qty: 1,
            price: 2.5,
            item_status: 'pending',
          },
        ],
      },
    ];
    const persons: SplitPerson[] = [
      {
        name: 'John',
        item_shares: [
          { key: `buffet:${buffetId}`, qty_num: 1, qty_den: 1, guest_type: 'adult' },
        ],
      },
      {
        name: 'Tom',
        item_shares: [
          { key: `buffet:${buffetId}`, qty_num: 1, qty_den: 1, guest_type: 'child' },
          { key: `${aguaId}::1.85`, qty_num: 1, qty_den: 1 },
          { key: `${vitalId}::2.5`, qty_num: 1, qty_den: 1 },
        ],
      },
    ];
    const built = buildBillSyncJobPayload({
      requestId: '44444444-4444-4444-8444-444444444444',
      billSplitId: BILL_SPLIT_ID,
      tableDisplayName: 'A-20',
      splitMode: 'by_item',
      persons,
      orders: buffetOrders,
      itemCodeByMenuId: { [aguaId]: 'AGUA', [vitalId]: 'VITA' },
      vatRateByMenuId: {},
      defaultVatRatePercent: 23,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const john = built.payload.splits?.find((s) => s.name === 'John');
    const tom = built.payload.splits?.find((s) => s.name === 'Tom');
    assert.equal(john?.lines[0]?.item_code, 'BF6B5606FCA');
    assert.equal(john?.lines[0]?.unit_price_gross, '17.95');
    assert.equal(tom?.lines.find((l) => l.item_code.startsWith('BF'))?.item_code, 'BF6B5606FCC');
    assert.equal(tom?.lines.find((l) => l.item_code.startsWith('BF'))?.unit_price_gross, '10.00');
    assert.equal(john?.gross_total, '17.95');
    assert.equal(tom?.gross_total, '14.35');
  });

  it('emits separate adult/child buffet lines on whole_table', () => {
    const buffetId = '6b5606fc-29c7-4656-b428-8dd6b314306f';
    const buffetOrders: Order[] = [
      {
        id: ORDER_ID,
        restaurant_id: 'rest-1',
        table_id: 'table-1',
        display_name: 'A-20',
        session_id: 'sess-1',
        status: 'done',
        total_amount: 27.95,
        created_at: '2026-08-21T00:00:00.000Z',
        updated_at: '2026-08-21T00:00:00.000Z',
        items: [
          {
            id: `buffet:${buffetId}`,
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 27.95,
            buffet_id: buffetId,
            adult_count: 1,
            child_count: 1,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            item_status: 'done',
          },
        ],
      },
    ];
    const built = buildBillSyncJobPayload({
      requestId: '55555555-5555-4555-8555-555555555555',
      billSplitId: BILL_SPLIT_ID,
      tableDisplayName: 'A-20',
      splitMode: 'whole_table',
      persons: [{ name: '__whole_table__' }],
      orders: buffetOrders,
      itemCodeByMenuId: {},
      vatRateByMenuId: {},
      defaultVatRatePercent: 23,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.payload.lines?.length, 2);
    const codes = (built.payload.lines ?? []).map((l) => l.item_code).sort();
    assert.deepEqual(codes, ['BF6B5606FCA', 'BF6B5606FCC']);
    assert.equal(built.payload.gross_total, '27.95');
  });
});
