import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  voidItemReasonDialogCopy,
  voidItemReasonDialogTitle,
  voidItemWasServed,
} from '@/lib/order-item-void/void-item-reason-ui';

describe('voidItemReasonDialogTitle', () => {
  it('uses item name in title when provided', () => {
    assert.equal(
      voidItemReasonDialogTitle('zh', { emoji: '🍗', name: 'BBQ Chicken', name_pt: '' }),
      '取消「🍗 BBQ Chicken」',
    );
  });

  it('falls back to generic title without item', () => {
    assert.equal(voidItemReasonDialogTitle('zh', null), '取消菜品');
  });
});

describe('voidItemReasonDialogCopy', () => {
  it('uses distinct button labels and reason placeholder', () => {
    const copy = voidItemReasonDialogCopy('zh');
    assert.equal(copy.message, '该菜品将不再计入账单。');
    assert.equal(copy.reasonPlaceholder, '请选择原因');
    assert.equal(copy.confirmLabel, '确认取消');
    assert.equal(copy.cancelLabel, '返回');
    assert.notEqual(copy.confirmLabel, copy.cancelLabel);
    assert.notEqual(copy.reasonPlaceholder, copy.reasonLabel);
  });
});

describe('voidItemWasServed', () => {
  it('detects served items', () => {
    assert.equal(voidItemWasServed({ item_status: 'done' }), true);
    assert.equal(voidItemWasServed({ item_status: 'pending' }), false);
  });
});
