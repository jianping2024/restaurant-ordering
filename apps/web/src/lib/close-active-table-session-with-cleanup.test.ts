import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { closeActiveTableSessionWithOperationalCleanup } from '@/lib/close-active-table-session-with-cleanup';

const RESTAURANT_ID = '00000000-0000-4000-8000-0000000000r1';
const TABLE_ID = '00000000-0000-4000-8000-000000000001';

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
          delete: () => ({
            eq: (col1: string, val1: string) => ({
              eq: async (col2: string, val2: string) => {
                assert.equal(col1, 'restaurant_id');
                assert.equal(col2, 'table_id');
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
