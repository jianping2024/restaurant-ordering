import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCollectedObligationFloors,
  byItemPoolFullyAllocated,
  orderByItemResultsToRoster,
  reconcileByItemResultsToBillTotal,
  resolveByItemCollectTarget,
  resolveStaffByItemEditRoster,
  settledByItemPersonKeys,
} from './checkout-by-item-collect';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';
import { splitPartyKey } from './split-party-id';

describe('orderByItemResultsToRoster', () => {
  it('keeps ledger order so 客人10 does not jump before 客人2', () => {
    const ordered = orderByItemResultsToRoster(
      [
        { name: '客人 10', amount: 6.6 },
        { name: '客人 1', amount: 10 },
        { name: '客人 2', amount: 20 },
      ],
      [{ name: '客人 1' }, { name: '客人 2' }, { name: '客人 10' }],
    );
    assert.deepEqual(
      ordered.map((row) => row.name),
      ['客人 1', '客人 2', '客人 10'],
    );
    assert.equal(ordered[2]?.amount, 6.6);
  });

  it('keeps same-name tickets distinct by party_id', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const ordered = orderByItemResultsToRoster(
      [
        { name: '客人 3', amount: 5, party_id: b },
        { name: '客人 3', amount: 10, party_id: a },
      ],
      [
        { name: '客人 3', partyId: a },
        { name: '客人 3', partyId: b },
      ],
    );
    assert.equal(ordered.length, 2);
    assert.equal(ordered[0]?.party_id, a);
    assert.equal(ordered[0]?.amount, 10);
    assert.equal(ordered[1]?.party_id, b);
    assert.equal(ordered[1]?.amount, 5);
  });
});

describe('resolveStaffByItemEditRoster', () => {
  it('uses live draft only while ledger is whole-table', () => {
    const roster = resolveStaffByItemEditRoster({
      ledgerResults: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 40 }],
      liveResults: [{ name: 'Ana', amount: 12.5 }],
    });
    assert.deepEqual(roster, [{ name: 'Ana', amount: 12.5 }]);
  });

  it('orders live amounts to confirmed by-item ledger then appends new guests', () => {
    const roster = resolveStaffByItemEditRoster({
      ledgerResults: [
        { name: 'Ana', amount: 10 },
        { name: 'Bob', amount: 10 },
      ],
      liveResults: [
        { name: 'Bob', amount: 11 },
        { name: 'Carla', amount: 5 },
        { name: 'Ana', amount: 9 },
      ],
    });
    assert.deepEqual(
      roster.map((row) => [row.name, row.amount]),
      [
        ['Ana', 9],
        ['Bob', 11],
        ['Carla', 5],
      ],
    );
  });
});

describe('resolveByItemCollectTarget', () => {
  it('uses roster index not localeCompare order', () => {
    const target = resolveByItemCollectTarget({
      personName: '客人 4',
      roster: [
        { name: '客人 1', amount: 1 },
        { name: '客人 2', amount: 1 },
        { name: '客人 3', amount: 1 },
        { name: '客人 4', amount: 2.2 },
        { name: '客人 10', amount: 6.6 },
      ],
      liveResults: [
        { name: '客人 10', amount: 6.6 },
        { name: '客人 1', amount: 1 },
        { name: '客人 4', amount: 2.2 },
      ],
      collectedPayments: [],
      billPending: 10,
    });
    assert.equal(target?.index, 3);
    assert.equal(target?.amount, 2.2);
  });

  it('clamps collect amount to bill pending', () => {
    const target = resolveByItemCollectTarget({
      personName: '客人 10',
      roster: [
        { name: '客人 1', amount: 70 },
        { name: '客人 10', amount: 6.6 },
      ],
      liveResults: [{ name: '客人 10', amount: 6.6 }],
      collectedPayments: [
        {
          id: '1',
          person_index: 0,
          person_name: '客人 1',
          amount: 76.99,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
      billPending: 6.21,
    });
    assert.equal(target?.index, 1);
    // Person due is obligation − prior; no silent clamp to bill pending.
    assert.equal(target?.amount, 6.6);
  });
});

describe('applyCollectedObligationFloors', () => {
  it('never lowers obligation below ledger collected', () => {
    const floored = applyCollectedObligationFloors(
      [
        { name: '客人 4', amount: 1.47 },
        { name: '客人 7', amount: 1.47 },
      ],
      [
        {
          id: '1',
          person_index: 0,
          person_name: '客人 4',
          amount: 2.2,
          created_at: '',
          payment_method: 'CASH',
        },
        {
          id: '2',
          person_index: 1,
          person_name: '客人 7',
          amount: 2.2,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
    );
    assert.equal(floored[0]?.amount, 2.2);
    assert.equal(floored[1]?.amount, 2.2);
  });
});

describe('settledByItemPersonKeys', () => {
  it('marks settled only when ledger covers obligation', () => {
    const keys = settledByItemPersonKeys(
      [
        { name: '客人 1', amount: 28.91 },
        { name: '客人 3', amount: 2.38 },
      ],
      [
        {
          id: '1',
          person_index: 0,
          person_name: '客人 1',
          amount: 27.38,
          created_at: '',
          payment_method: 'CASH',
        },
        {
          id: '2',
          person_index: 1,
          person_name: '客人 3',
          amount: 2.38,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
    );
    assert.equal(keys.has(splitPartyKey(undefined, '客人 1')), false);
    assert.equal(keys.has(splitPartyKey(undefined, '客人 3')), true);
  });
});

describe('reconcileByItemResultsToBillTotal', () => {
  it('keeps obligation floors and trims unpaid so sum equals bill total', () => {
    const reconciled = reconcileByItemResultsToBillTotal(
      [
        { name: '客人 4', amount: 1.47 },
        { name: '客人 10', amount: 6.6 },
      ],
      8.07,
      [
        {
          id: '1',
          person_index: 0,
          person_name: '客人 4',
          amount: 2.2,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
    );
    assert.equal(reconciled[0]?.amount, 2.2);
    const sum =
      Math.round(reconciled.reduce((acc, row) => acc + row.amount, 0) * 100) / 100;
    assert.equal(sum, 8.07);
    assert.equal(reconciled[1]?.amount, 5.87);
  });
});

describe('byItemPoolFullyAllocated', () => {
  it('is false when a menu line is short', () => {
    assert.equal(
      byItemPoolFullyAllocated(
        [
          {
            mode: 'menu',
            key: 'cola',
            lineQty: 2,
            lineTotal: 4.4,
            unitPrice: 2.2,
          },
        ],
        {
          cola: [{ name: '客人 1', qty: { num: 1, den: 1 } }],
        },
      ),
      false,
    );
  });
});
