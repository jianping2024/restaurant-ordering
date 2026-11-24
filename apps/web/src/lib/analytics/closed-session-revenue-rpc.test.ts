import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadClosedSessionRevenueBundlesRpc } from '@/lib/analytics/closed-session-revenue';

const WINDOW = ['2026-07-26T00:00:00.000Z', '2026-07-27T00:00:00.000Z'] as const;

describe('loadClosedSessionRevenueBundlesRpc', () => {
  it('maps per-store RPC payloads into closed-session revenue bundles', async () => {
    let calledWith: unknown = null;
    const admin = {
      rpc: async (_name: string, args: unknown) => {
        calledWith = args;
        return {
          data: {
            r1: {
              ok: true,
              sessions: [
                {
                  id: 's1',
                  opened_at: '2026-07-26T18:00:00.000Z',
                  closed_at: '2026-07-26T20:00:00.000Z',
                  closed_reason: 'owner_closed',
                },
              ],
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
            r2: { ok: true, sessions: [], orders: [], splits: [], unpaid_session_ids: [] },
          },
          error: null,
        };
      },
    };

    const results = await loadClosedSessionRevenueBundlesRpc(admin as never, ['r1', 'r2'], ...WINDOW);
    assert.deepEqual((calledWith as { p_restaurant_ids: string[] }).p_restaurant_ids, ['r1', 'r2']);
    const r1 = results.get('r1');
    assert.equal(r1?.ok, true);
    if (!r1?.ok) return;
    assert.equal(r1.bundle.sessions.length, 1);
    assert.equal(r1.bundle.ordersBySession.get('s1')?.length, 1);
    assert.equal(r1.bundle.splitsBySession.get('s1')?.length, 1);
    const r2 = results.get('r2');
    assert.equal(r2?.ok, true);
    if (!r2?.ok) return;
    assert.equal(r2.bundle.sessions.length, 0);
  });

  it('keeps per-store failures apart (limit exceeded, missing store, rpc error)', async () => {
    const admin = {
      rpc: async () => ({
        data: { r1: { ok: false, code: 'query_limit_exceeded', session_count: 9000 } },
        error: null,
      }),
    };
    const results = await loadClosedSessionRevenueBundlesRpc(admin as never, ['r1', 'r2'], ...WINDOW);
    const r1 = results.get('r1');
    assert.equal(r1?.ok, false);
    if (r1?.ok !== false) return;
    assert.equal(r1.code, 'query_limit_exceeded');
    assert.equal(results.get('r2')?.ok, false);

    const failing = { rpc: async () => ({ data: null, error: { message: 'boom' } }) };
    const failed = await loadClosedSessionRevenueBundlesRpc(failing as never, ['r1'], ...WINDOW);
    assert.equal(failed.get('r1')?.ok, false);
  });

  it('skips the RPC for an empty store list', async () => {
    const admin = {
      rpc: async () => {
        throw new Error('should not call');
      },
    };
    const results = await loadClosedSessionRevenueBundlesRpc(admin as never, [], ...WINDOW);
    assert.equal(results.size, 0);
  });
});
