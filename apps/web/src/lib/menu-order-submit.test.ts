import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CartItem } from '@/types';
import {
  appendCartFingerprint,
  appendCartLinesFromCart,
  appendFailureNeedsSessionRefresh,
  createAppendClientRequestId,
  executeMenuOrderSubmit,
  mapAppendErrorCode,
  postMenuOrderAppend,
  resolveAppendClientRequestId,
} from './menu-order-submit';
import { parseAppendClientRequestId } from './append-idempotency';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

describe('menu-order-submit', () => {
  it('createAppendClientRequestId mints RFC4122 v4 via getRandomValues when randomUUID is missing', () => {
    const original = globalThis.crypto;
    const seed = Uint8Array.from({ length: 16 }, (_, i) => i);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(target: Uint8Array) {
          target.set(seed);
          return target;
        },
      },
    });
    try {
      const id = createAppendClientRequestId();
      assert.equal(id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
      assert.equal(parseAppendClientRequestId(id), id);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });

  it('createAppendClientRequestId prefers randomUUID when available', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () => REQUEST_ID,
        getRandomValues() {
          throw new Error('getRandomValues should not run');
        },
      },
    });
    try {
      assert.equal(createAppendClientRequestId(), REQUEST_ID);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });

  it('createAppendClientRequestId throws when crypto uuid APIs are unavailable', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    try {
      assert.throws(() => createAppendClientRequestId(), /crypto_uuid_unavailable/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: original,
      });
    }
  });

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
    assert.equal(mapAppendErrorCode('rate_limited'), 'rate_limited');
    assert.equal(mapAppendErrorCode('append_in_progress'), 'append_in_progress');
    assert.equal(mapAppendErrorCode('invalid_client_request_id'), 'invalid_client_request_id');
    assert.equal(mapAppendErrorCode('unknown'), 'submit_failed');
  });

  it('appendFailureNeedsSessionRefresh is true only for session_billing', () => {
    assert.equal(appendFailureNeedsSessionRefresh('session_billing'), true);
    assert.equal(appendFailureNeedsSessionRefresh('buffet_required'), false);
  });

  it('resolveAppendClientRequestId reuses id when cart fingerprint matches', () => {
    const cart: CartItem[] = [
      {
        menuItemId: 'dish-1',
        name_pt: 'Bacalhau',
        price: 10,
        qty: 1,
        note: '',
        notePresetKeys: [],
      },
    ];
    const fingerprint = appendCartFingerprint(cart);
    const first = resolveAppendClientRequestId({
      cart,
      previous: null,
      createId: () => REQUEST_ID,
    });
    assert.equal(first.clientRequestId, REQUEST_ID);
    assert.equal(first.reused, false);
    assert.equal(first.fingerprint, fingerprint);

    const second = resolveAppendClientRequestId({
      cart,
      previous: { clientRequestId: REQUEST_ID, fingerprint },
      createId: () => '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(second.clientRequestId, REQUEST_ID);
    assert.equal(second.reused, true);
  });

  it('resolveAppendClientRequestId mints a new id when cart changes', () => {
    const cartA: CartItem[] = [
      {
        menuItemId: 'dish-1',
        name_pt: 'A',
        price: 1,
        qty: 1,
        note: '',
        notePresetKeys: [],
      },
    ];
    const cartB: CartItem[] = [
      {
        menuItemId: 'dish-2',
        name_pt: 'B',
        price: 2,
        qty: 1,
        note: '',
        notePresetKeys: [],
      },
    ];
    const next = resolveAppendClientRequestId({
      cart: cartB,
      previous: {
        clientRequestId: REQUEST_ID,
        fingerprint: appendCartFingerprint(cartA),
      },
      createId: () => '33333333-3333-4333-8333-333333333333',
    });
    assert.equal(next.clientRequestId, '33333333-3333-4333-8333-333333333333');
    assert.equal(next.reused, false);
  });

  it('parseAppendClientRequestId accepts uuids only', () => {
    assert.equal(parseAppendClientRequestId(REQUEST_ID), REQUEST_ID);
    assert.equal(parseAppendClientRequestId('not-a-uuid'), null);
    assert.equal(parseAppendClientRequestId(undefined), null);
  });

  it('executeMenuOrderSubmit stops at gate when ordering is blocked', async () => {
    const result = await executeMenuOrderSubmit({
      flow: 'guest',
      cart: [],
      slug: 'cafe',
      tableId: 'table-1',
      waiterFlow: false,
      clientRequestId: REQUEST_ID,
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
      clientRequestId: REQUEST_ID,
      ensureGate: async () => ({ canPlace: true, sessionStatus: 'open' }),
      resolveGeo: async () => ({ ok: true }),
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { client_request_id?: string };
        assert.equal(body.client_request_id, REQUEST_ID);
        return new Response(
          JSON.stringify({
            order_id: 'order-1',
            batch_id: 'batch-1',
            enqueue_token: 'token-1',
            session_id: 'session-1',
            idempotent_replay: false,
          }),
          { status: 200 },
        );
      },
    });

    assert.deepEqual(result, {
      flow: 'staff_assisted',
      orderId: 'order-1',
      batchId: 'batch-1',
      enqueueToken: 'token-1',
      sessionId: 'session-1',
      clientRequestId: REQUEST_ID,
      idempotentReplay: false,
    });
  });

  it('postMenuOrderAppend maps HTTP errors', async () => {
    const result = await postMenuOrderAppend({
      slug: 'cafe',
      tableId: 'table-1',
      items: [{ menu_item_id: 'dish-1', qty: 1 }],
      clientRequestId: REQUEST_ID,
      waiterFlow: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'buffet_required' }), { status: 403 }),
    });
    assert.deepEqual(result, { ok: false, code: 'buffet_required' });
  });

  it('postMenuOrderAppend maps rate_limited', async () => {
    const result = await postMenuOrderAppend({
      slug: 'cafe',
      tableId: 'table-1',
      items: [{ menu_item_id: 'dish-1', qty: 1 }],
      clientRequestId: REQUEST_ID,
      waiterFlow: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { 'Retry-After': '42' },
        }),
    });
    assert.deepEqual(result, { ok: false, code: 'rate_limited' });
  });

  it('executeMenuOrderSubmit keeps clientRequestId on network failure', async () => {
    const result = await executeMenuOrderSubmit({
      flow: 'guest',
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
      waiterFlow: false,
      clientRequestId: REQUEST_ID,
      ensureGate: async () => ({ canPlace: true, sessionStatus: 'open' }),
      resolveGeo: async () => ({ ok: true }),
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    assert.deepEqual(result, { kind: 'network', clientRequestId: REQUEST_ID });
  });
});
