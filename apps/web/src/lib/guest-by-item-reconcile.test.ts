import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createByItemConsumerRow } from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import { reconcileGuestByItemAllocations } from './guest-by-item-reconcile';

function menuSpec(key: string, qty: number): ByItemLineSpec {
  return {
    mode: 'menu',
    key,
    lineQty: qty,
    lineTotal: qty * 10,
    unitPrice: 10,
  };
}

describe('reconcileGuestByItemAllocations', () => {
  it('keeps unpaid local edits when a new line appears', () => {
    const water = menuSpec('water', 1);
    const wine = menuSpec('wine', 1);
    const partyId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const prev = {
      water: [
        {
          ...createByItemConsumerRow(),
          name: 'LocalEdit',
          partyId,
          qtyWhole: '1',
        },
      ],
    };
    const serverRows = {
      water: [
        {
          ...createByItemConsumerRow(),
          name: 'ServerOld',
          partyId,
          qtyWhole: '1',
        },
      ],
    };
    const next = reconcileGuestByItemAllocations({
      prev,
      serverRows,
      lineSpecs: [water, wine],
      lockedTicketKeys: new Set(),
    });
    assert.equal(next.water?.[0]?.name, 'LocalEdit');
    assert.ok((next.wine?.length ?? 0) >= 1);
  });

  it('overwrites locked tickets from server while keeping other local unpaid', () => {
    const water = menuSpec('water', 2);
    const paidId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const unpaidId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const prev = {
      water: [
        {
          ...createByItemConsumerRow(),
          name: 'Paid',
          partyId: paidId,
          qtyWhole: '1',
          paidLocked: true,
          lockedAmount: 10,
        },
        {
          ...createByItemConsumerRow(),
          name: 'LocalUnpaid',
          partyId: unpaidId,
          qtyWhole: '1',
        },
      ],
    };
    const serverRows = {
      water: [
        {
          ...createByItemConsumerRow(),
          name: 'Paid',
          partyId: paidId,
          qtyWhole: '1',
          paidLocked: true,
          lockedAmount: 10,
        },
        {
          ...createByItemConsumerRow(),
          name: 'ServerUnpaid',
          partyId: unpaidId,
          qtyWhole: '1',
        },
      ],
    };
    const next = reconcileGuestByItemAllocations({
      prev,
      serverRows,
      lineSpecs: [water],
      lockedTicketKeys: new Set([paidId]),
    });
    const paid = next.water?.find((row) => row.partyId === paidId);
    const unpaid = next.water?.find((row) => row.partyId === unpaidId);
    assert.equal(paid?.paidLocked, true);
    assert.equal(unpaid?.name, 'LocalUnpaid');
  });
});
