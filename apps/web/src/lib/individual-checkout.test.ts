import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  individualPhoneHoldsOrdering,
  mergeIndividualTickets,
  recomputeIndividualTicketAmounts,
  ticketKeysOfResult,
  validateIndividualCall,
  type IndividualTicketInfo,
} from './individual-checkout';
import type { BillSplitOrderLine, ByItemLineSpec } from './bill-split-by-item-lines';
import type { SplitPerson, SplitResult } from '../types';

const PA = '11111111-1111-4111-8111-111111111111';
const PB = '22222222-2222-4222-8222-222222222222';
const PC = '33333333-3333-4333-8333-333333333333';

function spec(key: string, qty: number, price: number): ByItemLineSpec {
  return { mode: 'menu', key, lineQty: qty, lineTotal: qty * price, unitPrice: price };
}

function line(key: string, qty: number, price: number): BillSplitOrderLine {
  return {
    key,
    order_id: 'o1',
    id: key,
    qty,
    price,
    name: key,
    name_pt: key,
    emoji: '',
    kind: 'menu',
  };
}

function person(name: string, partyId: string, shares: Array<[string, number]>): SplitPerson {
  return {
    name,
    party_id: partyId,
    item_shares: shares.map(([key, qty]) => ({
      key,
      qty_num: qty,
      qty_den: 1,
      party_id: partyId,
    })),
  };
}

function row(name: string, partyId: string, amount: number, paid?: boolean): SplitResult {
  return { name, party_id: partyId, amount, ...(paid ? { paid: true } : {}) };
}

describe('mergeIndividualTickets', () => {
  it('appends a new ticket and keeps existing rows byte-identical and in order', () => {
    const a = person('Wang', PA, [['L1', 1]]);
    const b = person('Li', PB, [['L2', 1]]);
    const merged = mergeIndividualTickets({
      existingPersons: [a],
      existingResult: [row('Wang', PA, 11)],
      myPersons: [b],
      myResult: [row('Li', PB, 29)],
    });
    assert.deepEqual(merged.myKeys, [`p:${PB}`]);
    assert.equal(merged.persons[0], a);
    assert.deepEqual(merged.result.map((r) => r.name), ['Wang', 'Li']);
  });

  it('replaces a re-called ticket in place instead of appending a duplicate', () => {
    const a1 = person('Wang', PA, [['L1', 1]]);
    const b = person('Li', PB, [['L2', 1]]);
    const a2 = person('Wang', PA, [['L1', 1], ['L3', 1]]);
    const merged = mergeIndividualTickets({
      existingPersons: [a1, b],
      existingResult: [row('Wang', PA, 11), row('Li', PB, 29)],
      myPersons: [a2],
      myResult: [row('Wang', PA, 14)],
    });
    assert.equal(merged.persons.length, 2);
    assert.equal(merged.persons[0], a2);
    assert.equal(merged.persons[1], b);
    assert.equal(merged.result[0]!.amount, 14);
    assert.equal(merged.result.length, 2);
  });

  it('ignores persons of other tickets sent by the client', () => {
    const merged = mergeIndividualTickets({
      existingPersons: [person('Wang', PA, [['L1', 1]])],
      existingResult: [row('Wang', PA, 11)],
      myPersons: [person('Wang', PA, [['L1', 1]]), person('Li', PB, [['L2', 1]])],
      myResult: [row('Li', PB, 29)],
    });
    assert.equal(merged.persons.length, 2);
    assert.equal(merged.persons[0]!.name, 'Wang');
  });
});

