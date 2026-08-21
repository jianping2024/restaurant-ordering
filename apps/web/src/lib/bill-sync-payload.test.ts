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

  it('accepts split payload and rejects top-level lines/gross', () => {
    const line = buildBillSyncLine({
      item_code: '006',
      name: 'Beer',
      qty: 1,
      unit_price_gross: 2.25,
      line_gross: 2.25,
      vat_rate_percent: 23,
    });
    assert.ok(!('error' in line));
    const ok: BillSyncPayload = {
      request_id: '11111111-1111-1111-1111-111111111111',
      source_system: 'farvoo',
      source_sale_id: '22222222-2222-2222-2222-222222222222',
      table_display_name: '018',
      scope_type: 'split',
      splits: [
        {
          scope_id: '33333333-3333-4333-8333-333333333333',
          name: 'Ana',
          lines: [line],
          gross_total: '2.25',
        },
      ],
    };
    assert.equal(validateBillSyncPayload(ok), null);
    assert.equal(
      validateBillSyncPayload({ ...ok, lines: [line] }),
      'scope_payload_mismatch',
    );
    assert.equal(
      validateBillSyncPayload({ ...ok, gross_total: '2.25' }),
      'scope_payload_mismatch',
    );
    assert.equal(
      validateBillSyncPayload({
        ...ok,
        splits: [{ ...ok.splits![0]!, scope_id: 'p0' }],
      }),
      'invalid_scope_id',
    );
  });
});

describe('billSyncContentFingerprint', () => {
  // Relative import — no @/ path in this test file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { billSyncContentFingerprint } = require('./bill-sync-content-fingerprint') as typeof import('./bill-sync-content-fingerprint');

  it('ignores request_id and is stable for same content', () => {
    const line = buildBillSyncLine({
      item_code: '006',
      name: 'Beer',
      qty: 1,
      unit_price_gross: 2.25,
      line_gross: 2.25,
      vat_rate_percent: 23,
    });
    assert.ok(!('error' in line));
    const a: BillSyncPayload = {
      request_id: '11111111-1111-1111-1111-111111111111',
      source_system: 'farvoo',
      source_sale_id: '22222222-2222-2222-2222-222222222222',
      table_display_name: '018',
      scope_type: 'whole_table',
      lines: [line],
      gross_total: '2.25',
    };
    const b: BillSyncPayload = { ...a, request_id: '33333333-3333-3333-3333-333333333333' };
    assert.equal(billSyncContentFingerprint(a), billSyncContentFingerprint(b));
  });

  it('changes when gross_total changes', () => {
    const line = buildBillSyncLine({
      item_code: '006',
      name: 'Beer',
      qty: 1,
      unit_price_gross: 2.25,
      line_gross: 2.25,
      vat_rate_percent: 23,
    });
    assert.ok(!('error' in line));
    const a: BillSyncPayload = {
      request_id: '11111111-1111-1111-1111-111111111111',
      source_system: 'farvoo',
      source_sale_id: '22222222-2222-2222-2222-222222222222',
      table_display_name: '018',
      scope_type: 'whole_table',
      lines: [line],
      gross_total: '2.25',
    };
    const b: BillSyncPayload = { ...a, gross_total: '3.00' };
    assert.notEqual(billSyncContentFingerprint(a), billSyncContentFingerprint(b));
  });

  it('matches jsonb-reordered line keys', () => {
    const line = buildBillSyncLine({
      item_code: '006',
      name: 'Beer',
      qty: 1,
      unit_price_gross: 2.25,
      line_gross: 2.25,
      vat_rate_percent: 23,
    });
    assert.ok(!('error' in line));
    const a: BillSyncPayload = {
      request_id: '11111111-1111-1111-1111-111111111111',
      source_system: 'farvoo',
      source_sale_id: '22222222-2222-2222-2222-222222222222',
      table_display_name: '018',
      scope_type: 'whole_table',
      lines: [line],
      gross_total: '2.25',
    };
    const reordered: BillSyncPayload = {
      ...a,
      lines: [
        {
          vat_rate: line.vat_rate,
          line_gross: line.line_gross,
          unit_price_gross: line.unit_price_gross,
          qty: line.qty,
          name: line.name,
          item_code: line.item_code,
        },
      ],
    };
    assert.equal(billSyncContentFingerprint(a), billSyncContentFingerprint(reordered));
  });
});
