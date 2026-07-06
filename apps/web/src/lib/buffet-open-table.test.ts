import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OrderItem } from '@/types';
import {
  aggregateBuffetHeadcountForOrders,
  buildBuffetBaseLine,
  listActiveBuffetLineSummaries,
} from '@/lib/buffet-order';
import {
  applyBuffetOpenOptimisticToOrders,
  applyBuffetOpenToSession,
  applyBuffetOpenWritePlanToOrders,
  pickLatestTableOrder,
  planBuffetOpenWrites,
  type BuffetSessionOrder,
} from '@/lib/buffet-open-table';

const buffetA = { id: 'buffet-a', name: 'Simple Buffet' };
const buffetB = { id: 'buffet-b', name: 'Premium Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
};

function buffetLine(
  buffet: { id: string; name: string },
  adults: number,
  children: number,
  addedAt: string,
  price?: number,
): OrderItem {
  const line = buildBuffetBaseLine({
    buffet,
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
  status: BuffetSessionOrder['status'] = 'done',
): BuffetSessionOrder {
  return {
    id,
    table_id: tableId,
    items,
    created_at: createdAt,
    updated_at: updatedAt,
    status,
  };
}

const TABLE_1 = 'a0000001-0000-4000-8000-000000000001';
const TABLE_2 = 'a0000002-0000-4000-8000-000000000002';

describe('planBuffetOpenWrites', () => {
  it('upserts multiple packages on one carrier order', () => {
    const lineA = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z');
    const lineB = buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z');
    const plan = planBuffetOpenWrites([], {
      tableId: TABLE_1,
      displayName: 'A1',
      lines: [lineA, lineB],
      voidBuffetIds: [],
      restaurantId: 'r1',
      sessionId: 's1',
    });

    assert.equal(plan.carrier.mode, 'insert');
    if (plan.carrier.mode !== 'insert') return;
    const active = plan.carrier.items.filter((item) => item.kind === 'buffet_base' && item.item_status !== 'voided');
    assert.equal(active.length, 2);
  });

  it('voids one package while keeping another', () => {
    const prevA = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z');
    const prevB = buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z');
    const carrier = orderRow('order-1', TABLE_1, [prevA, prevB], '2026-01-01T10:00:00.000Z', 'ts-v1');
    const nextA = buffetLine(buffetA, 3, 1, '2026-01-01T11:00:00.000Z');
    const plan = planBuffetOpenWrites([carrier], {
      tableId: TABLE_1,
      displayName: 'A1',
      lines: [nextA],
      voidBuffetIds: [buffetB.id],
      restaurantId: 'r1',
      sessionId: 's1',
    });

    assert.equal(plan.carrier.mode, 'update');
    if (plan.carrier.mode !== 'update') return;
    const active = plan.carrier.items.filter((item) => item.kind === 'buffet_base' && item.item_status !== 'voided');
    assert.equal(active.length, 1);
    assert.equal(active[0].buffet_id, buffetA.id);
    assert.equal(active[0].adult_count, 3);
    assert.equal(plan.carrier.items.filter((item) => item.item_status === 'voided').length, 2);
  });
});

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
  it('updates carrier order once when changing one package', async () => {
    const tableId = TABLE_1;
    const prev = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z', 40);
    const carrier = orderRow('order-1', tableId, [prev], '2026-01-01T10:00:00.000Z', 'ts-v1');
    const next = buffetLine(buffetA, 3, 1, '2026-01-01T11:00:00.000Z', 70);

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
      lines: [next],
      voidBuffetIds: [],
      sessionOrders: [carrier],
    });

    assert.equal(result.ok, true);
    assert.equal(updates.length, 1);
    const active = updates[0].items.filter((i) => i.kind === 'buffet_base' && i.item_status !== 'voided');
    assert.equal(active.length, 1);
    assert.equal(active[0].adult_count, 3);
    assert.equal(active[0].child_count, 1);
  });
});

describe('applyBuffetOpenOptimisticToOrders', () => {
  it('appends multiple packages on empty table for instant UI', () => {
    const lineA = buffetLine(buffetA, 2, 1, '2026-01-01T11:00:00.000Z', 50);
    const lineB = buffetLine(buffetB, 1, 0, '2026-01-01T11:01:00.000Z', 20);
    const next = applyBuffetOpenOptimisticToOrders([], {
      tableId: TABLE_1,
      displayName: 'A1',
      lines: [lineA, lineB],
      voidBuffetIds: [],
      restaurantId: 'r1',
      sessionId: 's-new',
    });
    assert.equal(next.length, 1);
    assert.equal(listActiveBuffetLineSummaries(next).length, 2);
    assert.deepEqual(aggregateBuffetHeadcountForOrders(next), { adults: 3, children: 1 });
  });
});

describe('applyBuffetOpenWritePlanToOrders', () => {
  it('inserts carrier order when opening an idle table (开台)', () => {
    const line = buffetLine(buffetA, 2, 1, '2026-01-01T11:00:00.000Z', 50);
    const params = {
      tableId: TABLE_1,
      displayName: 'A1',
      lines: [line],
      voidBuffetIds: [] as string[],
      restaurantId: 'r1',
      sessionId: 's-new',
    };
    const plan = planBuffetOpenWrites([], params);
    assert.equal(plan.carrier.mode, 'insert');
    const next = applyBuffetOpenWritePlanToOrders([], plan, { insertedOrderId: 'order-new' });
    assert.equal(next.length, 1);
    assert.equal(next[0].id, 'order-new');
    assert.deepEqual(aggregateBuffetHeadcountForOrders(next), { adults: 2, children: 1 });
  });
});
