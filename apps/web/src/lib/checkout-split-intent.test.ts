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
  resolveWholeTablePartyIdFromSplit,
  wholeTableSplitResult,
} from './checkout-split-intent';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';

describe('checkout-split-intent', () => {
  it('maps null draft mode to whole_table intent', () => {
    assert.equal(checkoutIntentFromDraftSplitMode(null), 'whole_table');
  });

  it('builds whole-table payload with stable payer key and party_id', () => {
    const payload = buildWholeTableCheckoutPayload(42.5);
    assert.equal(payload.splitMode, 'whole_table');
    assert.equal(payload.persons[0]?.name, WHOLE_TABLE_PAYER_KEY);
    assert.equal(payload.result[0]?.name, WHOLE_TABLE_PAYER_KEY);
    assert.equal(payload.result[0]?.amount, 42.5);
    assert.equal(payload.persons[0]?.party_id, payload.result[0]?.party_id);
    assert.match(payload.result[0]?.party_id ?? '', /^[0-9a-f-]{36}$/i);
    assert.equal(payload.customerNif, null);
  });

  it('stamps whole_table amount from authoritative total, not client placeholder', () => {
    const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const stamped = normalizeCheckoutRequestPayload(
      {
        splitMode: 'whole_table',
        persons: [{ name: WHOLE_TABLE_PAYER_KEY, party_id: existingId }],
        result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 0, party_id: existingId }],
        customerNif: '123456789',
      },
      { authoritativeWholeTableTotal: 56.45 },
    );
    assert.equal(stamped.splitMode, 'whole_table');
    assert.equal(stamped.result[0]?.amount, 56.45);
    assert.equal(stamped.result[0]?.party_id, existingId);
    assert.equal(stamped.persons[0]?.party_id, existingId);
    assert.equal(stamped.customerNif, '123456789');
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
    assert.equal(isShapeLockSplitMode('by_item'), false);
  });

  it('builds whole-table result rows for draft compute', () => {
    const held = '44444444-4444-4444-8444-444444444444';
    const rows = wholeTableSplitResult(12.5, held);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, WHOLE_TABLE_PAYER_KEY);
    assert.equal(rows[0]?.amount, 12.5);
    assert.equal(rows[0]?.party_id, held);
  });

  it('reads whole-table party_id from plan result then persons', () => {
    const id = '55555555-5555-4555-8555-555555555555';
    assert.equal(
      resolveWholeTablePartyIdFromSplit({
        split_mode: 'whole_table',
        result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 10, party_id: id }],
        persons: [{ name: WHOLE_TABLE_PAYER_KEY }],
      }),
      id,
    );
    assert.equal(
      resolveWholeTablePartyIdFromSplit({
        split_mode: 'whole_table',
        result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 10 }],
        persons: [{ name: WHOLE_TABLE_PAYER_KEY, party_id: id }],
      }),
      id,
    );
    assert.equal(
      resolveWholeTablePartyIdFromSplit({
        split_mode: 'even',
        result: [
          { name: 'A', amount: 5, party_id: id },
          { name: 'B', amount: 5 },
        ],
        persons: [],
      }),
      undefined,
    );
  });

  it('detects whole_table by mode and legacy row shape', () => {
    assert.equal(
      isWholeTableSplit({ split_mode: 'whole_table', result: [{ name: WHOLE_TABLE_PAYER_KEY, amount: 1 }] }),
      true,
    );
    assert.equal(
      isWholeTableSplit({ split_mode: 'even', result: [{ name: 'Total', amount: 1 }] }),
      true,
    );
    assert.equal(
      isWholeTableSplit({
        split_mode: 'even',
        result: [
          { name: 'A', amount: 5 },
          { name: 'B', amount: 5 },
        ],
      }),
      false,
    );
  });
});
