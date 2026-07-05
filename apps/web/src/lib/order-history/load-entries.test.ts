import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultOrderHistoryQuery,
  loadOrderHistoryEntries,
} from '@/lib/order-history/load-entries';
import {
  ORDER_HISTORY_MAX_TOTAL,
  ORDER_HISTORY_PAGE_SIZE,
} from '@/lib/order-history/types';

describe('defaultOrderHistoryQuery', () => {
  it('returns first page with default filters', () => {
    const query = defaultOrderHistoryQuery({
      id: 'rest-1',
      owner_id: 'owner-1',
      name: 'Test Restaurant',
    });

    assert.equal(query.restaurantId, 'rest-1');
    assert.equal(query.ownerId, 'owner-1');
    assert.equal(query.restaurantName, 'Test Restaurant');
    assert.equal(query.offset, 0);
    assert.equal(query.limit, ORDER_HISTORY_PAGE_SIZE);
    assert.equal(query.maxTotal, ORDER_HISTORY_MAX_TOTAL);
    assert.deepEqual(query.tableIds, []);
  });
});

describe('loadOrderHistoryEntries', () => {
  it('returns empty result when offset exceeds max total', async () => {
    const admin = {
      from() {
        throw new Error('should not query');
      },
    };

    const result = await loadOrderHistoryEntries(admin as never, {
      restaurantId: 'rest-1',
      ownerId: 'owner-1',
      restaurantName: 'Test Restaurant',
      offset: ORDER_HISTORY_MAX_TOTAL,
      limit: ORDER_HISTORY_PAGE_SIZE,
      tableIds: [],
    });

    assert.deepEqual(result, { items: [], cappedTotal: 0, hasMore: false });
  });
});
