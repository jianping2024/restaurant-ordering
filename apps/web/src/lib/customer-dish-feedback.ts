import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildByItemSplitOrderLines } from '@/lib/bill-split-by-item-lines';
import { loadActiveBillSplitForSession } from '@/lib/checkout-active-bill-split';
import {
  parseDishFeedbackReasons,
  type DishFeedbackReasonKey,
  type ParsedDishFeedbackItem,
} from '@/lib/dish-feedback-reasons';
import { mineByItemFeedbackOrderKeys } from '@/lib/guest-reviewable-items';
import { loadIndividualTickets } from '@/lib/individual-checkout-reads';
import { isBuffetBaseItem } from '@/lib/order-items';
import type { DishFeedbackVote, Order, SplitPerson } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export type { ParsedDishFeedbackItem };

export type DishFeedbackDraftRow = {
  menu_item_id: string;
  vote: DishFeedbackVote;
  reasons: DishFeedbackReasonKey[];
};

export type DishFeedbackState = {
  submitted: boolean;
  skipped: boolean;
  votes: DishFeedbackDraftRow[];
};

type FeedbackSessionRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: string;
};

export type CustomerDishFeedbackContext =
  | { ok: true; restaurantId: string; session: FeedbackSessionRow }
  | { ok: false; status: number; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function optionalMenuItemIdField(line: object): string {
  const raw = (line as { menu_item_id?: unknown }).menu_item_id;
  return typeof raw === 'string' ? raw.trim() : '';
}

function sessionOrderMenuKeys(orders: ReadonlyArray<Order>): {
  orderIds: Set<string>;
  allowed: Set<string>;
} {
  const allowed = new Set<string>();
  const orderIds = new Set<string>();
  for (const order of orders) {
    if (typeof order.id !== 'string') continue;
    orderIds.add(order.id);
    const lines = Array.isArray(order.items) ? order.items : [];
    for (const line of lines) {
      if (!line || typeof line !== 'object') continue;
      if (isBuffetBaseItem(line)) continue;
      const fromField = optionalMenuItemIdField(line);
      const fromId = typeof line.id === 'string' ? line.id.trim() : '';
      const menuId =
        fromField && isUuid(fromField)
          ? fromField
          : fromId && isUuid(fromId)
            ? fromId
            : '';
      if (menuId) allowed.add(`${order.id}:${menuId}`);
    }
  }
  return { orderIds, allowed };
}

function orderIdForMenuItem(
  orders: ReadonlyArray<Order>,
  menuItemId: string,
  fallbackOrderId: string,
): string {
  for (const order of orders) {
    if (typeof order.id !== 'string') continue;
    for (const line of order.items ?? []) {
      if (!line || typeof line !== 'object') continue;
      const fromField = optionalMenuItemIdField(line);
      const fromId = typeof line.id === 'string' ? line.id.trim() : '';
      if (fromField === menuItemId || fromId === menuItemId) return order.id;
    }
  }
  return fallbackOrderId;
}

export async function resolveCustomerDishFeedbackContext(params: {
  admin: SupabaseClient;
  restaurantId: string;
  tableIdParam: string | null;
}): Promise<CustomerDishFeedbackContext> {
  const tableId = parseTableIdParam(params.tableIdParam);
  if (!tableId) {
    return { ok: false, status: 400, error: 'invalid_table_id' };
  }

  const { data: table, error: tableErr } = await params.admin
    .from('restaurant_tables')
    .select('id')
    .eq('restaurant_id', params.restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (tableErr || !table) {
    return { ok: false, status: 404, error: 'table_not_available' };
  }

  const { data: session, error: sessionErr } = await params.admin
    .from('table_sessions')
    .select('id, restaurant_id, table_id, status')
    .eq('restaurant_id', params.restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .maybeSingle();
  if (sessionErr || !session) {
    return { ok: false, status: 404, error: 'session_not_available' };
  }

  return {
    ok: true,
    restaurantId: params.restaurantId,
    session: session as FeedbackSessionRow,
  };
}

export async function loadDishFeedbackState(
  admin: SupabaseClient,
  sessionId: string,
): Promise<DishFeedbackState> {
  const [{ data: feedbackSession }, { data: votes }] = await Promise.all([
    admin
      .from('feedback_sessions')
      .select('completed_at, skipped_at')
      .eq('session_id', sessionId)
      .maybeSingle(),
    admin
      .from('dish_feedback')
      .select('menu_item_id, vote, reasons')
      .eq('session_id', sessionId),
  ]);

  const draft: DishFeedbackDraftRow[] = [];
  for (const row of votes ?? []) {
    const menuItemId =
      typeof row.menu_item_id === 'string' ? row.menu_item_id.trim() : '';
    if (!menuItemId || !isUuid(menuItemId)) continue;
    const vote = row.vote === 'up' || row.vote === 'down' ? row.vote : null;
    if (!vote) continue;
    draft.push({
      menu_item_id: menuItemId,
      vote,
      reasons: vote === 'down' ? parseDishFeedbackReasons(row.reasons) : [],
    });
  }

  return {
    submitted: !!feedbackSession?.completed_at,
    skipped: !!feedbackSession?.skipped_at,
    votes: draft,
  };
}

/** Mark the bill-success feedback surface as shown (idempotent upsert). */
export async function markDishFeedbackShown(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const nowIso = new Date().toISOString();
  const { error } = await params.admin.from('feedback_sessions').upsert(
    {
      restaurant_id: params.restaurantId,
      session_id: params.sessionId,
      source: 'bill_success',
      shown_at: nowIso,
    },
    { onConflict: 'session_id' },
  );
  if (error) {
    return { ok: false, status: 500, error: 'feedback_shown_failed' };
  }
  return { ok: true };
}

export async function skipDishFeedback(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const nowIso = new Date().toISOString();
  const { error } = await params.admin.from('feedback_sessions').upsert(
    {
      restaurant_id: params.restaurantId,
      session_id: params.sessionId,
      source: 'bill_success',
      shown_at: nowIso,
      skipped_at: nowIso,
    },
    { onConflict: 'session_id' },
  );
  if (error) {
    return { ok: false, status: 500, error: 'feedback_skip_failed' };
  }
  return { ok: true };
}

export async function submitDishFeedback(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  items: ParsedDishFeedbackItem[];
  /** Required when the active plan is by_item — scopes allowed dishes to this phone's tickets. */
  guestClientId?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: orders, error: ordersErr } = await params.admin
    .from('orders')
    .select('id, items, created_at')
    .eq('restaurant_id', params.restaurantId)
    .eq('session_id', params.sessionId);
  if (ordersErr) {
    return { ok: false, status: 500, error: 'orders_load_failed' };
  }

  const typedOrders = (orders ?? []) as Order[];
  const { orderIds, allowed: sessionAllowed } = sessionOrderMenuKeys(typedOrders);
  let allowedExact = sessionAllowed;
  let allowedMenuIds: Set<string> | null = null;

  const split = await loadActiveBillSplitForSession({
    admin: params.admin,
    restaurantId: params.restaurantId,
    sessionId: params.sessionId,
  });
  if (split?.split_mode === 'by_item') {
    const guestClientId =
      typeof params.guestClientId === 'string' ? params.guestClientId.trim() : '';
    if (!guestClientId) {
      return { ok: false, status: 400, error: 'invalid_guest_client_id' };
    }
    const tickets = await loadIndividualTickets(params.admin, {
      billSplitId: split.id,
      clientId: guestClientId,
    });
    const mineTicketKeys = new Set(
      tickets.filter((ticket) => ticket.mine).map((ticket) => ticket.ticket_key),
    );
    const fallbackOrderId = typedOrders[0]?.id ?? '';
    const catalogByLineKey = new Map<string, { menuItemId: string; orderId: string }>();
    for (const line of buildByItemSplitOrderLines(typedOrders)) {
      if (isBuffetBaseItem(line) || line.item_status === 'voided') continue;
      const key = typeof line.key === 'string' ? line.key.trim() : '';
      if (!key || !isUuid(line.id) || catalogByLineKey.has(key)) continue;
      const orderId =
        line.order_id && orderIds.has(line.order_id)
          ? line.order_id
          : orderIdForMenuItem(typedOrders, line.id, fallbackOrderId);
      catalogByLineKey.set(key, {
        menuItemId: line.id,
        orderId,
      });
    }
    const mineAllowed = mineByItemFeedbackOrderKeys({
      persons: (Array.isArray(split.persons) ? split.persons : []) as SplitPerson[],
      mineTicketKeys,
      catalogByLineKey,
    });
    allowedMenuIds = new Set<string>();
    for (const key of Array.from(mineAllowed)) {
      const sep = key.indexOf(':');
      if (sep < 0) continue;
      const menuId = key.slice(sep + 1);
      if (
        menuId &&
        Array.from(sessionAllowed).some((row) => row.endsWith(`:${menuId}`))
      ) {
        allowedMenuIds.add(menuId);
      }
    }
    allowedExact = new Set();
  }

  for (const item of params.items) {
    if (!orderIds.has(item.order_id)) {
      return { ok: false, status: 400, error: 'order_not_in_session' };
    }
    if (allowedMenuIds) {
      if (!allowedMenuIds.has(item.menu_item_id)) {
        return { ok: false, status: 400, error: 'menu_item_not_on_ticket' };
      }
      continue;
    }
    if (!allowedExact.has(`${item.order_id}:${item.menu_item_id}`)) {
      return { ok: false, status: 400, error: 'menu_item_not_on_order' };
    }
  }

  const nowIso = new Date().toISOString();
  const rows = params.items.map((item) => ({
    restaurant_id: params.restaurantId,
    session_id: params.sessionId,
    order_id: item.order_id,
    menu_item_id: item.menu_item_id,
    vote: item.vote,
    reasons: item.vote === 'down' ? item.reasons : [],
  }));

  const { error: upsertVotesErr } = await params.admin
    .from('dish_feedback')
    .upsert(rows, { onConflict: 'session_id,menu_item_id' });
  if (upsertVotesErr) {
    return { ok: false, status: 500, error: 'feedback_submit_failed' };
  }

  const { error: sessionErr } = await params.admin.from('feedback_sessions').upsert(
    {
      restaurant_id: params.restaurantId,
      session_id: params.sessionId,
      source: 'bill_success',
      shown_at: nowIso,
      completed_at: nowIso,
      skipped_at: null,
    },
    { onConflict: 'session_id' },
  );
  if (sessionErr) {
    return { ok: false, status: 500, error: 'feedback_submit_failed' };
  }

  return { ok: true };
}
