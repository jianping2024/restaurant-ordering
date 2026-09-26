import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';
import { splitPartyKey } from './split-party-id';
import {
  appendStaffByItemRailPeople,
  staffByItemLedgerPeople,
  staffByItemLockedLedgerPeople,
  staffByItemRailSeedPeople,
} from './staff-by-item-people';

describe('staffByItemLedgerPeople', () => {
  it('drops whole-table sentinel and dedupes by ticket key', () => {
    assert.deepEqual(
      staffByItemLedgerPeople([
        { name: WHOLE_TABLE_PAYER_KEY },
        { name: 'Ana' },
        { name: ' ana ' },
        { name: '整桌' },
        { name: 'Bob' },
      ]),
      [{ name: 'Ana' }, { name: 'Bob' }],
    );
  });

  it('keeps same display name when party_id differs', () => {
    const people = staffByItemLedgerPeople([
      { name: '客人 3', partyId: 'aaa' },
      { name: '客人 3', partyId: 'bbb' },
    ]);
    assert.equal(people.length, 2);
    assert.equal(people[0]?.partyId, 'aaa');
    assert.equal(people[1]?.partyId, 'bbb');
  });
});

describe('staffByItemRailSeedPeople', () => {
  it('seeds guest when ledger is only whole-table', () => {
    assert.deepEqual(
      staffByItemRailSeedPeople({
        ledgerPeople: [{ name: WHOLE_TABLE_PAYER_KEY }],
        allocationPeople: [],
      }),
      [],
    );
    assert.deepEqual(
      staffByItemRailSeedPeople({
        ledgerPeople: [{ name: WHOLE_TABLE_PAYER_KEY }],
        allocationPeople: [{ name: 'Ana' }],
      }),
      [{ name: 'Ana' }],
    );
  });
});

describe('appendStaffByItemRailPeople', () => {
  it('does not re-inject unlocked renamed-away ledger names', () => {
    const afterRename = [{ name: 'Bob' }];
    const next = appendStaffByItemRailPeople(afterRename, []);
    assert.equal(next, afterRename);
    assert.deepEqual(
      appendStaffByItemRailPeople(
        afterRename,
        staffByItemLockedLedgerPeople([{ name: 'Ana' }], new Set()),
      ),
      [{ name: 'Bob' }],
    );
    assert.deepEqual(
      appendStaffByItemRailPeople(
        afterRename,
        staffByItemLockedLedgerPeople(
          [{ name: 'Ana' }],
          new Set([splitPartyKey(undefined, 'Ana')]),
        ),
      ),
      [{ name: 'Bob' }, { name: 'Ana' }],
    );
  });

  it('appends allocation tickets after rename', () => {
    assert.deepEqual(
      appendStaffByItemRailPeople([{ name: 'Bob' }], [{ name: 'Bob' }, { name: 'Carla' }]),
      [{ name: 'Bob' }, { name: 'Carla' }],
    );
  });
});
