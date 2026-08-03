import type { AppendCartLineInput, CartItem } from '@/types';
import { coerceCartQty } from '@/lib/cart-totals';
import type { CustomerGeoOrderFailure, CustomerGeoOrderResult } from '@/lib/customer-geo-order';
import type { GuestOrderGateResult } from '@/lib/customer-menu-order-gate';
import type { SessionStatus } from '@/types';
import { logJsonConsoleEvent } from '@/lib/json-console-log';

export type MenuOrderSubmitFlow = 'guest' | 'staff_assisted';

export type AppendOrderFailureCode =
  | 'location_too_far'
  | 'location_required'
  | 'session_billing'
  | 'buffet_required'
  | 'rate_limited'
  | 'append_in_progress'
  | 'invalid_client_request_id'
  | 'per_person_limit_exceeded'
  | 'limited_item_requires_headcount'
  | 'submit_failed';

export type MenuOrderSubmitSuccess = {
  flow: MenuOrderSubmitFlow;
  orderId: string;
  batchId: string;
  enqueueToken: string;
  sessionId?: string;
  clientRequestId: string;
  idempotentReplay: boolean;
};

export type MenuOrderSubmitFailure =
  | { kind: 'gate'; sessionStatus: SessionStatus | null }
  | { kind: 'geo'; reason: CustomerGeoOrderFailure }
  | { kind: 'append'; code: AppendOrderFailureCode; clientRequestId: string }
  | { kind: 'network'; clientRequestId: string };

type AppendApiResponse = {
  error?: string;
  order_id?: string;
  batch_id?: string;
  enqueue_token?: string;
  session_id?: string;
  idempotent_replay?: boolean;
};

/** Stable fingerprint so network retries reuse the same client_request_id for one cart. */
export function appendCartFingerprint(cart: CartItem[]): string {
  return appendCartLinesFromCart(cart)
    .map((line) => `${line.menu_item_id}:${line.qty}:${line.note ?? ''}`)
    .join('|');
}

/**
 * Mint append idempotency UUID.
 * Prefer randomUUID; fall back to getRandomValues RFC4122 v4 for non-secure
 * contexts (LAN HTTP) where randomUUID is unavailable.
 */
export function createAppendClientRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('crypto_uuid_unavailable');
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Reuse the prior request id when the cart is unchanged (timeout retry);
 * otherwise mint a new intent id.
 */
export function resolveAppendClientRequestId(params: {
  cart: CartItem[];
  previous: { clientRequestId: string; fingerprint: string } | null;
  createId?: () => string;
}): { clientRequestId: string; fingerprint: string; reused: boolean } {
  const fingerprint = appendCartFingerprint(params.cart);
  if (params.previous && params.previous.fingerprint === fingerprint) {
    return {
      clientRequestId: params.previous.clientRequestId,
      fingerprint,
      reused: true,
    };
  }
  return {
    clientRequestId: (params.createId ?? createAppendClientRequestId)(),
    fingerprint,
    reused: false,
  };
}

/** Trusted append lines from local cart state (menu_item_id + qty + note only). */
export function appendCartLinesFromCart(cart: CartItem[]): AppendCartLineInput[] {
  return cart.map((c) => ({
    menu_item_id: c.menuItemId,
    qty: coerceCartQty(c.qty),
    ...(c.note?.trim() ? { note: c.note.trim() } : {}),
  }));
}

export function mapAppendErrorCode(error: string | undefined): AppendOrderFailureCode {
  switch (error) {
    case 'location_too_far':
      return 'location_too_far';
    case 'location_required':
      return 'location_required';
    case 'session_billing':
      return 'session_billing';
    case 'buffet_required':
      return 'buffet_required';
    case 'per_person_limit_exceeded':
      return 'per_person_limit_exceeded';
    case 'limited_item_requires_headcount':
      return 'limited_item_requires_headcount';
    case 'over_limit_price_missing':
      return 'submit_failed';
    case 'rate_limited':
      return 'rate_limited';
    case 'append_in_progress':
      return 'append_in_progress';
    case 'invalid_client_request_id':
      return 'invalid_client_request_id';
    default:
      return 'submit_failed';
  }
}

export function appendFailureNeedsSessionRefresh(code: AppendOrderFailureCode): boolean {
  return code === 'session_billing';
}

