import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resumeTableSessionOrdering } from './resume-table-session-ordering';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '33333333-3333-4333-8333-333333333333';

function mockAdminRpc(
  data: unknown,
  rpcError: { message: string } | null = null,
): SupabaseClient {
  return {
    rpc: async () => ({ data, error: rpcError }),
  } as unknown as SupabaseClient;
}

describe('resumeTableSessionOrdering', () => {
  it('maps whole_table_paid to 409', async () => {
    const r = await resumeTableSessionOrdering({
      admin: mockAdminRpc({ ok: false, code: 'whole_table_paid' }),
      restaurantId: RESTAURANT_ID,
      tableId: TABLE_ID,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 409);
    assert.equal(r.code, 'whole_table_paid');
  });

  it('returns success payload from RPC', async () => {
    const r = await resumeTableSessionOrdering({
      admin: mockAdminRpc({
        ok: true,
        session_id: '44444444-4444-4444-8444-444444444444',
        table_id: TABLE_ID,
      }),
      restaurantId: RESTAURANT_ID,
      tableId: TABLE_ID,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.table_id, TABLE_ID);
  });
});
