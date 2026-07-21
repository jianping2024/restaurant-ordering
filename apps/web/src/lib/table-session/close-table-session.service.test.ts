import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  closeActiveTableSessionSettled,
  closeActiveTableSessionWithOperationalCleanup,
} from '@/lib/close-active-table-session-with-cleanup';
import {
  closeTableSessionFrontdeskCheckout,
  closeTableSessionManual,
} from '@/lib/table-session/close-table-session.service';

const RESTAURANT_ID = '00000000-0000-4000-8000-0000000000r1';
const TABLE_ID = '00000000-0000-4000-8000-000000000001';

const actor = { userId: 'user-1', displayName: 'Owner', role: 'owner' as const };

describe('closeActiveTableSessionSettled', () => {
  it('purges party membership after successful settled close', async () => {
    const purged: Array<{ restaurantId: string; tableId: string }> = [];
    const admin = {
      rpc: async (name: string) => {
        assert.equal(name, 'close_table_session_settled');
        return {
          data: { ok: true, session_id: 'sess-1', payable_amount: 42 },
          error: null,
        };
      },
      from(table: string) {
        assert.equal(table, 'table_party_group_members');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { party_id: 'party-1' },
                  error: null,
                }),
              }),
            }),
          }),
          delete: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: async (_col2: string, val2: string) => {
                purged.push({ restaurantId: val1, tableId: val2 });
                return { error: null };
              },
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await closeActiveTableSessionSettled(
      admin,
      RESTAURANT_ID,
      TABLE_ID,
      'cashier_closed',
      { closed_by_user_id: 'user-1' },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(purged, [{ restaurantId: RESTAURANT_ID, tableId: TABLE_ID }]);
  });

  it('maps guard codes from RPC', async () => {
    const admin = {
      rpc: async () => ({
        data: { ok: false, code: 'unfinished_kitchen_orders' },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await closeActiveTableSessionSettled(
      admin,
      RESTAURANT_ID,
      TABLE_ID,
      'frontdesk_closed',
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'unfinished_kitchen_orders');
  });
});

describe('closeActiveTableSessionWithOperationalCleanup', () => {
  it('purges party membership after successful close', async () => {
    const purged: Array<{ restaurantId: string; tableId: string }> = [];
    const admin = {
      rpc: async () => ({
        data: { ok: true, session_id: 'sess-1' },
        error: null,
      }),
      from(table: string) {
        assert.equal(table, 'table_party_group_members');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { party_id: 'party-1' },
                  error: null,
                }),
              }),
            }),
          }),
          delete: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: async (_col2: string, val2: string) => {
                purged.push({ restaurantId: val1, tableId: val2 });
                return { error: null };
              },
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await closeActiveTableSessionWithOperationalCleanup(
      admin,
      RESTAURANT_ID,
      TABLE_ID,
      'waiter_closed',
      { closed_by_user_id: 'user-1' },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(purged, [{ restaurantId: RESTAURANT_ID, tableId: TABLE_ID }]);
  });

  it('does not purge when close fails', async () => {
    let fromCalled = false;
    const admin = {
      rpc: async () => ({
        data: { ok: false, code: 'no_session' },
        error: null,
      }),
      from() {
        fromCalled = true;
        return {
          delete: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await closeActiveTableSessionWithOperationalCleanup(
      admin,
      RESTAURANT_ID,
      TABLE_ID,
      'waiter_closed',
    );

    assert.equal(result.ok, false);
    assert.equal(fromCalled, false);
  });
});

describe('closeTableSessionFrontdeskCheckout', () => {
  it('delegates to settled close RPC', async () => {
    let rpcName = '';
    const admin = {
      rpc: async (name: string) => {
        rpcName = name;
        return { data: { ok: true, session_id: 'sess-1' }, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await closeTableSessionFrontdeskCheckout({
      admin,
      restaurantId: 'rest-1',
      tableId: 'table-1',
      userId: 'user-1',
      closedReason: 'frontdesk_closed',
    });

    assert.equal(rpcName, 'close_table_session_settled');
    assert.equal(result.ok, true);
  });

  it('surfaces billing guard from RPC', async () => {
    const admin = {
      rpc: async () => ({
        data: { ok: false, code: 'session_billing' },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await closeTableSessionFrontdeskCheckout({
      admin,
      restaurantId: 'rest-1',
      tableId: 'table-1',
      userId: 'user-1',
      closedReason: 'cashier_closed',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'session_billing');
  });
});

describe('closeTableSessionManual', () => {
  it('rejects invalid unpaid reason before RPC', async () => {
    const result = await closeTableSessionManual({
      admin: {} as SupabaseClient,
      restaurantId: 'rest-1',
      userId: 'user-1',
      actor,
      closedReason: 'owner_closed',
      tableId: 'table-1',
      confirmClose: true,
      unpaidReason: 'not_a_real_reason',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'invalid_reason');
  });

  it('requires detail for other reason', async () => {
    const result = await closeTableSessionManual({
      admin: {} as SupabaseClient,
      restaurantId: 'rest-1',
      userId: 'user-1',
      actor,
      closedReason: 'owner_closed',
      tableId: 'table-1',
      confirmClose: true,
      unpaidReason: 'other',
      unpaidReasonDetail: '   ',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'reason_detail_required');
  });
});
