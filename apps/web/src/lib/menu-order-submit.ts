import type { AppendCartLineInput, CartItem, Language } from '@/types';
import { coerceCartQty } from '@/lib/cart-totals';
import type { CustomerGeoOrderFailure, CustomerGeoOrderResult } from '@/lib/customer-geo-order';
import type { GuestOrderGateResult } from '@/lib/customer-menu-order-gate';
import type { SessionStatus } from '@/types';
import { logJsonConsoleEvent } from '@/lib/json-console-log';
import { mintBrowserUuid } from '@/lib/browser-uuid';
import {
  composeCartLineNote,
  type MenuNotePresetCatalog,
} from '@/lib/menu-note-presets';

export type MenuOrderSubmitFlow = 'guest' | 'staff_assisted';

export type AppendOrderFailureCode =
  | 'location_too_far'
  | 'location_required'
  | 'session_billing'
  | 'individual_called'
  | 'buffet_required'
  | 'rate_limited'
  | 'append_in_progress'
  | 'invalid_client_request_id'
  | 'per_person_limit_exceeded'
  | 'limited_item_requires_headcount'
  | 'sushi_round_required'
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
  | { kind: 'gate'; sessionStatus: SessionStatus | null; individualHold?: boolean }
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

export type CartNoteComposeContext = {
  catalog: MenuNotePresetCatalog;
  lang: Language;
};

/** Sole cart→wire note (chips + free text). */
export function cartItemWireNote(item: CartItem, ctx: CartNoteComposeContext): string {
  return composeCartLineNote({
    freeText: item.note || '',
    selectedNotePresetIds: item.selectedNotePresetIds || [],
    catalog: ctx.catalog,
    lang: ctx.lang,
  });
}

/** Stable fingerprint so network retries reuse the same client_request_id for one cart. */
export function appendCartFingerprint(cart: CartItem[], ctx: CartNoteComposeContext): string {
  return appendCartLinesFromCart(cart, ctx)
    .map((line) => `${line.menu_item_id}:${line.qty}:${line.note ?? ''}`)
    .join('|');
}

/**
 * Reuse the prior request id when the cart is unchanged (timeout retry);
 * otherwise mint a new intent id.
 */
export function resolveAppendClientRequestId(params: {
  cart: CartItem[];
  noteContext: CartNoteComposeContext;
  previous: { clientRequestId: string; fingerprint: string } | null;
  createId?: () => string;
}): { clientRequestId: string; fingerprint: string; reused: boolean } {
  const fingerprint = appendCartFingerprint(params.cart, params.noteContext);
  if (params.previous && params.previous.fingerprint === fingerprint) {
    return {
      clientRequestId: params.previous.clientRequestId,
      fingerprint,
      reused: true,
    };
  }
  return {
    clientRequestId: (params.createId ?? mintBrowserUuid)(),
    fingerprint,
    reused: false,
  };
}

/** Trusted append lines from local cart state (menu_item_id + qty + note only). */
export function appendCartLinesFromCart(
  cart: CartItem[],
  ctx: CartNoteComposeContext,
): AppendCartLineInput[] {
  return cart.map((c) => {
    const note = cartItemWireNote(c, ctx);
    return {
      menu_item_id: c.menuItemId,
      qty: coerceCartQty(c.qty),
      ...(note ? { note } : {}),
    };
  });
}

export function mapAppendErrorCode(error: string | undefined): AppendOrderFailureCode {
  switch (error) {
    case 'location_too_far':
      return 'location_too_far';
    case 'location_required':
      return 'location_required';
    case 'session_billing':
      return 'session_billing';
    case 'individual_called':
      return 'individual_called';
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
    case 'sushi_round_required':
      return 'sushi_round_required';
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
  /** Guest phone id — lets the server refuse a phone with a called, unpaid ticket. */
  guestClientId?: string | null;
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
      ...(!params.waiterFlow && params.guestClientId
        ? { guest_client_id: params.guestClientId }
        : {}),
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
  noteContext: CartNoteComposeContext;
  slug: string;
  tableId: string;
  waiterFlow: boolean;
  clientRequestId: string;
  guestClientId?: string | null;
  ensureGate: () => Promise<GuestOrderGateResult>;
  resolveGeo: () => Promise<CustomerGeoOrderResult>;
  fetchImpl?: typeof fetch;
}): Promise<MenuOrderSubmitSuccess | MenuOrderSubmitFailure> {
  const { clientRequestId } = params;

  const gate = await params.ensureGate();
  if (!gate.canPlace) {
    return {
      kind: 'gate',
      sessionStatus: gate.sessionStatus,
      ...(gate.individualHold ? { individualHold: true } : {}),
    };
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
      items: appendCartLinesFromCart(params.cart, params.noteContext),
      clientRequestId,
      latitude: geo.latitude,
      longitude: geo.longitude,
      waiterFlow: params.waiterFlow,
      guestClientId: params.guestClientId,
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