describe('validateIndividualCall', () => {
  const specs = [spec('L1', 1, 20), spec('L2', 2, 8), spec('L3', 4, 3)];

  it('accepts a partial claim (pool left over)', () => {
    const issue = validateIndividualCall({
      lineSpecs: specs,
      persons: [person('Wang', PA, [['L2', 1], ['L3', 1]])],
      result: [row('Wang', PA, 11)],
      myKeys: [`p:${PA}`],
    });
    assert.deepEqual(issue, { ok: true });
  });

  it('rejects a call that carries more than one ticket (one phone, one ticket)', () => {
    const issue = validateIndividualCall({
      lineSpecs: specs,
      persons: [person('Wang', PA, [['L2', 1]]), person('Li', PB, [['L3', 1]])],
      result: [row('Wang', PA, 8), row('Li', PB, 3)],
      myKeys: [`p:${PA}`, `p:${PB}`],
    });
    assert.deepEqual(issue, { ok: false, code: 'invalid_ticket' });
  });

  it('rejects claiming more than is left (first-come claim_conflict)', () => {
    const issue = validateIndividualCall({
      lineSpecs: specs,
      persons: [
        person('Li', PB, [['L1', 1]]),
        person('Zhang', PC, [['L1', 1]]),
      ],
      result: [row('Li', PB, 20), row('Zhang', PC, 20)],
      myKeys: [`p:${PC}`],
    });
    assert.deepEqual(issue, { ok: false, code: 'claim_conflict', lineKeys: ['L1'] });
  });

  it('rejects a name already used by another unpaid ticket, but not by a paid one', () => {
    const base = {
      lineSpecs: specs,
      persons: [person('Wang', PA, [['L2', 1]]), person('wang', PB, [['L3', 1]])],
      myKeys: [`p:${PB}`],
    };
    const unpaid = validateIndividualCall({
      ...base,
      result: [row('Wang', PA, 8), row('wang', PB, 3)],
    });
    assert.deepEqual(unpaid, { ok: false, code: 'name_taken', names: ['wang'] });

    const paid = validateIndividualCall({
      ...base,
      result: [row('Wang', PA, 8, true), row('wang', PB, 3)],
    });
    assert.deepEqual(paid, { ok: true });
  });

  it('rejects an empty ticket', () => {
    const issue = validateIndividualCall({
      lineSpecs: specs,
      persons: [{ name: 'Wang', party_id: PA, item_shares: [] }],
      result: [row('Wang', PA, 0)],
      myKeys: [`p:${PA}`],
    });
    assert.equal(issue.ok, false);
    if (!issue.ok) assert.equal(issue.code, 'empty_ticket');
  });
});

describe('recomputeIndividualTicketAmounts', () => {
  it('overrides a client-forged amount for my ticket and leaves others untouched', () => {
    const lines = [line('L1', 1, 20), line('L2', 2, 8)];
    const specs = [spec('L1', 1, 20), spec('L2', 2, 8)];
    const out = recomputeIndividualTicketAmounts({
      orderLines: lines,
      lineSpecs: specs,
      persons: [person('Wang', PA, [['L2', 1]]), person('Li', PB, [['L1', 1]])],
      result: [row('Wang', PA, 8), row('Li', PB, 0.01)],
      myKeys: [`p:${PB}`],
    });
    assert.equal(out[0]!.amount, 8);
    assert.equal(out[1]!.amount, 20);
  });
});

describe('phone ordering hold', () => {
  const tickets: IndividualTicketInfo[] = [
    { ticket_key: `p:${PA}`, name: 'Wang', state: 'called', mine: true },
    { ticket_key: `p:${PB}`, name: 'Li', state: 'called', mine: false },
    { ticket_key: `p:${PC}`, name: 'Zhang', state: 'unlocked', mine: true },
  ];

  it('holds ordering only for my called unpaid ticket', () => {
    assert.equal(individualPhoneHoldsOrdering(tickets, [row('Wang', PA, 11)]), true);
    assert.equal(individualPhoneHoldsOrdering(tickets, [row('Wang', PA, 11, true)]), false);
    assert.equal(
      individualPhoneHoldsOrdering(
        [{ ticket_key: `p:${PC}`, name: 'Zhang', state: 'unlocked', mine: true }],
        [],
      ),
      false,
    );
  });

  it('ticketKeysOfResult dedupes and skips blanks', () => {
    assert.deepEqual(
      ticketKeysOfResult([row('A', PA, 1), row('A', PA, 1), { name: '', amount: 0 }]),
      [`p:${PA}`],
    );
  });
});
