import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWholeTableCheckoutPayload,
  checkoutIntentFromDraftSplitMode,
  isWholeTableSplit,
  normalizeCheckoutRequestPayload,
  resolvePersistedSplitModeForDraft,
} from './checkout-split-intent';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';

describe('checkout-split-intent', () => {
  it('maps null draft mode to whole_table intent', () => {
    assert.equal(checkoutIntentFromDraftSplitMode(null), 'whole_table');
  });

  it('builds whole-table payload with stable payer key', () => {
    assert.deepEqual(buildWholeTableCheckoutPayload(42.5), {
      splitMode: 'whole_table',
      persons: [{ name: WHOLE_TABLE_PAYER_KEY }],
      result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 42.5 }],
      customerNif: null,
    });
  });

  it('normalizes legacy custom single Total row', () => {
    const normalized = normalizeCheckoutRequestPayload({
      splitMode: 'custom',
      persons: [{ name: 'Total' }],
      result: [{ name: 'Total', amount: 10 }],
    });
    assert.equal(normalized.splitMode, 'whole_table');
    assert.equal(normalized.result[0]?.name, WHOLE_TABLE_PAYER_KEY);
  });

  it('treats persisted whole_table as no draft split mode', () => {
    assert.equal(
      resolvePersistedSplitModeForDraft({
        split_mode: 'whole_table',
        result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 10 }],
      } as never),
      null,
    );
  });

  it('detects whole_table by mode and legacy row shape', () => {
    assert.equal(
      isWholeTableSplit({ split_mode: 'whole_table', result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 1 }] }),
      true,
    );
    assert.equal(
      isWholeTableSplit({ split_mode: 'custom', result: [{ name: 'Total', amount: 1 }] }),
      true,
    );
    assert.equal(
      isWholeTableSplit({
        split_mode: 'custom',
        result: [
          { name: 'A', amount: 5 },
          { name: 'B', amount: 5 },
        ],
      }),
      false,
    );
  });
});
