import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listAbnormalOperations } from '@/lib/abnormal-operations/owner-query';

describe('listAbnormalOperations', () => {
  it('maps RPC payload to list result without in-memory full-table sort', async () => {
    const calls: unknown[] = [];
    const admin = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data: {
            items: [
              {
                id: 'a1',
                risk_level: 'HIGH',
                status: 'PENDING',
                amount_impact: 10,
                created_at: '2026-07-26T10:00:00.000Z',
              },
            ],
            stats: {
              total_count: 3,
              high_risk_count: 1,
              amount_impact_sum: 12.5,
              pending_count: 2,
            },
            page: 1,
            pageSize: 20,
            total: 3,
          },
          error: null,
        };
      },
    };

    const result = await listAbnormalOperations(admin as never, {
      restaurantId: 'r1',
      startDate: '2026-07-26',
      endDate: '2026-07-26',
      now: new Date('2026-07-26T12:00:00.000Z'),
      page: 1,
      pageSize: 20,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.result.total, 3);
    assert.equal(result.result.items.length, 1);
    assert.equal(result.result.stats.pending_count, 2);
    assert.equal(result.result.stats.amount_impact_sum, 12.5);
    assert.equal((calls[0] as { name: string }).name, 'abnormal_operations_owner_list');
    assert.equal((calls[0] as { args: { p_restaurant_id: string } }).args.p_restaurant_id, 'r1');
  });

  it('returns query_failed when RPC errors', async () => {
    const admin = {
      rpc: async () => ({ data: null, error: { message: 'boom' } }),
    };
    const result = await listAbnormalOperations(admin as never, {
      restaurantId: 'r1',
      startDate: '2026-07-26',
      endDate: '2026-07-26',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'query_failed');
  });
});
