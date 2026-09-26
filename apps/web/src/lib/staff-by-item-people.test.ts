import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';
import {
  appendStaffByItemRailPeople,
  staffByItemLedgerPersonNames,
  staffByItemLockedLedgerNames,
  staffByItemRailSeedNames,
} from './staff-by-item-people';

describe('staffByItemLedgerPersonNames', () => {
  it('drops whole-table sentinel and dedupes', () => {
    assert.deepEqual(
      staffByItemLedgerPersonNames([WHOLE_TABLE_PAYER_KEY, 'Ana', ' ana ', '整桌', 'Bob']),
      ['Ana', 'Bob'],
    );
  });
});

describe('staffByItemRailSeedNames', () => {
  it('seeds guest when ledger is only whole-table', () => {
    assert.deepEqual(
      staffByItemRailSeedNames({
        ledgerNames: [WHOLE_TABLE_PAYER_KEY],
        allocationNames: [],
      }),
      [],
    );
    assert.deepEqual(
      staffByItemRailSeedNames({
        ledgerNames: [WHOLE_TABLE_PAYER_KEY],
        allocationNames: ['Ana'],
      }),
      ['Ana'],
    );
  });
});

describe('appendStaffByItemRailPeople', () => {
  it('does not re-inject unlocked renamed-away ledger names', () => {
    const afterRename = ['Bob'];
    // Stale unlocked ledger still has Ana — must not come back via merge.
    const next = appendStaffByItemRailPeople(afterRename, []);
    assert.equal(next, afterRename);
    assert.deepEqual(
      appendStaffByItemRailPeople(afterRename, staffByItemLockedLedgerNames(['Ana'], new Set())),
      ['Bob'],
    );
    assert.deepEqual(
      appendStaffByItemRailPeople(
        afterRename,
        staffByItemLockedLedgerNames(['Ana'], new Set(['ana'])),
      ),
      ['Bob', 'Ana'],
    );
  });

  it('appends allocation names after rename', () => {
    assert.deepEqual(appendStaffByItemRailPeople(['Bob'], ['Bob', 'Carla']), ['Bob', 'Carla']);
  });
});
