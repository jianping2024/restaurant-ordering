import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserEmailsMap } from './ops-user-lookup';

function mockAdmin(getUserById: (id: string) => Promise<{ data: { user: { email: string } | null } }>) {
  return {
    auth: {
      admin: { getUserById },
    },
  } as unknown as SupabaseClient;
}

describe('fetchUserEmailsMap', () => {
  it('returns empty map for no ids', async () => {
    const map = await fetchUserEmailsMap(mockAdmin(async () => ({ data: { user: null } })), []);
    assert.equal(map.size, 0);
  });

  it('dedupes ids and resolves emails', async () => {
    const calls: string[] = [];
    const admin = mockAdmin(async (id) => {
      calls.push(id);
      return {
        data: {
          user: { email: id === 'a' ? 'alice@test.local' : 'bob@test.local' },
        },
      };
    });

    const map = await fetchUserEmailsMap(admin, ['a', 'b', 'a']);
    assert.deepEqual(calls.sort(), ['a', 'b']);
    assert.equal(map.get('a'), 'alice@test.local');
    assert.equal(map.get('b'), 'bob@test.local');
  });

  it('stores null when user missing', async () => {
    const map = await fetchUserEmailsMap(
      mockAdmin(async () => ({ data: { user: null } })),
      ['missing'],
    );
    assert.equal(map.get('missing'), null);
  });
});
