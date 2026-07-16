import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { purgeTablePartyMembership, tableIsInAnyParty } from '@/lib/table-party-groups-server';

const RESTAURANT_ID = '00000000-0000-4000-8000-0000000000r1';
const TABLE_ID = '00000000-0000-4000-8000-000000000001';

describe('purgeTablePartyMembership', () => {
  it('deletes membership by restaurant_id + table_id', async () => {
    const calls: Array<{ restaurantId: string; tableId: string }> = [];
    const admin = {
      from(table: string) {
        assert.equal(table, 'table_party_group_members');
        return {
          delete: () => ({
            eq: (col1: string, val1: string) => {
              assert.equal(col1, 'restaurant_id');
              return {
                eq: async (col2: string, val2: string) => {
                  assert.equal(col2, 'table_id');
                  calls.push({ restaurantId: val1, tableId: val2 });
                  return { error: null };
                },
              };
            },
          }),
        };
      },
    } as unknown as SupabaseClient;

    await purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID);
    assert.deepEqual(calls, [{ restaurantId: RESTAURANT_ID, tableId: TABLE_ID }]);
  });

  it('swallows delete errors without throwing', async () => {
    const admin = {
      from() {
        return {
          delete: () => ({
            eq: () => ({
              eq: async () => ({ error: { message: 'boom' } }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    await assert.doesNotReject(() =>
      purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID),
    );
  });
});

describe('tableIsInAnyParty', () => {
  it('returns true when a membership row exists', async () => {
    const admin = {
      from(table: string) {
        assert.equal(table, 'table_party_group_members');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { table_id: TABLE_ID }, error: null }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    assert.equal(await tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID), true);
  });

  it('returns false when no membership row', async () => {
    const admin = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    assert.equal(await tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID), false);
  });

  it('throws when the lookup fails', async () => {
    const admin = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: { message: 'boom' } }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    await assert.rejects(
      () => tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID),
      /boom/,
    );
  });
});
