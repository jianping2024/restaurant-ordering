import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCollectedObligationFloors,
  byItemPoolFullyAllocated,
  collectModalAmountStillValid,
  mergeStaffByItemUnpaidDraftIntoLedger,
  orderByItemResultsToRoster,
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
  it('applies discount then subtracts prior collected', () => {
    const target = resolveByItemCollectTarget({
      personName: 'Ana',
      roster: [{ name: 'Ana', amount: 100 }],
      liveResults: [{ name: 'Ana', amount: 100 }],
      collectedPayments: [
        {
          id: '1',
          person_index: 0,
          person_name: 'Ana',
          amount: 10,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
      discountRate: 10,
    });
    // discounted 90 − prior 10 = 80 (never discount the outstanding again)
    assert.equal(target?.amount, 80);
  });

  it('matches modal amount after discount without a second discount pass', () => {
    const target = resolveByItemCollectTarget({
      personName: 'Ana',
      roster: [{ name: 'Ana', amount: 100 }],
      liveResults: [{ name: 'Ana', amount: 100 }],
      collectedPayments: [],
      discountRate: 10,
    });
    assert.equal(target?.amount, 90);
    assert.equal(target?.preDiscountObligation, 100);
    assert.equal(collectModalAmountStillValid(target!.amount, 90), true);
    assert.equal(collectModalAmountStillValid(100, 90), false);
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

  it('uses discounted obligation for chip settle keys', () => {
    const keys = settledByItemPersonKeys(
      [{ name: 'J', amount: 22.45 }],
      [
        {
          id: '1',
          person_index: 0,
          person_name: 'J',
          amount: 20.21,
          created_at: '',
          payment_method: 'CASH',
        },
      ],
      10,
    );
    assert.equal(keys.has(splitPartyKey(undefined, 'J')), true);
  });
});

describe('mergeStaffByItemUnpaidDraftIntoLedger', () => {
  it('keeps paid tickets and replaces unpaid after Jim→Marry reassign', () => {
    const paid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const jim = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const marry = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const locked = new Set([splitPartyKey(paid, 'John')]);
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [
        {
          name: 'John',
          party_id: paid,
          item_shares: [{ key: 'vitalis', qty_num: 1, qty_den: 1, locked_amount: 2 }],
          amount: 2,
        },
        {
          name: 'Jim',
          party_id: jim,
          item_shares: [
            { key: 'pina', qty_num: 1, qty_den: 1 },
            { key: 'cola', qty_num: 1, qty_den: 1 },
          ],
          amount: 12,
        },
        {
          name: 'Marry',
          party_id: marry,
          item_shares: [{ key: 'sangria', qty_num: 6, qty_den: 1 }],
          amount: 60,
        },
      ],
      existingResult: [
        { name: 'John', amount: 2, paid: true, party_id: paid },
        { name: 'Jim', amount: 12, party_id: jim },
        { name: 'Marry', amount: 60, party_id: marry },
      ],
      draftPersons: [
        {
          name: 'John',
          party_id: paid,
          item_shares: [{ key: 'vitalis', qty_num: 1, qty_den: 1, locked_amount: 2 }],
          amount: 2,
        },
        {
          name: 'Jim',
          party_id: jim,
          item_shares: [],
          amount: 0,
        },
        {
          name: 'Marry',
          party_id: marry,
          item_shares: [
            { key: 'sangria', qty_num: 6, qty_den: 1 },
            { key: 'pina', qty_num: 1, qty_den: 1 },
          ],
          amount: 69.35,
        },
      ],
      draftResults: [
        { name: 'John', amount: 2, paid: true, party_id: paid },
        { name: 'Marry', amount: 69.35, party_id: marry },
      ],
      lockedTicketKeys: locked,
    });
    assert.equal(merged.persons.length, 2);
    assert.equal(merged.persons[0]?.name, 'John');
    assert.equal(merged.persons[1]?.name, 'Marry');
    assert.equal(
      merged.persons[1]?.item_shares?.some((s) => s.key === 'pina'),
      true,
    );
    assert.equal(
      merged.persons.some((p) => p.name === 'Jim'),
      false,
    );
    assert.equal(merged.result[0]?.paid, true);
    assert.equal(merged.result[0]?.amount, 2);
    assert.equal(merged.result[1]?.amount, 69.35);
  });

  it('replaces whole-table sentinel when first unpaid draft ticket is written', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [{ name: WHOLE_TABLE_PAYER_KEY }],
      existingResult: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 10 }],
      draftPersons: [
        {
          name: 'Ana',
          party_id: id,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1, locked_amount: 2.2 }],
          amount: 2.2,
        },
      ],
      draftResults: [{ name: 'Ana', amount: 2.2, party_id: id }],
      lockedTicketKeys: new Set(),
    });
    assert.equal(merged.result.length, 1);
    assert.equal(merged.result[0]?.name, 'Ana');
    assert.equal(merged.result[0]?.amount, 2.2);
    assert.equal(merged.persons.length, 1);
  });

  it('keeps locked ledger when unpaid draft has no shares', () => {
    const paid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [
        {
          name: 'John',
          party_id: paid,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1, locked_amount: 2 }],
          amount: 2,
        },
      ],
      existingResult: [{ name: 'John', amount: 2, paid: true, party_id: paid }],
      draftPersons: [
        {
          name: 'Jim',
          party_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          item_shares: [],
        },
      ],
      draftResults: [],
      lockedTicketKeys: new Set([splitPartyKey(paid, 'John')]),
    });
    assert.equal(merged.persons.length, 1);
    assert.equal(merged.persons[0]?.name, 'John');
    assert.equal(merged.result[0]?.paid, true);
  });

  it('drops unpaid empty tickets when draft writes no shares', () => {
    const empty = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [{ name: '客人 1', party_id: empty, item_shares: [] }],
      existingResult: [{ name: '客人 1', amount: 0, party_id: empty }],
      draftPersons: [{ name: '客人 1', party_id: empty, item_shares: [] }],
      draftResults: [],
      lockedTicketKeys: new Set(),
    });
    assert.equal(merged.persons.length, 0);
    assert.equal(merged.result.length, 0);
  });

  it('keeps existing unpaid-with-shares when draft omits that ticket', () => {
    const keep = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const paid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [
        {
          name: '客人 1',
          party_id: keep,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1 }],
        },
        {
          name: '客人 2',
          party_id: paid,
          item_shares: [],
        },
      ],
      existingResult: [
        { name: '客人 1', amount: 2.2, party_id: keep },
        { name: '客人 2', amount: 0, paid: true, party_id: paid },
      ],
      draftPersons: [],
      draftResults: [{ name: '客人 2', amount: 0, paid: true, party_id: paid }],
      lockedTicketKeys: new Set([splitPartyKey(paid, '客人 2')]),
    });
    assert.equal(merged.persons.some((p) => p.name === '客人 1'), true);
    assert.equal(
      merged.persons.find((p) => p.name === '客人 1')?.item_shares?.length,
      1,
    );
  });

  it('keeps result person_index order and refreshes locked-unpaid amount from draft', () => {
    const john = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const jim = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const marry = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    // Stale ledger: Jim carries Marry's obligation; persons order differs from result.
    const merged = mergeStaffByItemUnpaidDraftIntoLedger({
      existingPersons: [
        {
          name: 'John',
          party_id: john,
          item_shares: [{ key: 'a', qty_num: 1, qty_den: 1, locked_amount: 184 }],
        },
        {
          name: 'Marry',
          party_id: marry,
          item_shares: [{ key: 'b', qty_num: 1, qty_den: 1, locked_amount: 79.35 }],
        },
        {
          name: 'Jim',
          party_id: jim,
          item_shares: [{ key: 'c', qty_num: 1, qty_den: 1, locked_amount: 19.7 }],
        },
      ],
      existingResult: [
        { name: 'John', amount: 184, paid: true, party_id: john },
        { name: 'Jim', amount: 79.35, paid: false, party_id: jim },
        { name: 'Marry', amount: 79.35, paid: true, party_id: marry },
      ],
      draftPersons: [
        {
          name: 'John',
          party_id: john,
          item_shares: [{ key: 'a', qty_num: 1, qty_den: 1, locked_amount: 184 }],
        },
        {
          name: 'Marry',
          party_id: marry,
          item_shares: [{ key: 'b', qty_num: 1, qty_den: 1, locked_amount: 79.35 }],
        },
        {
          name: 'Jim',
          party_id: jim,
          item_shares: [{ key: 'c', qty_num: 1, qty_den: 1, locked_amount: 19.7 }],
        },
      ],
      draftResults: [
        { name: 'John', amount: 184, party_id: john },
        { name: 'Jim', amount: 19.7, party_id: jim },
        { name: 'Marry', amount: 79.35, party_id: marry },
      ],
      lockedTicketKeys: new Set([
        splitPartyKey(john, 'John'),
        splitPartyKey(jim, 'Jim'),
        splitPartyKey(marry, 'Marry'),
      ]),
    });
    assert.deepEqual(
      merged.result.map((row) => ({
        name: row.name,
        amount: row.amount,
        paid: !!row.paid,
        party_id: row.party_id,
      })),
      [
        { name: 'John', amount: 184, paid: true, party_id: john },
        { name: 'Jim', amount: 19.7, paid: false, party_id: jim },
        { name: 'Marry', amount: 79.35, paid: true, party_id: marry },
      ],
    );
    assert.deepEqual(
      merged.persons.map((row) => row.party_id),
      merged.result.map((row) => row.party_id),
    );
  });
});

describe('collectModalAmountStillValid', () => {
  it('compares cents', () => {
    assert.equal(collectModalAmountStillValid(0.73, 0.73), true);
    assert.equal(collectModalAmountStillValid(0.73, 0.74), false);
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
