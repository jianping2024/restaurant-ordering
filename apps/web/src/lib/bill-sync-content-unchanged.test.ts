import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billSyncContentUnchanged } from './bill-sync-content-unchanged';
import { buildBillSyncLine, type BillSyncPayload } from './bill-sync-payload';
import { billSyncContentFingerprint } from './bill-sync-content-fingerprint';

function samplePayload(gross: string): BillSyncPayload {
  const line = buildBillSyncLine({
    item_code: '006',
    name: 'Beer',
    qty: 1,
    unit_price_gross: Number(gross),
    line_gross: Number(gross),
    vat_rate_percent: 23,
  });
  assert.ok(!('error' in line));
  return {
    request_id: '11111111-1111-4111-8111-111111111111',
    source_system: 'farvoo',
    source_sale_id: '22222222-2222-4222-8222-222222222222',
    table_display_name: 'A-02',
    scope_type: 'whole_table',
    lines: [line],
    gross_total: gross,
  };
}

describe('billSyncContentUnchanged', () => {
  it('is true only when succeeded job fingerprint matches live', () => {
    const payload = samplePayload('2.25');
    const fp = billSyncContentFingerprint(payload);
    assert.equal(
      billSyncContentUnchanged({
        jobStatus: 'succeeded',
        jobPayload: payload,
        liveFingerprint: fp,
      }),
      true,
    );
    assert.equal(
      billSyncContentUnchanged({
        jobStatus: 'succeeded',
        jobPayload: payload,
        liveFingerprint: billSyncContentFingerprint(samplePayload('3.00')),
      }),
      false,
    );
    assert.equal(
      billSyncContentUnchanged({
        jobStatus: 'pending',
        jobPayload: payload,
        liveFingerprint: fp,
      }),
      false,
    );
    assert.equal(
      billSyncContentUnchanged({
        jobStatus: 'succeeded',
        jobPayload: payload,
        liveFingerprint: null,
      }),
      false,
    );
  });
});
