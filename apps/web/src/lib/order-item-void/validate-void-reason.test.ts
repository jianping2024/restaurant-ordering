import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateVoidItemReason } from '@/lib/order-item-void/validate-void-reason';
import type { NewlyVoidedItem } from '@/lib/order-item-void/detect-newly-voided';

const voidedRow = (statusBefore: 'pending' | 'done'): NewlyVoidedItem => ({
  itemIndex: 0,
  statusBefore,
  before: {
    id: 'item-1',
    name: 'Soup',
    name_pt: 'Soup',
    qty: 1,
    price: 10,
    emoji: '🍲',
    item_status: statusBefore,
  },
  after: {
    id: 'item-1',
    name: 'Soup',
    name_pt: 'Soup',
    qty: 1,
    price: 10,
    emoji: '🍲',
    item_status: 'voided',
  },
});

describe('validateVoidItemReason', () => {
  it('allows non-void patches without reason', () => {
    assert.deepEqual(validateVoidItemReason([], null, null), { ok: true });
  });

  it('requires reason when voiding', () => {
    assert.deepEqual(validateVoidItemReason([voidedRow('pending')], null, null), {
      ok: false,
      code: 'reason_required',
    });
  });

  it('requires detail for other', () => {
    assert.deepEqual(
      validateVoidItemReason([voidedRow('pending')], 'other', null),
      { ok: false, code: 'reason_detail_required' },
    );
  });

  it('requires detail when voiding served items even without other', () => {
    assert.deepEqual(
      validateVoidItemReason([voidedRow('done')], 'staff_mistake', null),
      { ok: false, code: 'reason_detail_required' },
    );
  });
});
