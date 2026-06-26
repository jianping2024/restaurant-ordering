import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { patchAbnormalOperationWithAudit } from './patch-abnormal-operation.service';

const ROW = {
  id: 'abn-1',
  restaurant_id: 'rest-1',
  type: 'ITEM_DELETED',
  risk_level: 'HIGH',
  status: 'PENDING',
  order_id: null,
  session_id: null,
  table_id: 'table-1',
  table_name: 'A1',
  operator_id: 'op-1',
  operator_name: 'Waiter',
  operator_role: 'waiter',
  amount_impact: 12,
  reason: 'staff_mistake',
  reason_detail: null,
  before_data: {},
  after_data: {},
  owner_note: null,
  confirmed_by: null,
  confirmed_at: null,
  source_action_id: null,
  created_at: '2026-06-26T10:00:00.000Z',
  updated_at: '2026-06-26T10:00:00.000Z',
} as const;

function mockAdmin(): SupabaseClient {
  let status = 'PENDING';
  return {
    from(table: string) {
      if (table === 'abnormal_operations') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: { ...ROW, status },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            status = patch.status as string;
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            return {
                              data: {
                                ...ROW,
                                status,
                                owner_note: (patch.owner_note as string | null) ?? ROW.owner_note,
                                confirmed_by: patch.confirmed_by ?? null,
                              },
                              error: null,
                            };
                          },
                        };
                      },
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
          insert() {
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
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient;
}

describe('patchAbnormalOperationWithAudit', () => {
  it('confirms pending row and returns updated row', async () => {
    const result = await patchAbnormalOperationWithAudit({
      admin: mockAdmin(),
      restaurantId: 'rest-1',
      ownerId: 'owner-1',
      actor: { kind: 'owner', userId: 'owner-1', displayName: 'Owner' },
      id: 'abn-1',
      status: 'CONFIRMED',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.row.status, 'CONFIRMED');
  });
});
