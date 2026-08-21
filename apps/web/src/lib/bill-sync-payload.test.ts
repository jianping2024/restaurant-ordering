import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBillSyncLine,
  findBillSyncItemCodeConflict,
  formatBillSyncVatRate,
  isValidBillSyncVatRateString,
  validateBillSyncPayload,
  type BillSyncPayload,
} from './bill-sync-payload';

describe('formatBillSyncVatRate', () => {
  it('formats percent points with two decimals', () => {
    assert.equal(formatBillSyncVatRate(13), '13.00');
    assert.equal(formatBillSyncVatRate(23), '23.00');
  });
});

describe('isValidBillSyncVatRateString', () => {
  it('accepts 13.00 style and rejects fraction style', () => {
    assert.equal(isValidBillSyncVatRateString('13.00'), true);
    assert.equal(isValidBillSyncVatRateString('0.23'), false);
    assert.equal(isValidBillSyncVatRateString('23'), false);
  });
});

describe('findBillSyncItemCodeConflict', () => {
  it('detects same code with different price', () => {
    const conflict = findBillSyncItemCodeConflict([
      {
        item_code: 'A',
        name: 'X',
        qty: '1.00',
        unit_price_gross: '1.00',
        line_gross: '1.00',
        vat_rate: '23.00',
      },
      {
        item_code: 'A',
        name: 'X',
        qty: '1.00',
        unit_price_gross: '2.00',
        line_gross: '2.00',
        vat_rate: '23.00',
      },
    ]);
    assert.equal(conflict?.item_code, 'A');
  });
});

describe('validateBillSyncPayload', () => {
  it('accepts a minimal whole_table payload', () => {
    const line = buildBillSyncLine({
      item_code: '006',
      name: 'Beer',
      qty: 1,
      unit_price_gross: 2.25,
      line_gross: 2.25,
      vat_rate_percent: 23,
    });
    assert.ok(!('error' in line));
    const payload: BillSyncPayload = {
      request_id: '11111111-1111-1111-1111-111111111111',
      source_system: 'farvoo',
      source_sale_id: '22222222-2222-2222-2222-222222222222',
      table_display_name: '018',
      scope_type: 'whole_table',
      lines: [line],
      gross_total: '2.25',
    };
    assert.equal(validateBillSyncPayload(payload), null);
  });
});
