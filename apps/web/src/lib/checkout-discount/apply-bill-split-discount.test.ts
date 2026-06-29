import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyBillSplitDiscount } from './apply-bill-split-discount';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BILL_SPLIT_ID = '22222222-2222-4222-8222-222222222222';

type SplitRow = { id: string; result: unknown; status: string; discount_reason?: string | null };

function mockAdmin(options?: {
  split?: SplitRow | null;
  discountAudited?: boolean;
  updateError?: string;
}): SupabaseClient {
  const split = options?.split ?? {
    id: BILL_SPLIT_ID,
    session_id: 'sess-1',
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    total_amount: 100,
    status: 'requested',
    result: [{ name: 'A', amount: 50 }],
    discount_reason: null,
    discount_reason_detail: null,
  };
  const discountAudited = options?.discountAudited ?? false;

  const queryChain = (resolve: () => Promise<{ data: unknown; error: null }>) => {
    const chain: {
      eq: () => typeof chain;
      limit: () => typeof chain;
      maybeSingle: () => ReturnType<typeof resolve>;
    } = {
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
            data: options?.split === null ? null : split,
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
      update: () => ({
        eq: () => ({
          eq: async () => ({
            error: options?.updateError ? { message: options.updateError } : null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('applyBillSplitDiscount', () => {
  it('requires reason when applying a positive discount', async () => {
    const r = await applyBillSplitDiscount({
      admin: mockAdmin(),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'reason_required');
  });

  it('persists discount with reason', async () => {
    const r = await applyBillSplitDiscount({
      admin: mockAdmin(),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
      discountReason: 'owner_approved',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.discount_rate, 10);
    assert.equal(r.discount_reason, 'owner_approved');
  });

  it('clears reason when discount is zero', async () => {
    const r = await applyBillSplitDiscount({
      admin: mockAdmin({
        split: {
          id: BILL_SPLIT_ID,
          status: 'requested',
          result: [],
          discount_reason: 'owner_approved',
        },
      }),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 0,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.discount_rate, 0);
    assert.equal(r.discount_reason, null);
  });

  it('rejects discount changes after any payment', async () => {
    const r = await applyBillSplitDiscount({
      admin: mockAdmin({
        split: {
          id: BILL_SPLIT_ID,
          status: 'requested',
          result: [{ name: 'A', amount: 45, paid: true }],
        },
      }),
      restaurantId: RESTAURANT_ID,
      billSplitId: BILL_SPLIT_ID,
      discountRate: 10,
      discountReason: 'owner_approved',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'discount_locked_after_payment');
  });
});
