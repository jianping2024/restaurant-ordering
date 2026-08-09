import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultOrderHistoryQuery,
  loadOrderHistoryEntries,
} from '@/lib/order-history/load-entries';
import { LIST_DEFAULT_PAGE_SIZE } from '@/lib/paginate-list';

describe('defaultOrderHistoryQuery', () => {
  it('returns first page with default last-7 closed range', () => {
    const query = defaultOrderHistoryQuery({
      id: 'rest-1',
      owner_id: 'owner-1',
      name: 'Test Restaurant',
    });

    assert.equal(query.restaurantId, 'rest-1');
    assert.equal(query.ownerId, 'owner-1');
    assert.equal(query.restaurantName, 'Test Restaurant');
    assert.equal(query.offset, 0);
    assert.equal(query.limit, LIST_DEFAULT_PAGE_SIZE);
    assert.deepEqual(query.tableIds, []);
    assert.ok(query.closedFrom);
    assert.ok(query.closedTo);
    assert.ok(query.closedFrom <= query.closedTo);
  });
});

describe('loadOrderHistoryEntries', () => {
  it('returns empty items with total when offset is past matching total', async () => {
    const admin = {
      from(table: string) {
        if (table !== 'table_sessions') {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          gte() {
            return this;
          },
          lte() {
            return this;
          },
          order() {
            return this;
          },
          then(resolve: (value: { count: number; error: null; data: unknown[] }) => unknown) {
            return Promise.resolve(resolve({ count: 2, error: null, data: [] }));
          },
        };
      },
    };

    const result = await loadOrderHistoryEntries(admin as never, {
      restaurantId: 'rest-1',
      ownerId: 'owner-1',
      restaurantName: 'Test Restaurant',
      offset: 10,
      limit: LIST_DEFAULT_PAGE_SIZE,
      tableIds: [],
      sessionId: 'sess-1',
    });

    assert.equal(result.items.length, 0);
    assert.equal(result.total, 2);
  });
});
