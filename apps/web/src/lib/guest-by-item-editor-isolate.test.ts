import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { appendByItemConsumerRow, createByItemConsumerRow } from './bill-split-by-item';
import { extractByItemDraftAllocations } from './by-item-committed-draft';
import type { ByItemLineSpec } from './bill-split-by-item-lines';

const menuSpec: ByItemLineSpec = {
  key: 'line-a',
  mode: 'menu',
  lineQty: 2,
  lineTotal: 20,
  unitPrice: 10,
};

describe('guest vs staff by-item editor isolation (contract)', () => {
  it('staff extract still drops unnamed slots (staff dual-layer unchanged)', () => {
    const named = { ...createByItemConsumerRow(), name: 'A', qtyWhole: '1' };
    const unnamed = createByItemConsumerRow();
    const draft = extractByItemDraftAllocations(
      { 'line-a': [named, unnamed] },
      new Set(),
    );
    assert.equal(draft['line-a']?.length, 1);
    assert.equal(draft['line-a']?.[0]?.name, 'A');
  });

  it('guest working map keeps appendByItemConsumerRow unnamed slot (no extract)', () => {
    const seed = createByItemConsumerRow({ seed: true });
    seed.name = 'A';
    seed.qtyWhole = '1';
    const next = appendByItemConsumerRow([seed], menuSpec);
    assert.equal(next.length, 2);
    assert.equal(next[1]?.name.trim(), '');
    // Guest editor stores this array directly — staff extract must not be applied.
    const staffWouldDrop = extractByItemDraftAllocations({ 'line-a': next }, new Set());
    assert.equal(staffWouldDrop['line-a']?.length, 1, 'documents why guest cannot share staff extract');
  });

  it('guest hook module does not import staff dual-layer helpers', () => {
    const src = readFileSync(new URL('./use-guest-by-item-split-state.ts', import.meta.url), 'utf8');
    assert.equal(src.includes('by-item-committed-draft'), false);
    assert.equal(src.includes('extractByItemDraftAllocations'), false);
    assert.equal(src.includes('useByItemSplitState'), false);
  });

  it('BillPage wires guest editor; staff checkout wires staff editor', () => {
    const bill = readFileSync(
      new URL('../components/menu/BillPage.tsx', import.meta.url),
      'utf8',
    );
    const staff = readFileSync(
      new URL('../components/dashboard/checkout/StaffCheckoutSplitEditor.tsx', import.meta.url),
      'utf8',
    );
    assert.match(bill, /byItemEditor:\s*'guest'/);
    assert.match(staff, /byItemEditor:\s*'staff'/);
    assert.equal(bill.includes("byItemEditor: 'staff'"), false);
    assert.equal(staff.includes("byItemEditor: 'guest'"), false);
  });
});
