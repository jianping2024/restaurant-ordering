import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billSplitDraftAuthorityKey,
  billSplitLocalDraftOwnerKey,
  mayPersistBillSplitLocalDraft,
  parseBillSplitLocalDraft,
  resolveBillSplitDraftHydrateAction,
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

  it('clamps custom personCount to min 1 without forcing 2', () => {
    const raw = JSON.stringify({
      v: 1,
      splitMode: 'custom',
      personCount: 1,
      splitPeople: [{ id: 'p1', name: 'A' }],
      customAmounts: [{ name: 'A', amount: 0 }],
      byItemAllocations: {},
      updatedAt: 1,
    });
    const draft = parseBillSplitLocalDraft(raw);
    assert.ok(draft);
    assert.equal(draft.personCount, 1);
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

describe('mayPersistBillSplitLocalDraft', () => {
  it('allows save only for the hydrated session owner key', () => {
    const owner = billSplitLocalDraftOwnerKey('r1', 's-new');
    assert.equal(
      mayPersistBillSplitLocalDraft({
        hydratedOwnerKey: owner,
        restaurantId: 'r1',
        sessionId: 's-new',
      }),
      true,
    );
    assert.equal(
      mayPersistBillSplitLocalDraft({
        hydratedOwnerKey: billSplitLocalDraftOwnerKey('r1', 's-old'),
        restaurantId: 'r1',
        sessionId: 's-new',
      }),
      false,
    );
    assert.equal(
      mayPersistBillSplitLocalDraft({
        hydratedOwnerKey: null,
        restaurantId: 'r1',
        sessionId: 's-new',
      }),
      false,
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

describe('billSplitDraftAuthorityKey', () => {
  it('changes when whole_table requested becomes even confirmed with collections', () => {
    const wholeRequested = {
      id: 'bs1',
      status: 'requested',
      split_mode: 'whole_table',
      result: [{ name: '__whole_table__', amount: 40 }],
      persons: [{ name: '__whole_table__' }],
    } as BillSplit;
    const evenConfirmed = {
      id: 'bs1',
      status: 'confirmed',
      split_mode: 'even',
      result: [
        { name: 'Alice', amount: 20, paid: true },
        { name: 'Bob', amount: 20, paid: false },
      ],
      persons: [{ name: 'Alice' }, { name: 'Bob' }],
    } as BillSplit;
    const before = billSplitDraftAuthorityKey({
      existingSplit: wholeRequested,
      submitted: true,
      collectedPaymentCount: 0,
    });
    const after = billSplitDraftAuthorityKey({
      existingSplit: evenConfirmed,
      submitted: false,
      collectedPaymentCount: 1,
    });
    assert.notEqual(before, after);
  });

  it('is stable for identical server truth', () => {
    const split = {
      id: 'bs1',
      status: 'confirmed',
      split_mode: 'custom',
      result: [{ name: 'A', amount: 10, paid: false }],
      persons: [{ name: 'A' }],
    } as BillSplit;
    assert.equal(
      billSplitDraftAuthorityKey({
        existingSplit: split,
        submitted: false,
        collectedPaymentCount: 0,
      }),
      billSplitDraftAuthorityKey({
        existingSplit: { ...split },
        submitted: false,
        collectedPaymentCount: 0,
      }),
    );
  });
});

describe('resolveBillSplitDraftHydrateAction', () => {
  it('reseeds from server when authority changes after submit (resume continuation)', () => {
    assert.equal(
      resolveBillSplitDraftHydrateAction({
        sessionId: 's1',
        appliedAuthorityKey: 'old-whole-table',
        authorityKey: 'new-even-partial',
        canRestore: false,
      }),
      'apply_server',
    );
  });

  it('keeps memory when authority is unchanged', () => {
    assert.equal(
      resolveBillSplitDraftHydrateAction({
        sessionId: 's1',
        appliedAuthorityKey: 'same',
        authorityKey: 'same',
        canRestore: false,
      }),
      'noop',
    );
  });

  it('allows local draft only while canRestore and authority is new', () => {
    assert.equal(
      resolveBillSplitDraftHydrateAction({
        sessionId: 's1',
        appliedAuthorityKey: null,
        authorityKey: 'fresh',
        canRestore: true,
      }),
      'apply_local_or_server',
    );
  });

  it('resets when session is gone', () => {
    assert.equal(
      resolveBillSplitDraftHydrateAction({
        sessionId: null,
        appliedAuthorityKey: 'x',
        authorityKey: 'y',
        canRestore: true,
      }),
      'reset_no_session',
    );
  });
});
