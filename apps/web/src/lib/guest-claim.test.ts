import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { BillSplitOrderLine, ByItemLineSpec } from './bill-split-by-item-lines';
import {
  applyGuestClaimRowPatch,
  buildMyTicket,
  claimAllRemaining,
  claimFromServerTicket,
  claimNameTaken,
  claimRowFor,
  clampGuestClaimBuffetRows,
  guestBuffetSeatCeil,
  guestClaimIssue,
  lineAvailability,
  lineOverClaimed,
  othersAllocation,
  parseGuestClaimDraft,
  pruneClaimRows,
  type GuestClaim,
} from './guest-claim';
import type { SplitPerson, SplitResult } from '../types';

const ME = '11111111-1111-4111-8111-111111111111';
const LI = '22222222-2222-4222-8222-222222222222';

const menuSpec = (key: string, qty: number, price: number): ByItemLineSpec => ({
  mode: 'menu',
  key,
  lineQty: qty,
  lineTotal: qty * price,
  unitPrice: price,
});
const buffetSpec: ByItemLineSpec = {
  mode: 'buffet',
  key: 'BF',
  lineTotal: 2 * 20 + 1 * 10,
  adults: 2,
  children: 1,
  adultUnitPrice: 20,
  childUnitPrice: 10,
};
const specs: ByItemLineSpec[] = [menuSpec('L1', 4, 5), menuSpec('L2', 1, 20), buffetSpec];

const orderLine = (key: string, qty: number, price: number): BillSplitOrderLine => ({
  key,
  order_id: 'o1',
  id: key,
  qty,
  price,
  name: key,
  name_pt: key,
  emoji: '',
  kind: 'menu',
});
const orderLines = [orderLine('L1', 4, 5), orderLine('L2', 1, 20)];

function claim(name: string, rows: GuestClaim['rows'] = {}): GuestClaim {
  return { name, partyId: ME, rows };
}

function withQty(c: GuestClaim, spec: ByItemLineSpec, patch: Record<string, string>): GuestClaim {
  return { ...c, rows: { ...c.rows, [spec.key]: { ...claimRowFor(c, spec), ...patch } } };
}

function liPerson(shares: Array<[string, number]>): SplitPerson {
  return {
    name: 'Li',
    party_id: LI,
    item_shares: shares.map(([key, qty]) => ({ key, qty_num: qty, qty_den: 1, party_id: LI })),
  };
}

describe('lineAvailability', () => {
  it('shows what the others hold and what is left', () => {
    const others = othersAllocation([liPerson([['L1', 3]])], claim('Me'), specs);
    const left = lineAvailability(specs[0]!, others);
    assert.equal(left.mode, 'menu');
    if (left.mode !== 'menu') return;
    assert.equal(left.claimedByOthers.num, 3);
    assert.equal(left.remaining.num, 1);
  });

  it('never counts my own ticket as someone else', () => {
    const mine: SplitPerson = {
      name: 'Me',
      party_id: ME,
      item_shares: [{ key: 'L1', qty_num: 2, qty_den: 1, party_id: ME }],
    };
    const others = othersAllocation([mine], claim('Me'), specs);
    assert.equal(lineAvailability(specs[0]!, others).mode, 'menu');
    assert.equal((others.L1 ?? []).length, 0);
  });

  it('tracks adult / child heads for buffet lines', () => {
    const buffetLi: SplitPerson = {
      name: 'Li',
      party_id: LI,
      item_shares: [{ key: 'BF', qty_num: 1, qty_den: 1, guest_type: 'adult', party_id: LI }],
    };
    const left = lineAvailability(buffetSpec, othersAllocation([buffetLi], claim('Me'), specs));
    assert.equal(left.mode, 'buffet');
    if (left.mode !== 'buffet') return;
    assert.equal(left.adultsRemaining, 1);
    assert.equal(left.childrenRemaining, 1);
    assert.equal(guestBuffetSeatCeil(left, 'adultQty'), 1);
    assert.equal(guestBuffetSeatCeil(left, 'childQty'), 1);
  });
});

