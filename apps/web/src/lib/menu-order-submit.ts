import type { AppendCartLineInput, CartItem } from '@/types';
import { coerceCartQty } from '@/lib/cart-totals';
import type { CustomerGeoOrderFailure, CustomerGeoOrderResult } from '@/lib/customer-geo-order';
import type { GuestOrderGateResult } from '@/lib/customer-menu-order-gate';
import type { SessionStatus } from '@/types';

export type MenuOrderSubmitFlow = 'guest' | 'staff_assisted';

export type AppendOrderFailureCode =
  | 'location_too_far'
  | 'location_required'
  | 'session_billing'
  | 'buffet_required'
  | 'rate_limited'
  | 'submit_failed';

export type MenuOrderSubmitSuccess = {
  flow: MenuOrderSubmitFlow;
  orderId: string;
  batchId: string;
  enqueueToken: string;
  sessionId?: string;
};

export type MenuOrderSubmitFailure =
  | { kind: 'gate'; sessionStatus: SessionStatus | null }
  | { kind: 'geo'; reason: CustomerGeoOrderFailure }
  | { kind: 'append'; code: AppendOrderFailureCode }
  | { kind: 'network' };

type AppendApiResponse = {
  error?: string;
  order_id?: string;
  batch_id?: string;
  enqueue_token?: string;
  session_id?: string;
};

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
    case 'rate_limited':
      return 'rate_limited';
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
  latitude?: number;
  longitude?: number;
  waiterFlow: boolean;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; orderId: string; batchId: string; enqueueToken: string; sessionId?: string }
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
  ensureGate: () => Promise<GuestOrderGateResult>;
  resolveGeo: () => Promise<CustomerGeoOrderResult>;
  fetchImpl?: typeof fetch;
}): Promise<MenuOrderSubmitSuccess | MenuOrderSubmitFailure> {
  const gate = await params.ensureGate();
  if (!gate.canPlace) {
    return { kind: 'gate', sessionStatus: gate.sessionStatus };
  }

  const geo = await params.resolveGeo();
  if (!geo.ok) {
    return { kind: 'geo', reason: geo.reason };
  }

  try {
    const append = await postMenuOrderAppend({
      slug: params.slug,
      tableId: params.tableId,
      items: appendCartLinesFromCart(params.cart),
      latitude: geo.latitude,
      longitude: geo.longitude,
      waiterFlow: params.waiterFlow,
      fetchImpl: params.fetchImpl,
    });
    if (!append.ok) {
      return { kind: 'append', code: append.code };
    }

    return {
      flow: params.flow,
      orderId: append.orderId,
      batchId: append.batchId,
      enqueueToken: append.enqueueToken,
      sessionId: append.sessionId,
    };
  } catch {
    return { kind: 'network' };
  }
}
