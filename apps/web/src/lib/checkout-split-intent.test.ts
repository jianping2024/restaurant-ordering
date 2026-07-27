import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWholeTableCheckoutPayload,
  checkoutIntentFromDraftSplitMode,
  isShapeLockSplitMode,
  isWholeTableSplit,
  normalizeCheckoutRequestPayload,
  parseSplitMode,
  resolvePersistedSplitModeForDraft,
  wholeTableSplitResult,
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

  it('parses known split modes', () => {
    assert.equal(parseSplitMode('whole_table'), 'whole_table');
    assert.equal(parseSplitMode('even'), 'even');
    assert.equal(parseSplitMode('invalid'), null);
  });

  it('identifies shape-lock modes after partial collection', () => {
    assert.equal(isShapeLockSplitMode('whole_table'), true);
    assert.equal(isShapeLockSplitMode('even'), true);
    assert.equal(isShapeLockSplitMode('custom'), true);
    assert.equal(isShapeLockSplitMode('by_item'), false);
  });

  it('builds whole-table result rows for draft compute', () => {
    assert.deepEqual(wholeTableSplitResult(12.5), [{ name: WHOLE_TABLE_PAYER_KEY, amount: 12.5 }]);
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