/** POST orders/append — persist cart batch; returns signed enqueue token on success. */
export async function postMenuOrderAppend(params: {
  slug: string;
  tableId: string;
  items: AppendCartLineInput[];
  clientRequestId: string;
  latitude?: number;
  longitude?: number;
  waiterFlow: boolean;
  fetchImpl?: typeof fetch;
}): Promise<
  | {
      ok: true;
      orderId: string;
      batchId: string;
      enqueueToken: string;
      sessionId?: string;
      idempotentReplay: boolean;
    }
  | { ok: false; code: AppendOrderFailureCode }
> {
  const fetchFn = params.fetchImpl ?? fetch;
  const res = await fetchFn(`/api/restaurants/${params.slug}/orders/append`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: params.tableId,
      items: params.items,
      client_request_id: params.clientRequestId,
      latitude: params.latitude,
      longitude: params.longitude,
      waiter_flow: params.waiterFlow,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as AppendApiResponse;
  if (!res.ok) {
    return { ok: false, code: mapAppendErrorCode(data.error) };
  }

  const orderId = data.order_id;
  const batchId = data.batch_id;
  const enqueueToken = data.enqueue_token;
  if (!orderId || !batchId || !enqueueToken) {
    return { ok: false, code: 'submit_failed' };
  }

  return {
    ok: true,
    orderId,
    batchId,
    enqueueToken,
    sessionId: data.session_id,
    idempotentReplay: data.idempotent_replay === true,
  };
}

/**
 * Menu order submit pipeline: gate → geo (guest) → append.
 * Post-submit UI and side effects stay in the caller / outcome helpers.
 */
export async function executeMenuOrderSubmit(params: {
  flow: MenuOrderSubmitFlow;
  cart: CartItem[];
  slug: string;
  tableId: string;
  waiterFlow: boolean;
  clientRequestId: string;
  ensureGate: () => Promise<GuestOrderGateResult>;
  resolveGeo: () => Promise<CustomerGeoOrderResult>;
  fetchImpl?: typeof fetch;
}): Promise<MenuOrderSubmitSuccess | MenuOrderSubmitFailure> {
  const { clientRequestId } = params;

  const gate = await params.ensureGate();
  if (!gate.canPlace) {
    return { kind: 'gate', sessionStatus: gate.sessionStatus };
  }

  const geo = await params.resolveGeo();
  if (!geo.ok) {
    return { kind: 'geo', reason: geo.reason };
  }

  const lineCount = params.cart.length;
  logJsonConsoleEvent('order_append', 'client_submit_start', {
    client_request_id: clientRequestId,
    table_id: params.tableId,
    slug: params.slug,
    waiter_flow: params.waiterFlow,
    line_count: lineCount,
  });

  try {
    const append = await postMenuOrderAppend({
      slug: params.slug,
      tableId: params.tableId,
      items: appendCartLinesFromCart(params.cart),
      clientRequestId,
      latitude: geo.latitude,
      longitude: geo.longitude,
      waiterFlow: params.waiterFlow,
      fetchImpl: params.fetchImpl,
    });
    if (!append.ok) {
      logJsonConsoleEvent('order_append', 'client_submit_failed', {
        client_request_id: clientRequestId,
        table_id: params.tableId,
        slug: params.slug,
        waiter_flow: params.waiterFlow,
        error: append.code,
      });
      return { kind: 'append', code: append.code, clientRequestId };
    }

    logJsonConsoleEvent('order_append', 'client_submit_ok', {
      client_request_id: clientRequestId,
      table_id: params.tableId,
      slug: params.slug,
      order_id: append.orderId,
      batch_id: append.batchId,
      session_id: append.sessionId,
      waiter_flow: params.waiterFlow,
      idempotent_replay: append.idempotentReplay,
      line_count: lineCount,
    });

    return {
      flow: params.flow,
      orderId: append.orderId,
      batchId: append.batchId,
      enqueueToken: append.enqueueToken,
      sessionId: append.sessionId,
      clientRequestId,
      idempotentReplay: append.idempotentReplay,
    };
  } catch {
    logJsonConsoleEvent('order_append', 'client_submit_network', {
      client_request_id: clientRequestId,
      table_id: params.tableId,
      slug: params.slug,
      waiter_flow: params.waiterFlow,
    });
    return { kind: 'network', clientRequestId };
  }
}
