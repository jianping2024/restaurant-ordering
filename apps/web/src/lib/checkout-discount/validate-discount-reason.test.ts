import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateDiscountReason } from './validate-discount-reason';

describe('validateDiscountReason', () => {
  it('allows zero discount without reason', () => {
    assert.deepEqual(validateDiscountReason(0, null, null), { ok: true });
  });

  it('requires reason when discount is positive', () => {
    assert.deepEqual(validateDiscountReason(10, null, null), { ok: false, code: 'reason_required' });
  });

  it('requires detail for other', () => {
    assert.deepEqual(validateDiscountReason(5, 'other', ''), {
      ok: false,
      code: 'reason_detail_required',
    });
    assert.deepEqual(validateDiscountReason(5, 'other', 'promo'), { ok: true });
  });

  it('accepts known discount reasons', () => {
    assert.deepEqual(validateDiscountReason(15, 'owner_approved', null), { ok: true });
  });
});
