import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectCheckoutResumedFromBillContext } from '@/lib/customer-bill-checkout-resume';

describe('detectCheckoutResumedFromBillContext', () => {
  const base = {
    table_id: 't1',
    display_name: 'A1',
    has_collected_payments: false,
    collected_person_names: [],
  };

  it('detects continuation split after resume', () => {
    const split = { id: 'bs1', status: 'confirmed', split_mode: 'by_item' } as never;
    assert.deepEqual(
      detectCheckoutResumedFromBillContext({
        ...base,
        active_session: { status: 'open' } as never,
        existing_split: split,
      }),
      { kind: 'continuation', split, hasCollectedPayments: false, collectedPersonNames: [] },
    );
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
