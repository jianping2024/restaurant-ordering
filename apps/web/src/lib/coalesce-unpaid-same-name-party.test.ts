import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  coalesceUnpaidSameNamePartyIds,
  createByItemConsumerRow,
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
