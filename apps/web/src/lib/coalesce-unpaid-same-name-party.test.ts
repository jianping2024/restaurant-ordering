import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  coalesceUnpaidSameNamePartyIds,
  createByItemConsumerRow,
  getByItemLineStatusFromRows,
  normalizeByItemDraftPartyIds,
  type ByItemConsumerRow,
} from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import { mintSplitPartyId, splitPartyKey } from './split-party-id';

const menuSpec = (key: string, lineQty = 1): ByItemLineSpec => ({
  key,
  mode: 'menu',
  lineQty,
  unitPrice: 2.5,
  name: key,
});

function namedRow(
  name: string,
  partyId: string,
  qtyWhole = '1',
  extra?: Partial<ByItemConsumerRow>,
): ByItemConsumerRow {
  return {
    ...createByItemConsumerRow({ seed: true }),
    name,
    partyId,
    qtyWhole,
    ...extra,
  };
}

describe('coalesceUnpaidSameNamePartyIds', () => {
  it('merges unpaid same display name onto first party_id across lines', () => {
    const tomA = mintSplitPartyId();
    const tomB = mintSplitPartyId();
    const kate = mintSplitPartyId();
    const input = {
      'line-a': [namedRow('Tom', tomA), namedRow('Kate', kate)],
      'line-b': [namedRow('Tom', tomB, '2')],
    };
    const out = coalesceUnpaidSameNamePartyIds(input);
    assert.equal(out['line-a']![0]!.partyId, tomA);
    assert.equal(out['line-b']![0]!.partyId, tomA);
    assert.equal(out['line-a']![1]!.partyId, kate);
    assert.notEqual(out, input);
  });

  it('does not merge unpaid shares into a locked same-name ticket', () => {
    const paidTom = mintSplitPartyId();
    const unpaidTom = mintSplitPartyId();
    const locked = new Set([splitPartyKey(paidTom, 'Tom')]);
    const input = {
      'line-a': [namedRow('Tom', paidTom, '1', { paidLocked: true, lockedAmount: 10 })],
      'line-b': [namedRow('Tom', unpaidTom, '1')],
    };
    const out = coalesceUnpaidSameNamePartyIds(input, locked);
    assert.equal(out['line-a']![0]!.partyId, paidTom);
    assert.equal(out['line-b']![0]!.partyId, unpaidTom);
    assert.equal(out, input);
  });

  it('is a no-op when already coalesced (same reference)', () => {
    const tom = mintSplitPartyId();
    const input = {
      'line-a': [namedRow('Tom', tom)],
      'line-b': [namedRow('Tom', tom, '2')],
    };
    const out = coalesceUnpaidSameNamePartyIds(input);
    assert.equal(out, input);
  });

  it('submit wire collapses coalesced rows to one person with multi shares', () => {
    const tomA = mintSplitPartyId();
    const tomB = mintSplitPartyId();
    const specs = [menuSpec('line-a'), menuSpec('line-b', 2)];
    const rows = coalesceUnpaidSameNamePartyIds({
      'line-a': [namedRow('Tom', tomA)],
      'line-b': [namedRow('Tom', tomB, '2')],
    });
    const persons = buildSplitPersonsFromAllocations(
      buildByItemAllocationsFromRows(specs, rows),
    );
    assert.equal(persons.length, 1);
    assert.equal(persons[0]!.name, 'Tom');
    assert.equal(persons[0]!.party_id, tomA);
    assert.equal(persons[0]!.item_shares?.length, 2);
  });
});

describe('normalizeByItemDraftPartyIds', () => {
  it('keeps same-name duplicate rows on one dish sharing a party id', () => {
    const tom = mintSplitPartyId();
    const input = {
      water: [namedRow('Tom', tom, '1'), namedRow('Tom', tom, '1')],
    };
    const out = normalizeByItemDraftPartyIds(input);
    assert.equal(out.water![0]!.partyId, tom);
    assert.equal(out.water![1]!.partyId, tom);
    assert.equal(
      getByItemLineStatusFromRows(out.water!, menuSpec('water', 2)).kind,
      'duplicate_names',
    );
  });

  it('mints a new party id when a coalesced twin is renamed on the same dish', () => {
    const shared = mintSplitPartyId();
    const input = {
      water: [namedRow('Tom', shared, '3'), namedRow('Kate', shared, '2')],
    };
    const out = normalizeByItemDraftPartyIds(input);
    assert.equal(out.water![0]!.partyId, shared);
    assert.notEqual(out.water![1]!.partyId, shared);
    assert.equal(out.water![1]!.name, 'Kate');
    assert.equal(
      getByItemLineStatusFromRows(out.water!, menuSpec('water', 5)).kind,
      'complete',
    );
  });

  it('still coalesces unpaid same name across dishes after normalize', () => {
    const tomA = mintSplitPartyId();
    const tomB = mintSplitPartyId();
    const out = normalizeByItemDraftPartyIds({
      'line-a': [namedRow('Tom', tomA)],
      'line-b': [namedRow('Tom', tomB, '2')],
    });
    assert.equal(out['line-a']![0]!.partyId, tomA);
    assert.equal(out['line-b']![0]!.partyId, tomA);
  });

  it('does not remint a locked ticket when an unlocked divergent name collides', () => {
    const paid = mintSplitPartyId();
    const locked = new Set([splitPartyKey(paid, 'Tom')]);
    const input = {
      water: [
        namedRow('Tom', paid, '1', { paidLocked: true, lockedAmount: 2.5 }),
        namedRow('Kate', paid, '1'),
      ],
    };
    const out = normalizeByItemDraftPartyIds(input, locked);
    assert.equal(out.water![0]!.partyId, paid);
    assert.notEqual(out.water![1]!.partyId, paid);
  });
});
