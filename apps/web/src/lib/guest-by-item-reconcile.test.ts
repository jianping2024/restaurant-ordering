import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createByItemConsumerRow } from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import {
  reconcileGuestByItemAllocations,
  restoreGuestByItemLocalDraft,
} from './guest-by-item-reconcile';
import { splitPartyKey } from './split-party-id';

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

describe('restoreGuestByItemLocalDraft', () => {
  const anaId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const biaId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const paidId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const row = (name: string, partyId: string, extra: Partial<ReturnType<typeof createByItemConsumerRow>> = {}) => ({
    ...createByItemConsumerRow(),
    name,
    partyId,
    qtyWhole: '1',
    ...extra,
  });

  it('keeps local unpaid edits made after checkout → resume (server has unpaid shares)', () => {
    const cola = menuSpec('cola', 1);
    const wine = menuSpec('wine', 1);
    const next = restoreGuestByItemLocalDraft({
      localRows: { cola: [row('Ana', anaId)], wine: [row('Bia', biaId)] },
      serverRows: { cola: [row('Ana', anaId)] },
      lineSpecs: [cola, wine],
      lockedTicketKeys: new Set(),
    });
    assert.deepEqual(next.cola?.map((r) => r.name), ['Ana']);
    assert.deepEqual(next.wine?.map((r) => r.name), ['Bia']);
  });

  it('does not re-add a server unpaid share the guest removed locally', () => {
    const cola = menuSpec('cola', 1);
    const next = restoreGuestByItemLocalDraft({
      localRows: { cola: [row('Bia', biaId)] },
      serverRows: { cola: [row('Ana', anaId)] },
      lineSpecs: [cola],
      lockedTicketKeys: new Set(),
    });
    assert.deepEqual(next.cola?.map((r) => r.name), ['Bia']);
  });

  it('server-locked rows overlay the local draft', () => {
    const water = menuSpec('water', 2);
    const next = restoreGuestByItemLocalDraft({
      localRows: { water: [row('PaidRenamedLocally', paidId), row('Bia', biaId)] },
      serverRows: { water: [row('Paid', paidId, { paidLocked: true })] },
      lineSpecs: [water],
      lockedTicketKeys: new Set([splitPartyKey(paidId, 'Paid')]),
    });
    const names = next.water?.map((r) => r.name) ?? [];
    assert.ok(names.includes('Paid'));
    assert.ok(names.includes('Bia'));
    assert.ok(!names.includes('PaidRenamedLocally'));
  });
});
