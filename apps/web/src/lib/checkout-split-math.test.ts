import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  allocateDiscountedSplitObligations,
  applyDiscountToRows,
  checkoutPayableAmount,
  clampCheckoutDiscountRate,
  discountedObligationAmount,
  formatCheckoutCollectDiscountDetail,
  formatCheckoutDiscountLabel,
  normalizeSplitRows,
  resolveCheckoutDiscountMoneyView,
  resolveCheckoutDiscountedShareDisplay,
} from './checkout-split-math';

const BILL_SPLIT_ID = '22222222-2222-4222-8222-222222222222';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: BILL_SPLIT_ID,
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [],
    total_amount: 0,
    status: 'requested',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: null,
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    ...overrides,
  };
}

describe('checkout-split-math', () => {
  it('normalizeSplitRows synthesizes Total when result empty', () => {
    assert.deepEqual(normalizeSplitRows(billSplit({ total_amount: 57.5 })), [
      { name: 'Total', amount: 57.5 },
    ]);
  });

  it('checkoutPayableAmount applies discount to split total', () => {
    const split = billSplit({ total_amount: 100, result: [{ name: 'Total', amount: 100 }] });
    assert.equal(checkoutPayableAmount(split, 10), 90);
    assert.equal(checkoutPayableAmount(split, 0), 100);
  });

  it('clampCheckoutDiscountRate bounds rate', () => {
    assert.equal(clampCheckoutDiscountRate(-5), 0);
    assert.equal(clampCheckoutDiscountRate(150), 100);
  });

  it('applyDiscountToRows preserves paid flag', () => {
    const out = applyDiscountToRows([{ name: 'X', amount: 40, paid: true }], 25);
    assert.equal(out[0]?.paid, true);
    assert.equal(out[0]?.amount, 30);
  });

  it('allocateDiscountedSplitObligations sums to bill payable (no independent round drift)', () => {
    const amounts = allocateDiscountedSplitObligations([22.45, 33, 1.85], 10, {
      billTotalAmount: 57.3,
    });
    const sumCents = amounts.reduce((sum, a) => sum + Math.round(a * 100), 0);
    assert.equal(sumCents, 5157);
    assert.equal(checkoutPayableAmount(billSplit({ total_amount: 57.3 }), 10), 51.57);
  });

  it('allocate stays fixed after partial collects (no freeze re-split)', () => {
    const pre = [19.95, 28.18, 8.4, 1.23, 3.89];
    const open = allocateDiscountedSplitObligations(pre, 10, { billTotalAmount: 61.65 });
    assert.deepEqual(open, [17.96, 25.37, 7.56, 1.1, 3.5]);
    const again = allocateDiscountedSplitObligations(pre, 10, { billTotalAmount: 61.65 });
    assert.deepEqual(again, open);
    const paidSum = open[0]! + open[1]! + open[2]! + open[3]!;
    assert.equal(Number(paidSum.toFixed(2)), 51.99);
    assert.equal(open[4], 3.5);
    assert.equal(Number((55.49 - paidSum).toFixed(2)), 3.5);
  });

  it('discount rounding matches SQL checkout_round_discount_amount (cents-first)', () => {
    assert.equal(discountedObligationAmount(19.95, 10), 17.96);
    assert.equal(discountedObligationAmount(1.85, 10), 1.67);
    assert.equal(discountedObligationAmount(10.9, 10), 9.81);
    assert.equal(checkoutPayableAmount(billSplit({ total_amount: 21.8 }), 10), 19.62);
  });

  it('resolveCheckoutDiscountMoneyView is sole bar/person/collect money view', () => {
    const view = resolveCheckoutDiscountMoneyView(19.95, 10);
    assert.equal(view.payableAmount, 17.96);
    assert.equal(view.savedAmount, 1.99);
    assert.equal(view.active, true);
    assert.equal(resolveCheckoutDiscountMoneyView(19.95, 0).active, false);
    assert.equal(
      formatCheckoutDiscountLabel('折扣 {n}%  −€{amount}', view.rate, view.savedAmount),
      '折扣 10%  −€1.99',
    );
    assert.equal(
      formatCheckoutCollectDiscountDetail('折前 €{pre} · 折扣 {n}%', 19.95, 10),
      '折前 €19.95 · 折扣 10%',
    );
  });

  it('resolveCheckoutDiscountedShareDisplay prefers allocated payable', () => {
    const share = resolveCheckoutDiscountedShareDisplay(18, 10, 16.2);
    assert.equal(share.displayAmount, 16.2);
    assert.equal(share.showPreLine, true);
  });
});
