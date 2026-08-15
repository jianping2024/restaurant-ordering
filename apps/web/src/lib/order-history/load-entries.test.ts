import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultOrderHistoryQuery,
  loadOrderHistoryEntries,
  OrderHistoryLoadError,
} from '@/lib/order-history/load-entries';
import { LIST_DEFAULT_PAGE_SIZE } from '@/lib/paginate-list';

describe('defaultOrderHistoryQuery', () => {
  it('returns first page with default today-only closed range', () => {
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
    assert.equal(query.closedFrom, query.closedTo);
  });
});

describe('loadOrderHistoryEntries', () => {
  it('returns empty items with total when offset is past matching total', async () => {
    const admin = {
      async rpc(name: string, args: { p_offset: number }) {
        assert.equal(name, 'order_history_feed_page');
        assert.equal(args.p_offset, 10);
        return { data: { total: 2, items: [] }, error: null };
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

  it('hydrates orders only for closed ids on the RPC page', async () => {
    let ordersInSessionIds: string[] | null = null;
    let rpcArgs: Record<string, unknown> | null = null;

    const admin = {
      async rpc(name: string, args: Record<string, unknown>) {
        assert.equal(name, 'order_history_feed_page');
        rpcArgs = args;
        return {
          data: {
            total: 5,
            items: [
              {
                kind: 'closed',
                sort_at: '2026-08-10T12:00:00.000Z',
                session_id: 'sess-0',
                event_id: null,
                payload: {
                  id: 'sess-0',
                  table_id: 'table-0',
                  opened_at: null,
                  closed_at: '2026-08-10T12:00:00.000Z',
                  closed_reason: 'cashier_closed',
                  settled_payable_amount: 1,
                  opened_by_user_id: null,
                  closed_by_user_id: null,
                  merge_into_session_id: null,
                },
              },
              {
                kind: 'transfer',
                sort_at: '2026-08-10T11:00:00.000Z',
                session_id: 'sess-tr',
                event_id: 'ev-1',
                payload: {
                  id: 'ev-1',
                  session_id: 'sess-tr',
                  occurred_at: '2026-08-10T11:00:00.000Z',
                  operator_user_id: null,
                  from_table_id: 't-from',
                  to_table_id: 't-to',
                  from_display_name: '1',
                  to_display_name: '2',
                },
              },
            ],
          },
          error: null,
        };
      },
      from(table: string) {
        if (table === 'orders') {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            in(_column: string, ids: string[]) {
              ordersInSessionIds = ids;
              return this;
            },
            order() {
              return this;
            },
            then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
              return Promise.resolve(resolve({ data: [], error: null }));
            },
          };
        }

        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          is() {
            return this;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            return Promise.resolve(resolve({ data: [], error: null }));
          },
        };
      },
    };

    const result = await loadOrderHistoryEntries(admin as never, {
      restaurantId: 'rest-1',
      ownerId: 'owner-1',
      restaurantName: 'Test Restaurant',
      offset: 0,
      limit: 2,
      tableIds: [],
      closedFrom: '2026-08-05',
      closedTo: '2026-08-11',
    });

    assert.equal(rpcArgs?.p_restaurant_id, 'rest-1');
    assert.equal(rpcArgs?.p_offset, 0);
    assert.equal(rpcArgs?.p_limit, 2);
    assert.equal(rpcArgs?.p_include_transfers, true);
    assert.deepEqual(ordersInSessionIds, ['sess-0']);
    assert.equal(result.total, 5);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.sessionId, 'sess-0');
    assert.equal(result.items[1]?.closeKind, 'transferred_source');
  });

  it('throws OrderHistoryLoadError when feed RPC fails', async () => {
    const admin = {
      async rpc() {
        return { data: null, error: { message: 'boom' } };
      },
    };

    await assert.rejects(
      () =>
        loadOrderHistoryEntries(admin as never, {
          restaurantId: 'rest-1',
          ownerId: 'owner-1',
          restaurantName: 'Test Restaurant',
          offset: 0,
          limit: 10,
          tableIds: [],
          closedFrom: '2026-08-05',
          closedTo: '2026-08-11',
        }),
      (err: unknown) =>
        err instanceof OrderHistoryLoadError && err.message.includes('feed_page_rpc_failed'),
    );
  });
});
