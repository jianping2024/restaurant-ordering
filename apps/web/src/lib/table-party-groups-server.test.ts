import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countPartyMembersForTable,
  dissolvePartyIfEmpty,
  purgeTablePartyMembership,
  tableIsInAnyParty,
} from '@/lib/table-party-groups-server';

const RESTAURANT_ID = '00000000-0000-4000-8000-0000000000r1';
const TABLE_ID = '00000000-0000-4000-8000-000000000001';
const PARTY_ID = '00000000-0000-4000-8000-0000000000p1';

type Call = { table: string; op: string; filters?: Record<string, string> };

function mockAdmin(handlers: {
  onSelectMembers?: (filters: Record<string, string>) => { data: unknown; error: unknown };
  onCountMembers?: (filters: Record<string, string>) => { count: number | null; error: unknown };
  onDeleteMembers?: (filters: Record<string, string>) => { error: unknown };
  onDeleteParty?: (filters: Record<string, string>) => { error: unknown };
}): { admin: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const admin = {
    from(table: string) {
      return {
        select(_cols?: string, opts?: { count?: string; head?: boolean }) {
          const filters: Record<string, string> = {};
          const isCount = opts?.head === true && opts?.count === 'exact';
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            limit() {
              return chain;
            },
            maybeSingle: async () => {
              calls.push({ table, op: 'select', filters: { ...filters } });
              return handlers.onSelectMembers?.(filters) ?? { data: null, error: null };
            },
            then(
              resolve: (value: { data: unknown; error: unknown; count?: number | null }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              calls.push({
                table,
                op: isCount ? 'count' : 'select',
                filters: { ...filters },
              });
              try {
                if (isCount) {
                  return Promise.resolve(
                    handlers.onCountMembers?.(filters) ?? { count: 0, error: null },
                  ).then(resolve, reject);
                }
                return Promise.resolve(
                  handlers.onSelectMembers?.(filters) ?? { data: [], error: null },
                ).then(resolve, reject);
              } catch (err) {
                return Promise.reject(err).then(resolve, reject);
              }
            },
          };
          return chain;
        },
        delete() {
          const filters: Record<string, string> = {};
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            then(
              resolve: (value: { error: unknown }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              const op = table === 'table_party_groups' ? 'delete_party' : 'delete_members';
              calls.push({ table, op, filters: { ...filters } });
              try {
                const result =
                  table === 'table_party_groups'
                    ? (handlers.onDeleteParty?.(filters) ?? { error: null })
                    : (handlers.onDeleteMembers?.(filters) ?? { error: null });
                return Promise.resolve(result).then(resolve, reject);
              } catch (err) {
                return Promise.reject(err).then(resolve, reject);
              }
            },
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

describe('dissolvePartyIfEmpty', () => {
  it('does not delete the party when a member remains', async () => {
    const { admin, calls } = mockAdmin({
      onSelectMembers: () => ({ data: [{ table_id: TABLE_ID }], error: null }),
    });

    await dissolvePartyIfEmpty(admin, RESTAURANT_ID, PARTY_ID);

    assert.equal(
      calls.some((c) => c.op === 'delete_party'),
      false,
    );
  });

  it('deletes the party when no members remain', async () => {
    const { admin, calls } = mockAdmin({
      onSelectMembers: () => ({ data: [], error: null }),
      onDeleteParty: (filters) => {
        assert.equal(filters.id, PARTY_ID);
        assert.equal(filters.restaurant_id, RESTAURANT_ID);
        return { error: null };
      },
    });

    await dissolvePartyIfEmpty(admin, RESTAURANT_ID, PARTY_ID);

    assert.equal(
      calls.some((c) => c.table === 'table_party_groups' && c.op === 'delete_party'),
      true,
    );
  });

  it('swallows lookup errors without throwing', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: { message: 'boom' } }),
    });

    await assert.doesNotReject(() => dissolvePartyIfEmpty(admin, RESTAURANT_ID, PARTY_ID));
  });
});

describe('purgeTablePartyMembership', () => {
  it('deletes membership then dissolves empty party', async () => {
    let selectCount = 0;
    const { admin, calls } = mockAdmin({
      onSelectMembers: (filters) => {
        selectCount += 1;
        if (selectCount === 1) {
          assert.equal(filters.table_id, TABLE_ID);
          return { data: { party_id: PARTY_ID }, error: null };
        }
        assert.equal(filters.party_id, PARTY_ID);
        return { data: [], error: null };
      },
      onDeleteMembers: (filters) => {
        assert.equal(filters.restaurant_id, RESTAURANT_ID);
        assert.equal(filters.table_id, TABLE_ID);
        return { error: null };
      },
      onDeleteParty: (filters) => {
        assert.equal(filters.id, PARTY_ID);
        return { error: null };
      },
    });

    await purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID);

    assert.deepEqual(
      calls.map((c) => c.op),
      ['select', 'delete_members', 'select', 'delete_party'],
    );
  });

  it('keeps the party when other members remain', async () => {
    let selectCount = 0;
    const { admin, calls } = mockAdmin({
      onSelectMembers: () => {
        selectCount += 1;
        if (selectCount === 1) {
          return { data: { party_id: PARTY_ID }, error: null };
        }
        return { data: [{ table_id: 'other' }], error: null };
      },
      onDeleteMembers: () => ({ error: null }),
    });

    await purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID);

    assert.equal(
      calls.some((c) => c.op === 'delete_party'),
      false,
    );
  });

  it('no-ops when the table is not in a party', async () => {
    const { admin, calls } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: null }),
    });

    await purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID);

    assert.deepEqual(
      calls.map((c) => c.op),
      ['select'],
    );
  });

  it('swallows delete errors without throwing', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: { party_id: PARTY_ID }, error: null }),
      onDeleteMembers: () => ({ error: { message: 'boom' } }),
    });

    await assert.doesNotReject(() =>
      purgeTablePartyMembership(admin, RESTAURANT_ID, TABLE_ID),
    );
  });
});

describe('tableIsInAnyParty', () => {
  it('returns true when a membership row exists', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: { table_id: TABLE_ID }, error: null }),
    });

    assert.equal(await tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID), true);
  });

  it('returns false when no membership row', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: null }),
    });

    assert.equal(await tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID), false);
  });

  it('throws when the lookup fails', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: { message: 'boom' } }),
    });

    await assert.rejects(() => tableIsInAnyParty(admin, RESTAURANT_ID, TABLE_ID), /boom/);
  });
});

describe('countPartyMembersForTable', () => {
  it('returns 0 when the table is not in a party', async () => {
    const { admin, calls } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: null }),
    });

    assert.equal(await countPartyMembersForTable(admin, RESTAURANT_ID, TABLE_ID), 0);
    assert.equal(
      calls.some((c) => c.op === 'count'),
      false,
    );
  });

  it('returns the party member count when the table is in a party', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: { party_id: PARTY_ID }, error: null }),
      onCountMembers: (filters) => {
        assert.equal(filters.party_id, PARTY_ID);
        assert.equal(filters.restaurant_id, RESTAURANT_ID);
        return { count: 3, error: null };
      },
    });

    assert.equal(await countPartyMembersForTable(admin, RESTAURANT_ID, TABLE_ID), 3);
  });

  it('throws when membership lookup fails', async () => {
    const { admin } = mockAdmin({
      onSelectMembers: () => ({ data: null, error: { message: 'lookup boom' } }),
    });

    await assert.rejects(
      () => countPartyMembersForTable(admin, RESTAURANT_ID, TABLE_ID),
      /lookup boom/,
    );
  });
});