describe('guest buffet seat ceil + clamp', () => {
  const buffetLi: SplitPerson = {
    name: 'Li',
    party_id: LI,
    item_shares: [{ key: 'BF', qty_num: 1, qty_den: 1, guest_type: 'adult', party_id: LI }],
  };

  it('plus patches cannot exceed remaining after others claimed', () => {
    const others = othersAllocation([buffetLi], claim('Me'), specs);
    let c = claim('Me');
    c = applyGuestClaimRowPatch(c, buffetSpec, { adultQty: '1' }, others);
    assert.equal(c.rows.BF!.adultQty, '1');
    c = applyGuestClaimRowPatch(c, buffetSpec, { adultQty: '2' }, others);
    assert.equal(c.rows.BF!.adultQty, '1');
    c = applyGuestClaimRowPatch(c, buffetSpec, { adultQty: '5' }, others);
    assert.equal(c.rows.BF!.adultQty, '1');
  });

  it('squashes a dirty over-claim draft down to remaining', () => {
    const others = othersAllocation([buffetLi], claim('Me'), specs);
    const dirty = withQty(claim('Me'), buffetSpec, { adultQty: '5', childQty: '9' });
    const clamped = clampGuestClaimBuffetRows(dirty, specs, others);
    assert.equal(clamped.rows.BF!.adultQty, '1');
    assert.equal(clamped.rows.BF!.childQty, '1');
  });
});

describe('buildMyTicket', () => {
  it('is one ticket with this phone id and a pool-aware amount', () => {
    const c = withQty(claim('Me'), specs[0]!, { qtyWhole: '2' });
    const ticket = buildMyTicket({ claim: c, lineSpecs: specs, orderLines, others: {}, lang: 'pt' });
    assert.equal(ticket.hasClaim, true);
    assert.equal(ticket.persons.length, 1);
    assert.equal(ticket.persons[0]!.party_id, ME);
    assert.equal(ticket.result.length, 1);
    assert.equal(ticket.amount, 10);
  });

  it('is empty when nothing is claimed or the name is blank', () => {
    const none = buildMyTicket({ claim: claim('Me'), lineSpecs: specs, orderLines, others: {}, lang: 'pt' });
    assert.equal(none.hasClaim, false);
    const unnamed = buildMyTicket({
      claim: withQty(claim(''), specs[0]!, { qtyWhole: '1' }),
      lineSpecs: specs,
      orderLines,
      others: {},
      lang: 'pt',
    });
    assert.equal(unnamed.hasClaim, false);
  });

  it('an untouched buffet row claims nobody (blank is 0, not one adult)', () => {
    const c = withQty(claim('Me'), specs[1]!, { qtyWhole: '1' });
    const ticket = buildMyTicket({
      claim: { ...c, rows: { ...c.rows, BF: claimRowFor(c, buffetSpec) } },
      lineSpecs: specs,
      orderLines,
      others: {},
      lang: 'pt',
    });
    const buffetShare = ticket.persons[0]!.item_shares?.find((share) => share.key === 'BF');
    assert.equal(buffetShare, undefined);
  });
});

describe('guestClaimIssue', () => {
  const base = (c: GuestClaim, others = {}, results: SplitResult[] = []) => {
    const ticket = buildMyTicket({ claim: c, lineSpecs: specs, orderLines, others, lang: 'pt' });
    return guestClaimIssue({ claim: c, lineSpecs: specs, others, results, hasClaim: ticket.hasClaim });
  };

  it('is clear for a named claim within the pool', () => {
    assert.equal(base(withQty(claim('Me'), specs[0]!, { qtyWhole: '1' })), null);
  });

  it('asks for a claim, then a name', () => {
    assert.equal(base(claim('Me')), 'nothing_claimed');
    assert.equal(base(withQty(claim(''), specs[0]!, { qtyWhole: '1' })), 'nothing_claimed');
  });

  it('flags over-claiming against what the others already hold', () => {
    const others = othersAllocation([liPerson([['L1', 3]])], claim('Me'), specs);
    const c = withQty(claim('Me'), specs[0]!, { qtyWhole: '2' });
    assert.equal(lineOverClaimed(specs[0]!, c, others), true);
    assert.equal(base(c, others), 'over_claim');
  });

  it('flags an invalid fraction', () => {
    assert.equal(base(withQty(claim('Me'), specs[0]!, { qtyNum: '1' })), 'invalid_qty');
  });

  it('flags a name an unpaid other ticket already uses, not a paid one', () => {
    const c = withQty(claim('li'), specs[0]!, { qtyWhole: '1' });
    const unpaid: SplitResult[] = [{ name: 'Li', party_id: LI, amount: 5 }];
    const paid: SplitResult[] = [{ name: 'Li', party_id: LI, amount: 5, paid: true }];
    assert.equal(claimNameTaken(unpaid, c), true);
    assert.equal(claimNameTaken(paid, c), false);
    assert.equal(base(c, {}, unpaid), 'name_taken');
    assert.equal(base(c, {}, paid), null);
  });
});

