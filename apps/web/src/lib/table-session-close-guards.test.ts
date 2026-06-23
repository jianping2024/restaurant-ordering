import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateTableSessionCloseGuards,
  isManualCloseConfirmed,
} from './table-session-close-guards';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';

type GuardMockConfig = {
  session?: { id: string } | null;
  checkoutRequestedCount?: number | null;
};

function mockAdminForGuards(config: GuardMockConfig): SupabaseClient {
  const sessionChain = {
    eq: () => sessionChain,
    in: () => sessionChain,
    order: () => sessionChain,
    limit: () => sessionChain,
    maybeSingle: async () => ({ data: config.session ?? null, error: null }),
  };

  let splitEqCalls = 0;
  const splitChain = {
    eq: () => {
      splitEqCalls += 1;
      if (splitEqCalls >= 3) {
        return Promise.resolve({
          count: config.checkoutRequestedCount ?? 0,
          error: null,
        });
      }
      return splitChain;
    },
  };

  return {
    from: (table: string) => {
      if (table === 'table_sessions') return { select: () => sessionChain };
      if (table === 'bill_splits') return { select: () => splitChain };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('isManualCloseConfirmed', () => {
  it('accepts confirm_close or legacy confirm_checkout_close', () => {
    assert.equal(isManualCloseConfirmed({ confirm_close: true }), true);
    assert.equal(isManualCloseConfirmed({ confirm_checkout_close: true }), true);
    assert.equal(isManualCloseConfirmed({}), false);
  });
});

describe('evaluateTableSessionCloseGuards', () => {
  it('returns no_session when no active session', async () => {
    const result = await evaluateTableSessionCloseGuards(
      mockAdminForGuards({ session: null }),
      RESTAURANT_ID,
      TABLE_ID,
    );
    assert.equal(result.ok, false);
    if (result.ok || result.code !== 'no_session') throw new Error('expected no_session');
  });

  it('returns close_confirm_required without confirm even when no checkout request', async () => {
    const result = await evaluateTableSessionCloseGuards(
      mockAdminForGuards({ session: { id: SESSION_ID }, checkoutRequestedCount: 0 }),
      RESTAURANT_ID,
      TABLE_ID,
    );
    assert.equal(result.ok, false);
    if (result.ok || result.code !== 'close_confirm_required') {
      throw new Error('expected close_confirm_required');
    }
    assert.deepEqual(result.reasons, { checkout_requested: 0 });
  });

  it('returns close_confirm_required when checkout requested and no confirm', async () => {
    const result = await evaluateTableSessionCloseGuards(
      mockAdminForGuards({ session: { id: SESSION_ID }, checkoutRequestedCount: 2 }),
      RESTAURANT_ID,
      TABLE_ID,
    );
    assert.equal(result.ok, false);
    if (result.ok || result.code !== 'close_confirm_required') {
      throw new Error('expected close_confirm_required');
    }
    assert.deepEqual(result.reasons, { checkout_requested: 2 });
  });

  it('returns ok when confirm_close is true', async () => {
    const result = await evaluateTableSessionCloseGuards(
      mockAdminForGuards({ session: { id: SESSION_ID }, checkoutRequestedCount: 1 }),
      RESTAURANT_ID,
      TABLE_ID,
      { confirm_close: true },
    );
    assert.deepEqual(result, { ok: true, session_id: SESSION_ID });
  });
});
