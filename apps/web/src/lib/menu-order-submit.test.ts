import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CartItem } from '@/types';
import {
  appendCartLinesFromCart,
  appendFailureNeedsSessionRefresh,
  executeMenuOrderSubmit,
  mapAppendErrorCode,
  postMenuOrderAppend,
} from './menu-order-submit';

describe('menu-order-submit', () => {
  it('appendCartLinesFromCart maps trusted cart fields only', () => {
    const cart: CartItem[] = [
      {
        menuItemId: 'dish-1',
        name_pt: 'Bacalhau',
        price: 12.5,
        qty: 2,
        note: '  sem cebola ',
        notePresetKeys: [],
      },
    ];
    assert.deepEqual(appendCartLinesFromCart(cart), [
      { menu_item_id: 'dish-1', qty: 2, note: 'sem cebola' },
    ]);
  });

  it('mapAppendErrorCode maps known append errors', () => {
    assert.equal(mapAppendErrorCode('session_billing'), 'session_billing');
    assert.equal(mapAppendErrorCode('unknown'), 'submit_failed');
  });

  it('appendFailureNeedsSessionRefresh is true only for session_billing', () => {
    assert.equal(appendFailureNeedsSessionRefresh('session_billing'), true);
    assert.equal(appendFailureNeedsSessionRefresh('buffet_required'), false);
  });

  it('executeMenuOrderSubmit stops at gate when ordering is blocked', async () => {
    const result = await executeMenuOrderSubmit({
      flow: 'guest',
      cart: [],
      slug: 'cafe',
      tableId: 'table-1',
      waiterFlow: false,
      ensureGate: async () => ({ canPlace: false, sessionStatus: 'billing' }),
      resolveGeo: async () => {
        throw new Error('geo should not run');
      },
    });
    assert.deepEqual(result, { kind: 'gate', sessionStatus: 'billing' });
  });

  it('executeMenuOrderSubmit returns append success for staff flow', async () => {
    const result = await executeMenuOrderSubmit({
      flow: 'staff_assisted',
      cart: [
        {
          menuItemId: 'dish-1',
          name_pt: 'Bacalhau',
          price: 10,
          qty: 1,
          note: '',
          notePresetKeys: [],
        },
      ],
      slug: 'cafe',
      tableId: 'table-1',
      waiterFlow: true,
      ensureGate: async () => ({ canPlace: true, sessionStatus: 'open' }),
      resolveGeo: async () => ({ ok: true }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            order_id: 'order-1',
            batch_id: 'batch-1',
            enqueue_token: 'token-1',
            session_id: 'session-1',
          }),
          { status: 200 },
        ),
    });

    assert.deepEqual(result, {
      flow: 'staff_assisted',
      orderId: 'order-1',
      batchId: 'batch-1',
      enqueueToken: 'token-1',
      sessionId: 'session-1',
    });
  });

  it('postMenuOrderAppend maps HTTP errors', async () => {
    const result = await postMenuOrderAppend({
      slug: 'cafe',
      tableId: 'table-1',
      items: [{ menu_item_id: 'dish-1', qty: 1 }],
      waiterFlow: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'buffet_required' }), { status: 403 }),
    });
    assert.deepEqual(result, { ok: false, code: 'buffet_required' });
  });
});
