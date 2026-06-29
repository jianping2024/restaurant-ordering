import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDiscountReadyForPayment } from './discount-payment-gate';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BILL_SPLIT_ID = '22222222-2222-4222-8222-222222222222';

function mockAdmin(options?: { discountAudited?: boolean }): SupabaseClient {
  const discountAudited = options?.discountAudited ?? false;
  const queryChain = (resolve: () => Promise<{ data: unknown; error: null }>) => {
    const chain: { eq: () => typeof chain; limit: () => typeof chain; maybeSingle: () => ReturnType<typeof resolve> } = {
      eq: () => chain,
      limit: () => chain,
      maybeSingle: resolve,
    };
    return chain;
  };

  return {
    from: (table: string) => ({
      select: () => {
        if (table === 'bill_splits') {
          return queryChain(async () => ({
            data: {
              id: BILL_SPLIT_ID,
              session_id: 'sess-1',
              table_id: '33333333-3333-4333-8333-333333333333',
              display_name: 'A-01',
              total_amount: 100,
            },
            error: null,
          }));
        }
        if (table === 'operation_logs') {
          return queryChain(async () => ({
            data: discountAudited ? { id: 'log-1' } : null,
            error: null,
          }));
        }
        return queryChain(async () => ({ data: null, error: null }));
      },
    }),
  } as unknown as SupabaseClient;
}

describe('assertDiscountReadyForPayment', () => {
  it('allows zero discount without bill lookup', async () => {
    const admin = mockAdmin();
    const r = await assertDiscountReadyForPayment({
      admin,
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 0,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.snapshot, null);
  });

  it('requires reason on first discounted payment', async () => {
    const r = await assertDiscountReadyForPayment({
      admin: mockAdmin(),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'reason_required');
  });

  it('accepts discounted payment when reason provided', async () => {
    const r = await assertDiscountReadyForPayment({
      admin: mockAdmin(),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
      discountReason: 'owner_approved',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.snapshot?.id, BILL_SPLIT_ID);
  });

  it('skips reason when discount already audited for bill', async () => {
    const r = await assertDiscountReadyForPayment({
      admin: mockAdmin({ discountAudited: true }),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
    });
    assert.equal(r.ok, true);
  });
});
