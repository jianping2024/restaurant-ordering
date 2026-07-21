import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveReceiptPrintSource } from './receipt-print-source';

describe('resolveReceiptPrintSource', () => {
  it('marks staff-authenticated prints as staff_manual', () => {
    assert.equal(resolveReceiptPrintSource(true), 'staff_manual');
  });

  it('marks guest / unauthenticated prints as automatic', () => {
    assert.equal(resolveReceiptPrintSource(false), 'automatic');
  });
});
