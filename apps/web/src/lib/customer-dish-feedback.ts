import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseDishFeedbackReasons,
  type DishFeedbackReasonKey,
  type ParsedDishFeedbackItem,
} from '@/lib/dish-feedback-reasons';
import type { DishFeedbackVote } from '@/types';
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
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: orders, error: ordersErr } = await params.admin
    .from('orders')
    .select('id, items')
    .eq('restaurant_id', params.restaurantId)
    .eq('session_id', params.sessionId);
  if (ordersErr) {
    return { ok: false, status: 500, error: 'orders_load_failed' };
  }

  const allowed = new Set<string>();
  const orderIds = new Set<string>();
  for (const order of orders ?? []) {
    if (typeof order.id !== 'string') continue;
    orderIds.add(order.id);
    const lines = Array.isArray(order.items) ? order.items : [];
    for (const line of lines) {
      if (!line || typeof line !== 'object') continue;
      const row = line as { menu_item_id?: unknown; id?: unknown; kind?: unknown };
      if (row.kind === 'buffet_base') continue;
      const fromField =
        typeof row.menu_item_id === 'string' ? row.menu_item_id.trim() : '';
      const fromId = typeof row.id === 'string' ? row.id.trim() : '';
      const menuId =
        fromField && isUuid(fromField)
          ? fromField
          : fromId && isUuid(fromId)
            ? fromId
            : '';
      if (menuId) allowed.add(`${order.id}:${menuId}`);
    }
  }

  for (const item of params.items) {
    if (!orderIds.has(item.order_id)) {
      return { ok: false, status: 400, error: 'order_not_in_session' };
    }
    if (!allowed.has(`${item.order_id}:${item.menu_item_id}`)) {
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
