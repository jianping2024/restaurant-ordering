import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  removeStaffMembership,
  retireAccountsWithoutStoreLeft,
  staffCredentialsEditableByStore,
  userIdsWithoutStoreLeft,
} from './staff-membership-removal';

type Membership = { id: string; restaurant_id: string; user_id: string };
type Restaurant = { id: string; owner_id: string | null };

/** In-memory stand-in for the admin client: only the calls the helper makes. */
function fakeAdmin(state: { memberships: Membership[]; restaurants: Restaurant[] }) {
  const deletedUsers: string[] = [];
  const identitiesDeleted: string[] = [];
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let inFilter: [string, readonly unknown[]] | null = null;
    let op: 'select' | 'delete' = 'select';
    const rows = (): Record<string, unknown>[] =>
      table === 'restaurant_staff_accounts'
        ? state.memberships
        : table === 'restaurants'
          ? state.restaurants
          : [];
    const match = (r: Record<string, unknown>) =>
      filters.every(([k, v]) => r[k] === v) && (!inFilter || inFilter[1].includes(r[inFilter[0]]));
    const run = () => {
      if (op === 'delete') {
        if (table === 'restaurant_staff_accounts') {
          state.memberships = state.memberships.filter((r) => !match(r));
        }
        if (table === 'staff_identities') {
          identitiesDeleted.push(String(filters.find(([k]) => k === 'user_id')?.[1]));
        }
        return { data: null, error: null };
      }
      return { data: rows().filter(match), error: null };
    };
    const q = {
      select: () => q,
      delete: () => {
        op = 'delete';
        return q;
      },
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return q;
      },
      in: (k: string, v: readonly unknown[]) => {
        inFilter = [k, v];
        return q;
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  const admin = {
    from,
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          deletedUsers.push(id);
          return { error: null };
        },
        updateUserById: async () => ({ error: null }),
      },
    },
  } as unknown as SupabaseClient;
  return { admin, deletedUsers, identitiesDeleted, state };
}

describe('staffCredentialsEditableByStore (rule 4)', () => {
  it('single-store account: store staff with staff.manage may change it', () => {
    assert.equal(staffCredentialsEditableByStore({ storeCount: 1, actor: 'store_staff' }), true);
  });
  it('multi-store account: store staff may not', () => {
    assert.equal(staffCredentialsEditableByStore({ storeCount: 2, actor: 'store_staff' }), false);
  });
  it('multi-store account: a linked store admin account may', () => {
    assert.equal(staffCredentialsEditableByStore({ storeCount: 5, actor: 'store_admin' }), true);
  });
});

describe('userIdsWithoutStoreLeft', () => {
  it('keeps only accounts with zero memberships that own no store', () => {
    const out = userIdsWithoutStoreLeft({
      candidates: ['a', 'b', 'c', 'a', ''],
      membershipCounts: new Map([['b', 1]]),
      ownerIds: new Set(['c']),
    });
    assert.deepEqual(out, ['a']);
  });
});

describe('removeStaffMembership', () => {
  it('multi-store account: removes only this store row, account kept', async () => {
    const f = fakeAdmin({
      memberships: [
        { id: 'm-a', restaurant_id: 'A', user_id: 'u1' },
        { id: 'm-b', restaurant_id: 'B', user_id: 'u1' },
      ],
      restaurants: [],
    });
    const r = await removeStaffMembership(f.admin, {
      restaurantId: 'A',
      membershipId: 'm-a',
      userId: 'u1',
    });
    assert.deepEqual(r, { ok: true, accountRetired: false });
    assert.deepEqual(f.state.memberships.map((m) => m.id), ['m-b']);
    assert.deepEqual(f.deletedUsers, []);
  });

  it('last store: removes the row and retires the account', async () => {
    const f = fakeAdmin({
      memberships: [{ id: 'm-b', restaurant_id: 'B', user_id: 'u1' }],
      restaurants: [],
    });
    const r = await removeStaffMembership(f.admin, {
      restaurantId: 'B',
      membershipId: 'm-b',
      userId: 'u1',
    });
    assert.deepEqual(r, { ok: true, accountRetired: true });
    assert.deepEqual(f.deletedUsers, ['u1']);
  });

  it('never deletes a row of another store (id + restaurant scope)', async () => {
    const f = fakeAdmin({
      memberships: [{ id: 'm-b', restaurant_id: 'B', user_id: 'u1' }],
      restaurants: [],
    });
    await removeStaffMembership(f.admin, { restaurantId: 'A', membershipId: 'm-b', userId: 'u1' });
    assert.equal(f.state.memberships.length, 1);
    assert.deepEqual(f.deletedUsers, []);
  });
});

describe('retireAccountsWithoutStoreLeft (ops purge)', () => {
  it('after store A is gone: retires A-only staff + A admin; keeps multi-store staff and B admin', async () => {
    // Store A already deleted; B remains with its admin `ownB` and the multi-store account `multi`.
    const f = fakeAdmin({
      memberships: [{ id: 'm-b', restaurant_id: 'B', user_id: 'multi' }],
      restaurants: [{ id: 'B', owner_id: 'ownB' }],
    });
    const r = await retireAccountsWithoutStoreLeft(f.admin, ['ownA', 'onlyA', 'multi', 'ownB']);
    assert.deepEqual(r.retired.sort(), ['onlyA', 'ownA']);
    assert.deepEqual(f.deletedUsers.sort(), ['onlyA', 'ownA']);
    assert.equal(r.deleted, 2);
  });
});
