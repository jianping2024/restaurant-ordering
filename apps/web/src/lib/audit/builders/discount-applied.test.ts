import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeDiscountAmounts,
  discountAppliedDefinition,
} from '@/lib/audit/builders/discount-applied';

describe('computeDiscountAmounts', () => {
  it('computes discount and final totals', () => {
    const out = computeDiscountAmounts(100, 10);
    assert.equal(out.originalTotal, 100);
    assert.equal(out.discountAmount, 10);
    assert.equal(out.finalTotal, 90);
  });
});

describe('discountAppliedDefinition', () => {
  it('builds DISCOUNT_APPLIED payload with risk level', () => {
    const payload = discountAppliedDefinition.build({
      billSplitId: 'split-1',
      sessionId: 'sess-1',
      tableId: 'table-1',
      tableName: 'A3',
      originalTotal: 200,
      discountRate: 25,
      discountAmount: 50,
      finalTotal: 150,
    });
    assert.equal(payload.abnormalType, 'DISCOUNT_APPLIED');
    assert.equal(payload.riskLevel, 'MEDIUM');
    assert.equal(payload.entityId, 'split-1');
    assert.equal(payload.amountImpact, 50);
  });
});
