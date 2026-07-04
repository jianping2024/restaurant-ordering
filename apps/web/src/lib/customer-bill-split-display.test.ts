import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billSplitDisplayResults,
  initialPersistedSplitResult,
} from './customer-bill-split-display';

describe('billSplitDisplayResults', () => {
  const draft = [
    { name: 'Ana', amount: 126.35 },
    { name: 'Tom', amount: 124.5 },
  ];
  const persisted = [
    { name: 'Ana', amount: 25.45, paid: true },
    { name: 'Tom', amount: 71.9 },
  ];

  it('uses draft while checkout is editable', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: false,
        persistedResult: persisted,
        draftResults: draft,
      }),
      draft,
    );
  });

  it('uses persisted snapshot on submitted success screen', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: true,
        persistedResult: persisted,
        draftResults: draft,
      }),
      persisted,
    );
  });

  it('falls back to draft when submitted but persisted is empty', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: true,
        persistedResult: null,
        draftResults: draft,
      }),
      draft,
    );
  });
});

describe('initialPersistedSplitResult', () => {
  it('returns null during continuation editing', () => {
    assert.equal(
      initialPersistedSplitResult(
        [{ name: 'Ana', amount: 25.45, paid: true }],
        false,
      ),
      null,
    );
  });

  it('hydrates snapshot for submitted success screen', () => {
    const rows = [{ name: 'Ana', amount: 25.45, paid: true }];
    assert.deepEqual(initialPersistedSplitResult(rows, true), rows);
  });
});
