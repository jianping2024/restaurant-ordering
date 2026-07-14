import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  closeTableSessionFrontdeskCheckout,
  closeTableSessionManual,
} from '@/lib/table-session/close-table-session.service';

const actor = { userId: 'user-1', displayName: 'Owner', role: 'owner' as const };

describe('closeTableSessionFrontdeskCheckout', () => {
  it('rejects billing sessions', async () => {
    const admin = {
      from(table: string) {
        if (table === 'table_sessions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: { id: 'sess-1', status: 'billing' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await closeTableSessionFrontdeskCheckout({
      admin,
      restaurantId: 'rest-1',
      tableId: 'table-1',
      userId: 'user-1',
      closedReason: 'frontdesk_closed',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'session_billing');
  });
});

describe('closeTableSessionManual', () => {
  it('rejects invalid unpaid reason before RPC', async () => {
    const result = await closeTableSessionManual({
      admin: {} as SupabaseClient,
      restaurantId: 'rest-1',
      userId: 'user-1',
      actor,
      closedReason: 'owner_closed',
      tableId: 'table-1',
      confirmClose: true,
      unpaidReason: 'not_a_real_reason',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'invalid_reason');
  });

  it('requires detail for other reason', async () => {
    const result = await closeTableSessionManual({
      admin: {} as SupabaseClient,
      restaurantId: 'rest-1',
      userId: 'user-1',
      actor,
      closedReason: 'owner_closed',
      tableId: 'table-1',
      confirmClose: true,
      unpaidReason: 'other',
      unpaidReasonDetail: '   ',
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'reason_detail_required');
  });
});
