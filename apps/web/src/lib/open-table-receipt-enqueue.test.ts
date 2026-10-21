import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPEN_TABLE_RECEIPT_VARIANT,
  openTableReceiptIdempotencyKey,
  openTableReceiptLineLabel,
} from './open-table-receipt-enqueue';

describe('open-table-receipt-enqueue', () => {
  it('uses one idempotency key per session', () => {
    assert.equal(openTableReceiptIdempotencyKey('sess-1'), 'session_open:sess-1');
  });

  it('uses one receipt_variant constant', () => {
    assert.equal(OPEN_TABLE_RECEIPT_VARIANT, 'open_table');
  });

  it('picks print_locale line label', () => {
    assert.equal(openTableReceiptLineLabel('zh'), '开台');
    assert.equal(openTableReceiptLineLabel('en'), 'Open table');
    assert.equal(openTableReceiptLineLabel('pt'), 'Abrir mesa');
  });
});
