import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import {
  buildByItemAllocationsFromPersons,
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  byItemLinePriceShare,
  calcByItemSplitResults,
  consumersForLineFromPersons,
  getBuffetLineStatusFromRows,
  getBuffetLineStatusFromShares,
  getByItemLineStatusFromRows,
  getByItemLineStatusFromShares,
  locateByItemSplitResult,
  parseConsumerRows,
  rationalToRowQtyFields,
  resolveBuffetRowCounts,
  shareQtyLabel,
  validateQtyParts,
  withDefaultByItemLineRows,
} from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import { validateBillSplit } from './bill-split-validate';

const PARTY_A = '11111111-1111-4111-8111-111111111111';
const PARTY_B = '22222222-2222-4222-8222-222222222222';

function row(
  id: string,
  name: string,
  qty: { whole?: string; num?: string; den?: string },
): ByItemConsumerRow {
  return {
    id,
    name,
    qtyWhole: qty.whole ?? '',
    qtyNum: qty.num ?? '',
    qtyDen: qty.den ?? '',
  };
}

function buffetRow(
  id: string,
  name: string,
  adultQty: string,
  childQty = '',
): ByItemConsumerRow {
  return { ...row(id, name, {}), adultQty, childQty };
}

function menuSpec(key: string, lineQty: number, unitPrice = 2): ByItemLineSpec {
  return {
    mode: 'menu',
    key,
    lineQty,
    lineTotal: lineQty * unitPrice,
    unitPrice,
  };
}

function buffetSpec(
  key: string,
  adults: number,
  children: number,
  adultUnitPrice = 15,
  childUnitPrice = 8,
): ByItemLineSpec {
  return {
    mode: 'buffet',
    key,
    lineTotal: adults * adultUnitPrice + children * childUnitPrice,
    adults,
    children,
    adultUnitPrice,
    childUnitPrice,
  };
}

describe('validateQtyParts', () => {
  it('composes whole and fraction without symbols', () => {
    const mixed = validateQtyParts({ whole: '2', num: '1', den: '3' });
    assert.equal(mixed.ok, true);
    if (mixed.ok) assert.equal(shareQtyLabel(mixed.qty), '2 1/3');
  });
});

describe('withDefaultByItemLineRows', () => {
  it('seeds buffet rows with default adult qty 1', () => {
    const next = withDefaultByItemLineRows({}, [buffetSpec('buffet-0', 2, 0)]);
    assert.equal(next['buffet-0']?.[0]?.adultQty, '1');
  });

  it('seeds menu rows with default whole qty 1', () => {
    const next = withDefaultByItemLineRows({}, [menuSpec('water', 1)]);
    assert.equal(next['water']?.[0]?.qtyWhole, '1');
  });
});

describe('rationalToRowQtyFields', () => {
  it('maps whole, fraction and mixed quantities to the qty input fields', () => {
    assert.deepEqual(rationalToRowQtyFields({ num: 2, den: 1 }), {
      qtyWhole: '2',
      qtyNum: '',
      qtyDen: '',
    });
    assert.deepEqual(rationalToRowQtyFields({ num: 2, den: 3 }), {
      qtyWhole: '',
      qtyNum: '2',
      qtyDen: '3',
    });
    assert.deepEqual(rationalToRowQtyFields({ num: 5, den: 2 }), {
      qtyWhole: '2',
      qtyNum: '1',
      qtyDen: '2',
    });
  });
});

