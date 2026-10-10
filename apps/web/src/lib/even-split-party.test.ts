import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocationLockedEvenPartyIds,
  ensureEvenPersonDrafts,
  evenAuthoritativeRowCount,
  evenPersonDraftsFromSplit,
} from './even-split-party';
import type { BillSplit } from '../types';

function evenSplit(partial: Partial<BillSplit>): BillSplit {
  return {
    id: 's1',
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: '1',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [],
    total_amount: 100,
    status: 'requested',
    created_at: '',
    ...partial,
  };
}

describe('evenAuthoritativeRowCount', () => {
  it('prefers persons when result was rename-appended longer', () => {
    assert.equal(
      evenAuthoritativeRowCount(
        evenSplit({
          persons: [{ name: 'A' }, { name: 'hh' }, { name: 'C' }],
          result: [
            { name: 'A', amount: 1, paid: true },
            { name: 'B', amount: 1 },
            { name: 'C', amount: 1 },
            { name: 'hh', amount: 1, paid: true },
          ],
        }),
      ),
      3,
    );
  });

  it('uses max when lengths match or one side empty', () => {
    assert.equal(
      evenAuthoritativeRowCount(
        evenSplit({
          persons: [],
          result: [
            { name: 'A', amount: 1 },
            { name: 'B', amount: 1 },
          ],
        }),
      ),
      2,
    );
  });
});

describe('evenPersonDraftsFromSplit', () => {
  it('keeps party_id and persons names on dirty rename-append rows', () => {
    const idA = '11111111-1111-4111-8111-111111111111';
    const idHh = '22222222-2222-4222-8222-222222222222';
    const drafts = evenPersonDraftsFromSplit(
      evenSplit({
        persons: [
          { name: '客人 1', party_id: idA },
          { name: 'hh', party_id: idHh },
          { name: '客人 3' },
        ],
        result: [
          { name: '客人 1', amount: 41.48, paid: true, party_id: idA },
          { name: '客人 2', amount: 41.48 },
          { name: '客人 3', amount: 41.48 },
          { name: 'hh', amount: 41.49, paid: true, party_id: idHh },
        ],
      }),
      (n) => `Guest ${n}`,
    );
    assert.equal(drafts?.length, 3);
    assert.equal(drafts?.[0]?.name, '客人 1');
    assert.equal(drafts?.[0]?.partyId, idA);
    assert.equal(drafts?.[1]?.name, 'hh');
    assert.equal(drafts?.[1]?.partyId, idHh);
    assert.equal(drafts?.[2]?.name, '客人 3');
  });
});

describe('ensureEvenPersonDrafts', () => {
  it('renames in place without changing party_id', () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const next = ensureEvenPersonDrafts(
      [{ partyId: id, name: '旧名' }],
      1,
      (n) => `Guest ${n}`,
    );
    assert.equal(next.length, 1);
    assert.equal(next[0]?.partyId, id);
    assert.equal(next[0]?.name, '旧名');
  });

  it('mints party_id for new seats', () => {
    const next = ensureEvenPersonDrafts([], 2, (n) => `Guest ${n}`);
    assert.equal(next.length, 2);
    assert.notEqual(next[0]?.partyId, next[1]?.partyId);
    assert.match(next[0]!.partyId, /^[0-9a-f-]{36}$/i);
  });
});

describe('allocationLockedEvenPartyIds', () => {
  it('locks paid seats by party_id', () => {
    const id = '44444444-4444-4444-8444-444444444444';
    const keys = allocationLockedEvenPartyIds(
      evenSplit({
        result: [
          { name: 'A', amount: 10, paid: true, party_id: id },
          { name: 'B', amount: 10, party_id: '55555555-5555-4555-8555-555555555555' },
        ],
      }),
      [],
    );
    assert.equal(keys.has(id), true);
    assert.equal(keys.size, 1);
  });
});
