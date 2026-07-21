import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBillSplitsForOrderHistory } from '@/lib/order-history-bill-splits';

const RESTAURANT_ID = 'rest-1';

describe('loadBillSplitsForOrderHistory', () => {
  it('returns latest split per session for paid/cancelled rows', async () => {
    const admin = {
      from(table: string) {
        assert.equal(table, 'bill_splits');
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                in: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: 'split-new',
                        session_id: 'sess-a',
                        table_id: 'table-a',
                        discount_rate: 10,
                        status: 'paid',
                        total_amount: 42.5,
                        split_mode: 'even',
                        persons: [],
                        result: [{ name: 'Guest 1', amount: 42.5, paid: true }],
                        created_at: '2026-07-04T12:00:00.000Z',
                      },
                      {
                        id: 'split-old',
                        session_id: 'sess-a',
                        table_id: 'table-a',
                        discount_rate: 0,
                        status: 'paid',
                        total_amount: 30,
                        split_mode: 'even',
                        persons: [],
                        result: [],
                        created_at: '2026-07-03T12:00:00.000Z',
                      },
                      {
                        id: 'split-b',
                        session_id: 'sess-b',
                        table_id: 'table-b',
                        discount_rate: 0,
                        status: 'cancelled',
                        total_amount: 0,
                        split_mode: 'even',
                        persons: [],
                        result: [],
                        created_at: '2026-07-04T10:00:00.000Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const result = await loadBillSplitsForOrderHistory(admin, RESTAURANT_ID, [
      'sess-a',
      'sess-b',
      'sess-a',
    ]);

    assert.deepEqual(result, {
      'sess-a': {
        id: 'split-new',
        session_id: 'sess-a',
        table_id: 'table-a',
        discount_rate: 10,
        status: 'paid',
        total_amount: 42.5,
        split_mode: 'even',
        persons: [],
        result: [{ name: 'Guest 1', amount: 42.5, paid: true }],
      },
      'sess-b': {
        id: 'split-b',
        session_id: 'sess-b',
        table_id: 'table-b',
        discount_rate: 0,
        status: 'cancelled',
        total_amount: 0,
        split_mode: 'even',
        persons: [],
        result: [],
      },
    });
  });

  it('returns empty map when session ids are empty', async () => {
    const admin = {
      from() {
        throw new Error('should not query');
      },
    } as unknown as SupabaseClient;

    const result = await loadBillSplitsForOrderHistory(admin, RESTAURANT_ID, []);
    assert.deepEqual(result, {});
  });
});
