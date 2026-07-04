import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  customerSessionContextFromWaiterDetail,
  resolveCustomerSessionBootContext,
  resolveCustomerTableIdRequest,
  type CustomerSessionContext,
} from './customer-session-context';
import type { WaiterTablePageModel } from './waiter-table-detail-types';

const tableId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const restaurantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function buffetOrder(sessionId: string): Order {
  return {
    id: 'order-1',
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    status: 'submitted',
    created_at: '2026-01-01T12:00:00.000Z',
    items: [
      {
        menu_item_id: null,
        name_pt: 'Buffet livre',
        price: 20,
        qty: 1,
        item_type: 'buffet_base',
        buffet_id: 'buffet-1',
        added_at: '2026-01-01T12:00:00.000Z',
      },
    ],
  };
}

describe('resolveCustomerTableIdRequest', () => {
  it('returns by_id for a valid table_id param', () => {
    assert.deepEqual(resolveCustomerTableIdRequest(tableId), {
      kind: 'by_id',
      tableId,
    });
  });

  it('returns invalid for malformed table_id param', () => {
    assert.deepEqual(resolveCustomerTableIdRequest('not-a-uuid'), { kind: 'invalid' });
  });

  it('returns default when table_id is omitted', () => {
    assert.deepEqual(resolveCustomerTableIdRequest(undefined), { kind: 'default' });
    assert.deepEqual(resolveCustomerTableIdRequest(''), { kind: 'default' });
    assert.deepEqual(resolveCustomerTableIdRequest('   '), { kind: 'default' });
  });
});

describe('customerSessionContextFromWaiterDetail', () => {
  it('maps session meta and orders for the requested table', () => {
    const ctx = customerSessionContextFromWaiterDetail(tableId, {
      table: {
        id: tableId,
        display_name: '005',
        sort_order: 1,
      },
      sessionMeta: {
        sessionId: 'session-1',
        openedAt: '2026-01-01T12:00:00.000Z',
        status: 'open',
      },
      orders: [buffetOrder('session-1')],
    });

    assert.equal(ctx?.table_id, tableId);
    assert.equal(ctx?.active_session?.id, 'session-1');
    assert.equal(ctx?.recent_orders.length, 1);
  });

  it('returns null when table id does not match', () => {
    assert.equal(
      customerSessionContextFromWaiterDetail('other-table', {
        table: {
          id: tableId,
          display_name: '005',
          sort_order: 1,
        },
        sessionMeta: null,
        orders: [],
      }),
      null,
    );
  });
});

describe('resolveCustomerSessionBootContext', () => {
  const ssrEmpty: CustomerSessionContext = {
    table_id: tableId,
    display_name: '005',
    active_session: null,
    recent_orders: [],
  };

  const publishedModel: WaiterTablePageModel = {
    detail: {
      table: {
        id: tableId,
        display_name: '005',
        sort_order: 1,
      },
      sessionMeta: {
        sessionId: 'session-1',
        openedAt: '2026-01-01T12:00:00.000Z',
        status: 'open',
      },
      orders: [buffetOrder('session-1')],
      checkoutRequested: false,
      checkoutRequestedAt: null,
    },
    buffets: [],
    buffetPricesByBuffetId: {},
  };

  it('prefers published staff model over stale SSR when session is active', () => {
    const boot = resolveCustomerSessionBootContext({
      tableId,
      ssrContext: ssrEmpty,
      publishedModel,
    });
    assert.equal(boot?.active_session?.id, 'session-1');
    assert.equal(boot?.recent_orders.length, 1);
  });

  it('falls back to SSR when published model has no session', () => {
    const boot = resolveCustomerSessionBootContext({
      tableId,
      ssrContext: ssrEmpty,
      publishedModel: {
        ...publishedModel,
        detail: { ...publishedModel.detail, sessionMeta: null, orders: [] },
      },
    });
    assert.deepEqual(boot, ssrEmpty);
  });
});
