import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';
import { splitPartyKey } from './split-party-id';
import {
  appendStaffByItemRailPeople,
  resolveStaffByItemRailPeople,
  staffByItemLedgerPeople,
  staffByItemLockedLedgerPeople,
  staffByItemRailSeedPeople,
  syncStaffByItemRailPeople,
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

describe('resolveStaffByItemRailPeople', () => {
  it('returns named tickets and never mints a blank guest', () => {
    assert.deepEqual(
      resolveStaffByItemRailPeople({
        lockedLedgerPeople: [{ name: 'John', partyId: 'j1' }],
        allocationPeople: [{ name: 'Marry', partyId: 'm1' }],
        awaitingHydrate: false,
      }),
      [
        { name: 'John', partyId: 'j1' },
        { name: 'Marry', partyId: 'm1' },
      ],
    );
  });

  it('returns empty while awaiting hydrate (no ghost mint)', () => {
    assert.deepEqual(
      resolveStaffByItemRailPeople({
        lockedLedgerPeople: [],
        allocationPeople: [],
        awaitingHydrate: true,
      }),
      [],
    );
  });

  it('returns empty for blank staff start (caller may mint once)', () => {
    assert.deepEqual(
      resolveStaffByItemRailPeople({
        lockedLedgerPeople: [],
        allocationPeople: [],
        awaitingHydrate: false,
      }),
      [],
    );
  });
});

describe('syncStaffByItemRailPeople', () => {
  it('replaces early blank mint when authoritative has no overlap', () => {
    const ghost = [{ name: '客人 1', partyId: 'ghost' }];
    const auth = [
      { name: 'John', partyId: 'j1' },
      { name: 'Marry', partyId: 'm1' },
    ];
    assert.deepEqual(syncStaffByItemRailPeople(ghost, auth), auth);
  });

  it('appends when overlap (keeps serial-collect unpaid blank)', () => {
    const prev = [
      { name: 'John', partyId: 'j1' },
      { name: '客人 2', partyId: 'blank' },
    ];
    const auth = [{ name: 'John', partyId: 'j1' }];
    assert.deepEqual(syncStaffByItemRailPeople(prev, auth), prev);
  });

  it('keeps prev when authoritative empty', () => {
    const prev = [{ name: '客人 1', partyId: 'g' }];
    assert.equal(syncStaffByItemRailPeople(prev, []), prev);
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
