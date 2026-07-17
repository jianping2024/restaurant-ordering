import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectCheckoutResumedFromBillContext } from '@/lib/customer-bill-checkout-resume';

describe('detectCheckoutResumedFromBillContext', () => {
  const base = {
    table_id: 't1',
    display_name: 'A1',
    collected_payments: [],
    party_member_count: 0,
  };

  it('detects continuation split after resume', () => {
    const split = { id: 'bs1', status: 'confirmed', split_mode: 'by_item' } as never;
    assert.deepEqual(
      detectCheckoutResumedFromBillContext({
        ...base,
        active_session: { status: 'open' } as never,
        existing_split: split,
      }),
      { kind: 'continuation', split, collectedPayments: [] },
    );
  });

  it('passes ledger rows on continuation', () => {
    const split = { id: 'bs1', status: 'confirmed', split_mode: 'by_item' } as never;
    const collected_payments = [
      { id: 'p1', person_name: 'Ana', amount: 19.95, created_at: '2026-01-01T00:00:00.000Z' },
    ];
    const result = detectCheckoutResumedFromBillContext({
      ...base,
      collected_payments,
      active_session: { status: 'open' } as never,
      existing_split: split,
    });
    assert.equal(result.kind, 'continuation');
    if (result.kind === 'continuation') {
      assert.equal(result.collectedPayments.length, 1);
      assert.equal(result.collectedPayments[0]?.amount, 19.95);
    }
  });

  it('detects fresh open session without split', () => {
    assert.deepEqual(
      detectCheckoutResumedFromBillContext({
        ...base,
        active_session: { status: 'open' } as never,
        existing_split: null,
      }),
      { kind: 'fresh' },
    );
  });

  it('unchanged while still billing', () => {
    assert.deepEqual(
      detectCheckoutResumedFromBillContext({
        ...base,
        active_session: { status: 'billing' } as never,
        existing_split: { id: 'bs1', status: 'requested' } as never,
      }),
      { kind: 'unchanged' },
    );
  });
});
