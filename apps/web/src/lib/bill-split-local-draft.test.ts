import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseBillSplitLocalDraft,
  shouldRestoreBillSplitLocalDraft,
} from './bill-split-local-draft';
import type { BillSplit } from '../types';

describe('parseBillSplitLocalDraft', () => {
  it('accepts a valid v1 draft', () => {
    const raw = JSON.stringify({
      v: 1,
      splitMode: 'by_item',
      personCount: 3,
      splitPeople: [{ id: 'p1', name: 'A' }],
      customAmounts: [{ name: 'A', amount: 4.5 }],
      byItemAllocations: {
        'o1-0': [{ id: 'r1', name: 'A', qtyWhole: '1', qtyNum: '', qtyDen: '' }],
      },
      updatedAt: 1,
    });
    const draft = parseBillSplitLocalDraft(raw);
    assert.ok(draft);
    assert.equal(draft.splitMode, 'by_item');
    assert.equal(draft.personCount, 3);
    assert.equal(draft.byItemAllocations['o1-0']?.[0]?.name, 'A');
  });

  it('rejects unknown version or bad rows', () => {
    assert.equal(parseBillSplitLocalDraft(JSON.stringify({ v: 2, splitMode: null })), null);
    assert.equal(
      parseBillSplitLocalDraft(
        JSON.stringify({
          v: 1,
          splitMode: 'even',
          personCount: 2,
          splitPeople: [{ id: 'p1' }],
          customAmounts: [],
          byItemAllocations: {},
          updatedAt: 1,
        }),
      ),
      null,
    );
  });
});

describe('shouldRestoreBillSplitLocalDraft', () => {
  it('restores when there is no server split yet', () => {
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: null,
        submitted: false,
        collectedPaymentCount: 0,
      }),
      true,
    );
  });

  it('blocks restore after submit, request, pay, or collected rows', () => {
    const requested = { status: 'requested' } as BillSplit;
    const paid = { status: 'paid' } as BillSplit;
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: null,
        submitted: true,
        collectedPaymentCount: 0,
      }),
      false,
    );
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: requested,
        submitted: false,
        collectedPaymentCount: 0,
      }),
      false,
    );
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: paid,
        submitted: false,
        collectedPaymentCount: 0,
      }),
      false,
    );
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: { status: 'confirmed' } as BillSplit,
        submitted: false,
        collectedPaymentCount: 1,
      }),
      false,
    );
  });

  it('allows restore for confirmed resume with no collections', () => {
    assert.equal(
      shouldRestoreBillSplitLocalDraft({
        existingSplit: { status: 'confirmed' } as BillSplit,
        submitted: false,
        collectedPaymentCount: 0,
      }),
      true,
    );
  });
});