describe('claimAllRemaining', () => {
  it('takes exactly what the others left, including buffet heads', () => {
    const buffetLi: SplitPerson = {
      name: 'Li',
      party_id: LI,
      item_shares: [
        { key: 'L1', qty_num: 3, qty_den: 1, party_id: LI },
        { key: 'BF', qty_num: 1, qty_den: 1, guest_type: 'adult', party_id: LI },
      ],
    };
    const others = othersAllocation([buffetLi], claim('Me'), specs);
    const all = claimAllRemaining(claim('Me'), specs, others);
    assert.equal(all.rows.L1!.qtyWhole, '1');
    assert.equal(all.rows.L2!.qtyWhole, '1');
    assert.equal(all.rows.BF!.adultQty, '1');
    assert.equal(all.rows.BF!.childQty, '1');
    assert.equal(lineOverClaimed(specs[0]!, all, others), false);
  });

  it('claims a fractional remainder as a fraction', () => {
    const half: SplitPerson = {
      name: 'Li',
      party_id: LI,
      item_shares: [{ key: 'L2', qty_num: 1, qty_den: 2, party_id: LI }],
    };
    const all = claimAllRemaining(claim('Me'), specs, othersAllocation([half], claim('Me'), specs));
    assert.equal(all.rows.L2!.qtyNum, '1');
    assert.equal(all.rows.L2!.qtyDen, '2');
  });
});

describe('server ticket <-> claim', () => {
  it('rebuilds the editable claim (name, id, quantities) from a stored ticket', () => {
    const stored: SplitPerson = {
      name: 'Me',
      party_id: ME,
      item_shares: [
        { key: 'L1', qty_num: 2, qty_den: 1, party_id: ME },
        { key: 'L2', qty_num: 1, qty_den: 2, party_id: ME },
        { key: 'BF', qty_num: 1, qty_den: 1, guest_type: 'child', party_id: ME },
      ],
    };
    const c = claimFromServerTicket(stored, specs);
    assert.equal(c.name, 'Me');
    assert.equal(c.partyId, ME);
    assert.equal(c.rows.L1!.qtyWhole, '2');
    assert.equal(c.rows.L2!.qtyNum, '1');
    assert.equal(c.rows.L2!.qtyDen, '2');
    assert.equal(c.rows.BF!.childQty, '1');
  });

  it('drops rows of dishes that left the bill', () => {
    const c = withQty(withQty(claim('Me'), specs[0]!, { qtyWhole: '1' }), specs[1]!, { qtyWhole: '1' });
    const pruned = pruneClaimRows(c, [specs[0]!]);
    assert.deepEqual(Object.keys(pruned.rows), ['L1']);
  });
});

describe('local draft parse', () => {
  afterEach(() => undefined);
  it('round-trips a valid draft and rejects malformed ones', () => {
    const c = withQty(claim('Me'), specs[0]!, { qtyWhole: '2' });
    const raw = JSON.stringify({ ...c, v: 1, updatedAt: 1 });
    assert.deepEqual(parseGuestClaimDraft(raw), c);
    assert.equal(parseGuestClaimDraft('nope'), null);
    assert.equal(parseGuestClaimDraft(JSON.stringify({ ...c, v: 2 })), null);
    assert.equal(parseGuestClaimDraft(JSON.stringify({ ...c, v: 1, partyId: '' })), null);
  });
});
