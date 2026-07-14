import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  buildCheckoutSettlementSummary,
  checkoutPaymentProgress,
  checkoutSplitModeLabel,
  groupCollectedPaymentsBySession,
  hasCheckoutCollections,
} from './checkout-settlement';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [
      { name: 'John', amount: 30 },
      { name: 'Mary', amount: 30 },
    ],
    total_amount: 60,
    status: 'requested',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: '44444444-4444-4444-8444-444444444444',
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    ...overrides,
  };
}

const modeLabels = {
  even: '均摊',
  byItem: '按菜',
  custom: '自定义',
  wholeTable: '整桌',
};

describe('buildCheckoutSettlementSummary', () => {
  it('sums row outstanding for multi-person splits', () => {
    const summary = buildCheckoutSettlementSummary(
      billSplit(),
      0,
      [{ id: '1', person_index: 0, person_name: 'John', amount: 30, created_at: '' }],
    );
    assert.equal(summary.payable, 60);
    assert.equal(summary.collected, 30);
    assert.equal(summary.pending, 30);
  });
});

describe('checkoutPaymentProgress', () => {
  it('counts paid rows from ledger when available', () => {
    const progress = checkoutPaymentProgress(
      billSplit({
        result: [
          { name: 'John', amount: 30, paid: false },
          { name: 'Mary', amount: 30 },
        ],
      }),
      [{ id: '1', person_index: 0, person_name: 'John', amount: 30, created_at: '' }],
    );
    assert.equal(progress.paidCount, 1);
    assert.equal(progress.totalCount, 2);
  });
});

describe('hasCheckoutCollections', () => {
  it('is true when ledger or paid rows exist', () => {
    assert.equal(hasCheckoutCollections(billSplit(), []), false);
    assert.equal(
      hasCheckoutCollections(
        billSplit({ result: [{ name: 'John', amount: 30, paid: true }] }),
        [],
      ),
      true,
    );
  });
});

describe('checkoutSplitModeLabel', () => {
  it('maps split modes', () => {
    assert.equal(checkoutSplitModeLabel('by_item', modeLabels), '按菜');
    assert.equal(checkoutSplitModeLabel(null, modeLabels), '整桌');
  });
});

describe('groupCollectedPaymentsBySession', () => {
  it('groups rows by session_id', () => {
    const map = groupCollectedPaymentsBySession([
      {
        id: '1',
        session_id: 's1',
        person_name: 'John',
        amount: 10,
        created_at: '',
      },
      {
        id: '2',
        session_id: 's2',
        person_name: 'Mary',
        amount: 5,
        created_at: '',
      },
    ]);
    assert.equal(map.get('s1')?.length, 1);
    assert.equal(map.get('s2')?.[0]?.amount, 5);
  });
});
