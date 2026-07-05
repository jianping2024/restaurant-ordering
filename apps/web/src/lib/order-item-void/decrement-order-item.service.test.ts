import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT } from '@/lib/audit/types';
import { decrementOrderItemWithAudit } from '@/lib/order-item-void/decrement-order-item.service';
import type { OrderItem } from '@/types';

const baseItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  name: 'Cola',
  name_pt: 'Cola',
  qty: 2,
  price: 2.5,
  emoji: '🥤',
  item_status: 'pending',
  ...overrides,
});

type MockAdmin = SupabaseClient & {
  auditEvents: string[];
  abnormalInserts: number;
};

function mockAdmin(): MockAdmin {
  const state = { auditEvents: [] as string[], abnormalInserts: 0 };
  const admin = {
    get auditEvents() {
      return state.auditEvents;
    },
    get abnormalInserts() {
      return state.abnormalInserts;
    },
    from(table: string) {
      if (table === 'orders') {
        return {
          update(payload: Record<string, unknown>) {
            return {
              eq() {
                return this;
              },
              select() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: 'order-1',
                        session_id: 'sess-1',
                        table_id: 'table-1',
                        display_name: 'A2',
                        items: payload.items,
                        status: payload.status,
                        total_amount: payload.total_amount,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'operation_logs') {
        return {
          insert(row: { action_type: string }) {
            state.auditEvents.push(row.action_type);
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: { id: 'log-1' }, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'abnormal_operations') {
        return {
          insert() {
            state.abnormalInserts += 1;
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: { id: 'abn-1' }, error: null };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return admin as unknown as MockAdmin;
}

describe('decrementOrderItemWithAudit', () => {
  const actor = { userId: 'user-1', displayName: 'Waiter', role: 'waiter' as const };

  it('writes qty decrement audit only when qty remains above zero', async () => {
    const admin = mockAdmin();

    const result = await decrementOrderItemWithAudit({
      admin,
      restaurantId: 'rest-1',
      actor,
      orderId: 'order-1',
      existing: {
        items: [baseItem()],
        updated_at: '2026-01-01T00:00:00.000Z',
        session_id: 'sess-1',
        table_id: 'table-1',
        display_name: 'A2',
        status: 'pending',
      },
      itemIndex: 0,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.outcome, 'decremented');
    assert.deepEqual(admin.auditEvents, [AUDIT_EVENT.ITEM_QTY_DECREMENTED]);
    assert.equal(admin.abnormalInserts, 0);
  });

  it('writes voided audit only when the last unit is removed', async () => {
    const admin = mockAdmin();

    const result = await decrementOrderItemWithAudit({
      admin,
      restaurantId: 'rest-1',
      actor,
      orderId: 'order-1',
      existing: {
        items: [baseItem({ qty: 1 })],
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'pending',
      },
      itemIndex: 0,
      voidReason: 'customer_cancelled',
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.outcome, 'voided');
    assert.deepEqual(admin.auditEvents, [AUDIT_EVENT.ITEM_VOIDED]);
    assert.equal(admin.abnormalInserts, 0);
  });

  it('requires void reason when removing the last unit', async () => {
    const admin = mockAdmin();

    const result = await decrementOrderItemWithAudit({
      admin,
      restaurantId: 'rest-1',
      actor,
      orderId: 'order-1',
      existing: {
        items: [baseItem({ qty: 1 })],
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'pending',
      },
      itemIndex: 0,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'reason_required');
    assert.equal(admin.auditEvents.length, 0);
  });
});
