import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OrderItem } from '@/types';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  latestActiveBuffetBaseLine,
  mergeBuffetLineOntoOrderItems,
} from '@/lib/buffet-order';
import {
  applyBuffetOpenToSession,
  pickLatestTableOrder,
  type BuffetSessionOrder,
} from '@/lib/buffet-open-table';

const buffetA = { id: 'buffet-a', name: 'Lunch Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
};

function buffetLine(
  adults: number,
  children: number,
  addedAt: string,
  price?: number,
): OrderItem {
  const line = buildBuffetBaseLine({
    buffet: buffetA,
    adultCount: adults,
    childCount: children,
    resolved,
  });
  assert.ok(line);
  return { ...line, added_at: addedAt, price: price ?? line.price };
}

function orderRow(
  id: string,
  tableId: string,
  items: OrderItem[],
  createdAt: string,
  updatedAt = createdAt,
): BuffetSessionOrder {
  return {
    id,
    table_id: tableId,
    items,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

describe('latestActiveBuffetBaseLine / aggregateBuffetForOrders', () => {
  it('uses the newest active line instead of summing duplicates', () => {
    const older = buffetLine(2, 0, '2026-01-01T10:00:00.000Z', 40);
    const newer = buffetLine(3, 1, '2026-01-01T11:00:00.000Z', 70);
    const orders = [
      {
        id: 'o1',
        status: 'done' as const,
        items: [older, newer],
        created_at: '2026-01-01T10:00:00.000Z',
        updated_at: '2026-01-01T11:00:00.000Z',
        restaurant_id: 'r1',
        session_id: 's1',
        table_id: 't1',
        display_name: 'A1',
        total_amount: 110,
      },
    ];

    const latest = latestActiveBuffetBaseLine(orders);
    assert.equal(latest?.adult_count, 3);
    assert.equal(latest?.child_count, 1);

    const agg = aggregateBuffetForOrders(orders);
    assert.equal(agg?.adults, 3);
    assert.equal(agg?.children, 1);
    assert.equal(agg?.amount, 70);
  });

  it('ignores voided buffet lines', () => {
    const voided = { ...buffetLine(9, 9, '2026-01-01T12:00:00.000Z'), item_status: 'voided' as const };
    const active = buffetLine(1, 0, '2026-01-01T11:00:00.000Z', 20);
    const orders = [
      {
        id: 'o1',
        status: 'done' as const,
        items: [voided, active],
        created_at: '2026-01-01T10:00:00.000Z',
        updated_at: '2026-01-01T11:00:00.000Z',
        restaurant_id: 'r1',
        session_id: 's1',
        table_id: 't1',
        display_name: 'A1',
        total_amount: 20,
      },
    ];
    const agg = aggregateBuffetForOrders(orders);
    assert.equal(agg?.adults, 1);
    assert.equal(agg?.children, 0);
  });
});

describe('mergeBuffetLineOntoOrderItems', () => {
  it('voids prior buffet_base and appends the new line on one order', () => {
    const prev = buffetLine(2, 0, '2026-01-01T10:00:00.000Z');
    const next = buffetLine(4, 2, '2026-01-01T11:00:00.000Z');
    const merged = mergeBuffetLineOntoOrderItems([prev], next);

    const active = merged.filter((i) => i.kind === 'buffet_base' && i.item_status !== 'voided');
    assert.equal(active.length, 1);
    assert.equal(active[0].adult_count, 4);
    assert.equal(active[0].child_count, 2);
    assert.equal(merged.filter((i) => i.item_status === 'voided').length, 1);
  });
});

const TABLE_1 = 'a0000001-0000-4000-8000-000000000001';
const TABLE_2 = 'a0000002-0000-4000-8000-000000000002';

describe('pickLatestTableOrder', () => {
  it('picks the newest order for the table', () => {
    const rows = [
      orderRow('o-old', TABLE_1, [], '2026-01-01T09:00:00.000Z'),
      orderRow('o-new', TABLE_1, [], '2026-01-01T10:00:00.000Z'),
      orderRow('o-other', TABLE_2, [], '2026-01-01T11:00:00.000Z'),
    ];
    assert.equal(pickLatestTableOrder(rows, TABLE_1)?.id, 'o-new');
  });
});

describe('applyBuffetOpenToSession', () => {
  it('updates carrier order once (void+append) when re-opening the same table', async () => {
    const tableId = TABLE_1;
    const prev = buffetLine(2, 0, '2026-01-01T10:00:00.000Z', 40);
    const carrier = orderRow('order-1', tableId, [prev], '2026-01-01T10:00:00.000Z', 'ts-v1');
    const next = buffetLine(3, 1, '2026-01-01T11:00:00.000Z', 70);

    const updates: { id: string; items: OrderItem[] }[] = [];
    const admin = {
      from(table: string) {
        assert.equal(table, 'orders');
        return {
          update(payload: { items: OrderItem[] }) {
            return {
              eq(col: string, val: string) {
                if (col === 'id') {
                  const id = val;
                  return {
                    eq(col2: string, val2: string) {
                      assert.equal(col2, 'updated_at');
                      assert.equal(val2, 'ts-v1');
                      updates.push({ id, items: payload.items });
                      return {
                        select() {
                          return {
                            maybeSingle: async () => ({ data: { id }, error: null }),
                          };
                        },
                      };
                    },
                    select() {
                      return {
                        maybeSingle: async () => ({ data: { id }, error: null }),
                      };
                    },
                  };
                }
                throw new Error(`unexpected eq ${col}`);
              },
            };
          },
          insert() {
            throw new Error('insert should not run');
          },
        };
      },
    };

    const result = await applyBuffetOpenToSession(admin as never, {
      restaurantId: 'r1',
      sessionId: 's1',
      tableId,
      displayName: 'A1',
      line: next,
      sessionOrders: [carrier],
    });

    assert.equal(result.ok, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].id, 'order-1');
    const active = updates[0].items.filter((i) => i.kind === 'buffet_base' && i.item_status !== 'voided');
    assert.equal(active.length, 1);
    assert.equal(active[0].adult_count, 3);
    assert.equal(active[0].child_count, 1);
  });

  it('voids buffet on other session orders before writing the carrier', async () => {
    const tableA = TABLE_1;
    const tableB = TABLE_2;
    const oldBuffet = buffetLine(2, 0, '2026-01-01T09:00:00.000Z');
    const other = orderRow('order-other', tableB, [oldBuffet], '2026-01-01T09:00:00.000Z');
    const carrier = orderRow('order-carrier', tableA, [], '2026-01-01T10:00:00.000Z', 'ts-c1');
    const next = buffetLine(1, 0, '2026-01-01T11:00:00.000Z');

    const updateIds: string[] = [];
    const admin = {
      from(table: string) {
        assert.equal(table, 'orders');
        return {
          update(payload: { items: OrderItem[]; total_amount?: number }) {
            void payload;
            return {
              eq(col: string, val: string) {
                if (col !== 'id') throw new Error(`unexpected eq ${col}`);
                updateIds.push(val);
                if (val === 'order-carrier') {
                  return {
                    eq(col2: string, val2: string) {
                      assert.equal(col2, 'updated_at');
                      assert.equal(val2, 'ts-c1');
                      return {
                        select() {
                          return {
                            maybeSingle: async () => ({ data: { id: 'order-carrier' }, error: null }),
                          };
                        },
                      };
                    },
                  };
                }
                return Promise.resolve({ error: null });
              },
            };
          },
          insert: () => {
            throw new Error('insert should not run');
          },
        };
      },
    };

    const result = await applyBuffetOpenToSession(admin as never, {
      restaurantId: 'r1',
      sessionId: 's1',
      tableId: tableA,
      displayName: 'A1',
      line: next,
      sessionOrders: [other, carrier],
    });

    assert.equal(result.ok, true);
    assert.ok(updateIds.includes('order-other'));
    assert.ok(updateIds.includes('order-carrier'));
  });
});