describe('buffet by-item', () => {
  it('defaults name-only row to 1 adult', () => {
    const counts = resolveBuffetRowCounts(buffetRow('1', 'John', '', ''));
    assert.deepEqual(counts, { adults: 1, children: 0 });
  });

  it('lets one payer cover multiple adult and child heads', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const status = getBuffetLineStatusFromRows([buffetRow('1', 'John', '2', '1')], spec);
    assert.equal(status.kind, 'complete');
  });

  it('prices buffet by headcount per payer', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'buffet-0': [buffetRow('1', 'John', '2', '1')],
    });
    const results = calcByItemSplitResults({
      lines: [{
        key: 'buffet-0',
        name: 'Lunch Buffet',
        mode: 'buffet',
        adults: 2,
        children: 1,
        adultUnitPrice: 15,
        childUnitPrice: 8,
      }],
      allocations,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'John');
    assert.equal(results[0]?.amount, 38);
  });

  it('includes incomplete line shares priced unit×qty for mid-split collect', () => {
    const menu = menuSpec('oj', 2);
    const buffet = buffetSpec('buffet-0', 2, 0);
    const allocations = buildByItemAllocationsFromRows([menu, buffet], {
      oj: [row('1', 'John', { whole: '1' })],
      'buffet-0': [buffetRow('2', 'John', '1', '')],
    });
    const results = calcByItemSplitResults({
      lines: [
        { key: 'oj', name: 'OJ', mode: 'menu', qty: 2, unitPrice: 3.5 },
        {
          key: 'buffet-0',
          name: 'Buffet',
          mode: 'buffet',
          adults: 2,
          children: 0,
          adultUnitPrice: 28.15,
          childUnitPrice: 0,
        },
      ],
      allocations,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'John');
    assert.equal(results[0]?.amount, 3.5 + 28.15);
    const located = locateByItemSplitResult(results, 'John');
    assert.equal(located?.index, 0);
    assert.equal(located?.row.amount, 31.65);
  });

  it('shows short status with progress counts', () => {
    const partial = getBuffetLineStatusFromRows([buffetRow('1', 'John', '1', '')], { adults: 2, children: 0 });
    assert.equal(partial.kind, 'buffet_short');
  });
});

describe('getByItemLineStatus', () => {
  it('marks a fully allocated menu line complete', () => {
    const spec = menuSpec('line', 3.5);
    const status = getByItemLineStatusFromRows(
      [row('1', 'John', { num: '1', den: '2' }), row('2', 'Jimmy', { whole: '3' })],
      spec,
    );
    assert.equal(status.kind, 'complete');
  });
});

describe('fraction unit on the wire', () => {
  const spec: ByItemLineSpec = { mode: 'menu', key: 'L1', lineQty: 2, lineTotal: 10, unitPrice: 5 };

  it('stores the cut on fractional shares only and reads it back', () => {
    const allocations = buildByItemAllocationsFromRows([spec], {
      L1: [
        { id: 'a', name: 'Ana', partyId: PARTY_A, qtyWhole: '', qtyNum: '1', qtyDen: '2', unitDen: 4 },
        { id: 'b', name: 'Joao', partyId: PARTY_B, qtyWhole: '1', qtyNum: '', qtyDen: '', unitDen: 4 },
      ],
    });
    const persons = buildSplitPersonsFromAllocations(allocations);
    const ana = persons.find((p) => p.name === 'Ana')!;
    const joao = persons.find((p) => p.name === 'Joao')!;
    assert.equal(ana.item_shares![0]!.qty_unit_den, 4);
    assert.equal(joao.item_shares![0]!.qty_unit_den, undefined);

    const back = buildByItemAllocationsFromPersons(persons, [spec]);
    assert.equal(back.L1!.find((share) => share.name === 'Ana')!.unitDen, 4);
    assert.equal(back.L1!.find((share) => share.name === 'Joao')!.unitDen, undefined);
  });

  it('ignores a stored unit outside 2..5', () => {
    const back = buildByItemAllocationsFromPersons(
      [{
        name: 'Ana',
        party_id: PARTY_A,
        item_shares: [{ key: 'L1', qty_num: 1, qty_den: 7, qty_unit_den: 7, party_id: PARTY_A }],
      }],
      [spec],
    );
    assert.equal(back.L1![0]!.unitDen, undefined);
  });
});

describe('consumersForLineFromPersons', () => {
  it('reads buffet shares with qty greater than 1', () => {
    const consumers = consumersForLineFromPersons(
      [{
        name: 'John',
        item_shares: [
          { key: 'buffet-0', qty_num: 2, qty_den: 1, guest_type: 'adult' },
          { key: 'buffet-0', qty_num: 1, qty_den: 1, guest_type: 'child' },
        ],
      }],
      'buffet-0',
      buffetSpec('buffet-0', 2, 1),
    );
    assert.equal(consumers.length, 2);
    assert.equal(shareQtyLabel(consumers[0]!.qty), '2');
    assert.equal(consumers[0]?.guestType, 'adult');
  });
});

