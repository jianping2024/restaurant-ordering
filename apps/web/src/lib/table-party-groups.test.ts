import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  conflictingPartyMembers,
  countCheckoutTablesInParties,
  defaultTablePartyName,
  partyIdForTable,
  tablePartyMemberTableIds,
} from './table-party-groups';

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

  it('names parties sequentially', () => {
    assert.equal(defaultTablePartyName(0), '同行 1');
    assert.equal(defaultTablePartyName(2), '同行 3');
  });
});
