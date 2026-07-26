import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClosedSessionRevenueBundleRpc } from '@/lib/analytics/closed-session-revenue';

describe('loadClosedSessionRevenueBundleRpc', () => {
  it('maps RPC payload into a closed-session revenue bundle', async () => {
    const admin = {
      rpc: async () => ({
        data: {
          ok: true,
          sessions: [{ id: 's1', closed_at: '2026-07-26T20:00:00.000Z', closed_reason: 'owner_closed' }],
          orders: [{ id: 'o1', session_id: 's1', status: 'done', total_amount: 10 }],
          splits: [
            {
              id: 'b1',
              session_id: 's1',
              status: 'paid',
              result: [{ amount: 10, paid: true }],
              total_amount: 10,
              discount_rate: 0,
            },
          ],
          unpaid_session_ids: [],
        },
        error: null,
      }),
    };

    const result = await loadClosedSessionRevenueBundleRpc(
      admin as never,
      'r1',
      '2026-07-26T00:00:00.000Z',
      '2026-07-27T00:00:00.000Z',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.bundle.sessions.length, 1);
    assert.equal(result.bundle.ordersBySession.get('s1')?.length, 1);
    assert.equal(result.bundle.splitsBySession.get('s1')?.length, 1);
  });

  it('surfaces query_limit_exceeded from RPC', async () => {
    const admin = {
      rpc: async () => ({
        data: { ok: false, code: 'query_limit_exceeded', session_count: 9000 },
        error: null,
      }),
    };
    const result = await loadClosedSessionRevenueBundleRpc(
      admin as never,
      'r1',
      '2026-07-26T00:00:00.000Z',
      '2026-07-27T00:00:00.000Z',
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'query_limit_exceeded');
  });
});
