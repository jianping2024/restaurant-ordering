import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRequiredAbnormalReason } from './validate-abnormal-reason';

describe('validateRequiredAbnormalReason', () => {
  it('requires reason and detail for discount other', () => {
    assert.deepEqual(validateRequiredAbnormalReason('discount', null, null), {
      ok: false,
      code: 'reason_required',
    });
    assert.deepEqual(validateRequiredAbnormalReason('discount', 'other', ''), {
      ok: false,
      code: 'reason_detail_required',
    });
    assert.deepEqual(validateRequiredAbnormalReason('discount', 'owner_approved', null), {
      ok: true,
    });
  });

  it('requires detail when voiding served items', () => {
    assert.deepEqual(
      validateRequiredAbnormalReason('void_item', 'staff_mistake', null, {
        voidItemWasServed: true,
      }),
      { ok: false, code: 'reason_detail_required' },
    );
    assert.deepEqual(
      validateRequiredAbnormalReason('void_item', 'staff_mistake', null, {
        voidItemWasServed: false,
      }),
      { ok: true },
    );
  });
});