describe('validateBillSplit by_item', () => {
  it('accepts buffet line fully assigned to one payer', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'buffet-0': [buffetRow('1', 'John', '2', '1')],
    });
    const results = calcByItemSplitResults({
      lines: [{ key: 'buffet-0', name: 'Buffet', mode: 'buffet', adults: 2, children: 1, adultUnitPrice: 15, childUnitPrice: 8 }],
      allocations,
    });
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 38,
      results,
      lineSpecs: [spec],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, true);
  });

  it('keeps same-name menu tickets distinct when party ids differ', () => {
    const status = getByItemLineStatusFromShares(menuSpec('water', 2), [
      { name: 'Alex', partyId: 'party-a', qty: { num: 1, den: 1 } },
      { name: 'Alex', partyId: 'party-b', qty: { num: 1, den: 1 } },
    ]);
    assert.equal(status.kind, 'complete');
  });

  it('rejects duplicate menu shares for the same party', () => {
    const status = getByItemLineStatusFromShares(menuSpec('water', 2), [
      { name: 'Alex', partyId: 'party-a', qty: { num: 1, den: 1 } },
      { name: 'Alex', partyId: 'party-a', qty: { num: 1, den: 1 } },
    ]);
    assert.equal(status.kind, 'duplicate_names');
  });

  it('rejects duplicate buffet shares for the same party and guest type', () => {
    const status = getBuffetLineStatusFromShares(buffetSpec('buffet-0', 2, 0), [
      { name: 'Alex', partyId: 'party-a', guestType: 'adult', qty: { num: 1, den: 1 } },
      { name: 'Alex', partyId: 'party-a', guestType: 'adult', qty: { num: 1, den: 1 } },
    ]);
    assert.equal(status.kind, 'duplicate_names');
  });

  it('accepts adult and child buffet shares for one party and same-name distinct tickets', () => {
    const status = getBuffetLineStatusFromShares(buffetSpec('buffet-0', 2, 1), [
      { name: 'Alex', partyId: 'party-a', guestType: 'adult', qty: { num: 1, den: 1 } },
      { name: 'Alex', partyId: 'party-a', guestType: 'child', qty: { num: 1, den: 1 } },
      { name: 'Alex', partyId: 'party-b', guestType: 'adult', qty: { num: 1, den: 1 } },
    ]);
    assert.equal(status.kind, 'complete');
  });
});

describe('byItemLinePriceShare', () => {
  it('distributes cents without losing the line total', () => {
    const shares = parseConsumerRows([
      row('1', 'tom', { whole: '2', num: '1', den: '3' }),
      row('2', 'jerry', { whole: '1', num: '1', den: '3' }),
      row('3', 'candy', { whole: '1', num: '1', den: '3' }),
    ]);
    const total = shares.reduce(
      (sum, share) => sum + byItemLinePriceShare(10, shares, share.name),
      0,
    );
    assert.equal(total, 10);
  });

  it('weights whole vs half by real qty (not equal nums)', () => {
    const shares = [
      { name: '客人 10', qty: { num: 1, den: 1 } },
      { name: '客人 11', qty: { num: 1, den: 2 } },
      { name: '客人 12', qty: { num: 1, den: 2 } },
    ];
    assert.deepEqual(
      shares.map((share) => byItemLinePriceShare(4.4, shares, share.name)),
      [2.2, 1.1, 1.1],
    );
  });
});

describe('calcByItemSplitResults cent remainder', () => {
  it('prices whole+half+half cola as 2.20+1.10+1.10', () => {
    const results = calcByItemSplitResults({
      lines: [{ key: 'cola', name: 'Cola', mode: 'menu', qty: 2, unitPrice: 2.2 }],
      allocations: {
        cola: [
          { name: '客人 10', qty: { num: 1, den: 1 } },
          { name: '客人 11', qty: { num: 1, den: 2 } },
          { name: '客人 12', qty: { num: 1, den: 2 } },
        ],
      },
    });
    assert.deepEqual(
      results.map((row) => ({ name: row.name, amount: row.amount })),
      [
        { name: '客人 10', amount: 2.2 },
        { name: '客人 11', amount: 1.1 },
        { name: '客人 12', amount: 1.1 },
      ],
    );
  });

  it('keeps 1.85×(1.5+1.5+1) water line at €7.40 not €7.41', () => {
    const results = calcByItemSplitResults({
      lines: [{ key: 'water', name: 'Water', mode: 'menu', qty: 4, unitPrice: 1.85 }],
      allocations: {
        water: [
          { name: '客人 9', qty: { num: 3, den: 2 } },
          { name: '客人 10', qty: { num: 3, den: 2 } },
          { name: '客人 11', qty: { num: 1, den: 1 } },
        ],
      },
    });
    assert.deepEqual(
      results.map((row) => ({ name: row.name, amount: row.amount })),
      [
        { name: '客人 9', amount: 2.77 },
        { name: '客人 10', amount: 2.78 },
        { name: '客人 11', amount: 1.85 },
      ],
    );
  });
});
