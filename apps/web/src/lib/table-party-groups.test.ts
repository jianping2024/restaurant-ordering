import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  conflictingPartyMembers,
  countCheckoutTablesInParties,
  filterTablesEligibleForPartyAdd,
  isPartyMemberCountAllowedForCheckout,
  isTableEligibleForPartyAdd,
  nextAvailableTablePartyName,
  nextAppendSortOrder,
  partyDefaultNameLoginPrefix,
  partyHasNameConflict,
  partyIdForTable,
  partyNameKey,
  PARTY_DEFAULT_LOGIN_FALLBACK,
  tablePartyMemberTableIds,
} from './table-party-groups';
import { buildWaiterBoardStateContext } from './waiter-board-session';

const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const T3 = '00000000-0000-4000-8000-000000000003';
const T4 = '00000000-0000-4000-8000-000000000004';
const P1 = '00000000-0000-4000-8000-0000000000a1';
const P2 = '00000000-0000-4000-8000-0000000000a2';

describe('table-party-groups', () => {
  const members = [
    { party_id: P1, table_id: T1, restaurant_id: '00000000-0000-4000-8000-0000000000r1' },
    { party_id: P1, table_id: T2, restaurant_id: '00000000-0000-4000-8000-0000000000r1' },
    { party_id: P2, table_id: T3, restaurant_id: '00000000-0000-4000-8000-0000000000r1' },
  ];

  it('collects member table ids', () => {
    assert.deepEqual([...tablePartyMemberTableIds(members)].sort(), [T1, T2, T3].sort());
  });

  it('resolves party for a table', () => {
    assert.equal(partyIdForTable(members, T2), P1);
    assert.equal(partyIdForTable(members, T4), null);
  });

  it('finds conflicts when adding to another party', () => {
    const conflicts = conflictingPartyMembers(members, [T2, T4], P2);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.table_id, T2);
  });

  it('counts checkout tables inside parties', () => {
    const ids = tablePartyMemberTableIds(members);
    assert.equal(countCheckoutTablesInParties(ids, [T1, T4]), 1);
  });

  it('allows checkout only when party has at most one member', () => {
    assert.equal(isPartyMemberCountAllowedForCheckout(0), true);
    assert.equal(isPartyMemberCountAllowedForCheckout(1), true);
    assert.equal(isPartyMemberCountAllowedForCheckout(2), false);
    assert.equal(isPartyMemberCountAllowedForCheckout(5), false);
  });

  it('allocates login-together-N defaults (case-insensitive, per prefix)', () => {
    assert.equal(nextAvailableTablePartyName('alice', []), 'alice-together-1');
    assert.equal(
      nextAvailableTablePartyName('alice', ['alice-together-1']),
      'alice-together-2',
    );
    assert.equal(
      nextAvailableTablePartyName('alice', ['ALICE-together-1', 'alice-together-3']),
      'alice-together-2',
    );
    assert.equal(nextAvailableTablePartyName('bob', ['alice-together-1']), 'bob-together-1');
    assert.equal(partyNameKey('  AbC  '), 'abc');
    assert.equal(partyDefaultNameLoginPrefix(''), PARTY_DEFAULT_LOGIN_FALLBACK);
    assert.equal(
      nextAvailableTablePartyName(PARTY_DEFAULT_LOGIN_FALLBACK, []),
      'owner-together-1',
    );
    const longLogin = 'a'.repeat(40);
    const prefixed = nextAvailableTablePartyName(longLogin, []);
    assert.ok(prefixed.length <= 32);
    assert.match(prefixed, /-together-1$/);
  });

  it('detects case-insensitive party name conflicts', () => {
    const parties = [
      { id: P1, name: 'Family A' },
      { id: P2, name: 'Together 1' },
    ];
    assert.equal(partyHasNameConflict(parties, 'family a'), true);
    assert.equal(partyHasNameConflict(parties, 'family a', P1), false);
    assert.equal(partyHasNameConflict(parties, 'Together 2'), false);
  });

  it('appends new parties with a higher sort_order (lane grows right)', () => {
    assert.equal(nextAppendSortOrder([]), 0);
    assert.equal(nextAppendSortOrder([{ sort_order: 0 }]), 1);
    assert.equal(
      nextAppendSortOrder([{ sort_order: 1 }, { sort_order: 0 }, { sort_order: 2 }]),
      3,
    );
  });

  it('only dining tables are eligible to join a party', () => {
    const ctx = buildWaiterBoardStateContext(
      {
        [T1]: {
          sessionId: 's1',
          openedAt: '2026-01-01T00:00:00Z',
          status: 'open',
        },
        [T2]: {
          sessionId: 's2',
          openedAt: '2026-01-01T00:00:00Z',
          status: 'billing',
        },
      },
      [T2],
      [
        { tableId: T1, occupied: true },
        { tableId: T2, occupied: true },
        { tableId: T3, occupied: false },
        { tableId: T4, occupied: false },
      ],
    );
    const tables = [{ id: T1 }, { id: T2 }, { id: T3 }, { id: T4 }];
    assert.equal(isTableEligibleForPartyAdd(T1, ctx), true);
    assert.equal(isTableEligibleForPartyAdd(T2, ctx), false);
    assert.equal(isTableEligibleForPartyAdd(T3, ctx), false);
    assert.deepEqual(
      filterTablesEligibleForPartyAdd(tables, members, P1, ctx).map((t) => t.id),
      [],
    );
    assert.deepEqual(
      filterTablesEligibleForPartyAdd(tables, members, P2, ctx).map((t) => t.id),
      [T1],
    );
  });
});
