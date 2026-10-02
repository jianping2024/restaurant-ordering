import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimAppendIdempotency,
  completeAppendIdempotency,
  releaseAppendIdempotencyClaim,
} from '@/lib/append-idempotency';
import { loadAppendWriteContext } from '@/lib/append-write-context';
import { writeAppendBatch } from '@/lib/append-write-batch';
import { coerceCartPrice } from '@/lib/cart-totals';
import { orderEnqueueSecret, signOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { resolveAppendCartItems } from '@/lib/resolve-append-cart-items';
import { enqueueStationTicketsForOrder } from '@/lib/station-ticket-enqueue';
import {
  parseSushiRoundSettingsFromRestaurantRow,
  type SushiRoundSettings,
} from '@/lib/table-order-round/settings';
import {
  isCooldownActive,
  isCooldownExpired,
  isSubmitDeadlinePassed,
  roundCapTotal,
} from '@/lib/table-order-round/status';
import type {
  RoundSnapshot,
  TableOrderRoundErrorCode,
  TableOrderRoundLineRow,
  TableOrderRoundRow,
} from '@/lib/table-order-round/types';
import { aggregateRoundLinesForAppend } from '@/lib/table-order-round/aggregate-lines';
import type { RoundLineQtyMode } from '@/lib/table-order-round/round-line-identity';
import { sessionGuestCountForLimits } from '@/lib/sushi-buffet-limits';
import type { OrderItem } from '@/types';
import { isSushiBuffetMode, type BuffetServiceMode } from '@mesa/shared';

const ROUND_SELECT =
  'id, restaurant_id, session_id, table_id, status, guest_count_snapshot, per_person_cap, submit_request_id, submit_requested_at, submit_deadline_at, cooldown_until, append_client_request_id, created_at, updated_at';

const LINE_SELECT = 'id, round_id, menu_item_id, qty, guest_client_id, note, added_at';

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: TableOrderRoundErrorCode | string };

function asRound(row: unknown): TableOrderRoundRow | null {
  if (!row || typeof row !== 'object') return null;
  return row as TableOrderRoundRow;
}

function sumLineQty(lines: Array<{ qty: number }>): number {
  let total = 0;
  for (const line of lines) {
    const q = Number(line.qty);
    if (Number.isFinite(q) && q > 0) total += Math.floor(q);
  }
  return total;
}

export async function loadRestaurantSushiRoundSettings(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<SushiRoundSettings> {
  const { data } = await admin
    .from('restaurants')
    .select(
      'sushi_round_ordering_enabled, sushi_per_person_per_round_cap, sushi_round_confirm_timeout_seconds, sushi_round_cooldown_seconds, sushi_menu_vegetarian_filter_enabled, sushi_menu_allergen_filter_enabled',
    )
    .eq('id', restaurantId)
    .maybeSingle();
  return parseSushiRoundSettingsFromRestaurantRow(data ?? undefined);
}

/** Sole print path after free-round append: reuse station-ticket enqueue (client does not). */
async function enqueueStationTicketsAfterRoundFinalize(params: {
  admin: SupabaseClient;
  restaurantId: string;
  orderId: string;
  batchId: string;
}): Promise<void> {
  const { admin, restaurantId, orderId, batchId } = params;
  try {
    const { data: restaurant, error } = await admin
      .from('restaurants')
      .select('id, name, print_locale, print_agent_config')
      .eq('id', restaurantId)
      .maybeSingle();
    if (error || !restaurant) return;
    await enqueueStationTicketsForOrder({
      admin,
      restaurant: {
        id: restaurantId,
        name: (restaurant.name as string | null) ?? null,
        print_locale: (restaurant.print_locale as string | null) ?? null,
        print_agent_config: restaurant.print_agent_config,
      },
      orderId,
      batchId,
    });
  } catch {
    // Match guest paid-append: order write already succeeded; print enqueue is best-effort.
  }
}

/** Active round for session (collecting / pending_confirm / cooldown / finalize_failed). */
export async function loadActiveRound(
  admin: SupabaseClient,
  sessionId: string,
): Promise<TableOrderRoundRow | null> {
  const { data, error } = await admin
    .from('table_order_rounds')
    .select(ROUND_SELECT)
    .eq('session_id', sessionId)
    .in('status', ['collecting', 'pending_confirm', 'cooldown', 'finalize_failed'])
    .maybeSingle();
  if (error) return null;
  return asRound(data);
}

async function loadRoundLines(
  admin: SupabaseClient,
  roundId: string,
): Promise<TableOrderRoundLineRow[]> {
  const { data } = await admin
    .from('table_order_round_lines')
    .select(LINE_SELECT)
    .eq('round_id', roundId)
    .order('added_at', { ascending: true });
  return (data || []) as TableOrderRoundLineRow[];
}

export async function getRoundSnapshot(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
  settings?: SushiRoundSettings;
  /** Internal: finalizeRound already settled — do not re-enter expiry settle. */
  skipExpirySettle?: boolean;
}): Promise<RoundSnapshot> {
  const settings =
    params.settings ?? (await loadRestaurantSushiRoundSettings(params.admin, params.restaurantId));
  const liveGuestCount = sessionGuestCountForLimits(
    params.sessionOrders as Parameters<typeof sessionGuestCountForLimits>[0],
  );
  let round = await loadActiveRound(params.admin, params.sessionId);

  if (
    !params.skipExpirySettle &&
    round &&
    (round.status === 'pending_confirm' || round.status === 'finalize_failed') &&
    isSubmitDeadlinePassed(round.submit_deadline_at)
  ) {
    const linesForGate = await loadRoundLines(params.admin, round.id);
    if (sumLineQty(linesForGate) < 1) {
      const nowIso = new Date().toISOString();
      await params.admin
        .from('table_order_rounds')
        .update({
          status: 'collecting',
          submit_request_id: null,
          submit_requested_at: null,
          submit_deadline_at: null,
          append_client_request_id: null,
          updated_at: nowIso,
        })
        .eq('id', round.id)
        .in('status', ['pending_confirm', 'finalize_failed']);
    } else {
      await finalizeRound({
        admin: params.admin,
        restaurantId: params.restaurantId,
        sessionId: params.sessionId,
        tableId: round.table_id,
        settings,
        sessionOrders: params.sessionOrders,
        buffetServiceMode: 'sushi',
      });
    }
    round = await loadActiveRound(params.admin, params.sessionId);
  }

  if (!round) {
    return {
      round: null,
      lines: [],
      settings,
      live_guest_count: liveGuestCount,
      round_cap_total: roundCapTotal(settings.sushi_per_person_per_round_cap, liveGuestCount),
      lines_qty_total: 0,
    };
  }

  const lines = await loadRoundLines(params.admin, round.id);
  const linesQty = sumLineQty(lines);
  const capGuests =
    round.status === 'pending_confirm' || round.status === 'finalize_failed'
      ? round.guest_count_snapshot
      : liveGuestCount;
  const perCap =
    round.status === 'pending_confirm' || round.status === 'finalize_failed'
      ? round.per_person_cap
      : settings.sushi_per_person_per_round_cap;

  return {
    round,
    lines,
    settings,
    live_guest_count: liveGuestCount,
    round_cap_total: roundCapTotal(perCap, capGuests),
    lines_qty_total: linesQty,
  };
}

export async function registerGuestClient(
  admin: SupabaseClient,
  params: {
    sessionId: string;
    restaurantId: string;
    guestClientId: string;
    guestCount: number;
  },
): Promise<ServiceResult<{ registered: boolean }>> {
  const { sessionId, restaurantId, guestClientId, guestCount } = params;
  const limit = Math.max(0, Math.floor(guestCount));

  const { data: existing } = await admin
    .from('table_order_round_clients')
    .select('guest_client_id')
    .eq('session_id', sessionId)
    .eq('guest_client_id', guestClientId)
    .maybeSingle();

  if (existing) {
    return { ok: true, data: { registered: true } };
  }

  const { data: clients, error: listErr } = await admin
    .from('table_order_round_clients')
    .select('guest_client_id, registered_at')
    .eq('session_id', sessionId)
    .order('registered_at', { ascending: true });

  if (listErr) {
    return { ok: false, status: 500, error: 'guest_client_query_failed' };
  }

  const count = (clients || []).length;
  if (limit > 0 && count >= limit) {
    return { ok: false, status: 403, error: 'guest_client_limit' };
  }

  const { error: insErr } = await admin.from('table_order_round_clients').insert({
    session_id: sessionId,
    restaurant_id: restaurantId,
    guest_client_id: guestClientId,
  });

  if (insErr) {
    // Race: another insert of same id
    if (insErr.code === '23505') {
      return { ok: true, data: { registered: true } };
    }
    return { ok: false, status: 500, error: 'guest_client_insert_failed' };
  }

  return { ok: true, data: { registered: true } };
}

function statusForRoundLineMutateError(error: string): number {
  if (
    error === 'round_cooldown_active' ||
    error === 'round_basket_locked' ||
    error === 'round_not_collecting' ||
    error === 'round_confirm_pending'
  ) {
    return 409;
  }
  if (error === 'line_not_owned') return 403;
  if (error === 'round_not_found' || error === 'line_not_found') return 404;
  return 400;
}

/** Sole guest round-line upsert: RPC serializes session writes + meal/round caps. */
export async function upsertRoundLine(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  guestClientId: string;
  menuItemId: string;
  qty: number;
  note?: string | null;
  /** set = absolute qty (核单); add = accumulate onto matching note line (购物车下单). */
  qtyMode?: RoundLineQtyMode;
  /** Caller must verify price === 0 from menu row. */
  priceIsFree: boolean;
  settings: SushiRoundSettings;
  liveGuestCount: number;
  /** Non-voided session qty for this menu item (already kitchen). */
  sessionOrderedQty: number;
  /** Guest meal free-cap gate (false for unlimited free dishes). */
  applyMealLimit: boolean;
  perPersonMealLimit: number | null;
}): Promise<ServiceResult<{ line: TableOrderRoundLineRow; snapshot: RoundSnapshot }>> {
  const {
    admin,
    restaurantId,
    sessionId,
    tableId,
    guestClientId,
    menuItemId,
    qty,
    note: noteRaw,
    qtyMode = 'set',
    priceIsFree,
    settings,
    liveGuestCount,
    sessionOrderedQty,
    applyMealLimit,
    perPersonMealLimit,
  } = params;

  if (!settings.sushi_round_ordering_enabled) {
    return { ok: false, status: 400, error: 'sushi_round_disabled' };
  }
  if (!priceIsFree) {
    return { ok: false, status: 400, error: 'menu_item_not_free' };
  }
  if (liveGuestCount < 1) {
    return { ok: false, status: 400, error: 'guest_count_required' };
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, status: 400, error: 'invalid_qty' };
  }
  if (applyMealLimit && (perPersonMealLimit == null || perPersonMealLimit < 1)) {
    return { ok: false, status: 400, error: 'over_limit_price_missing' };
  }

  const reg = await registerGuestClient(admin, {
    sessionId,
    restaurantId,
    guestClientId,
    guestCount: liveGuestCount,
  });
  if (!reg.ok) return reg;

  const { data: rpcData, error: rpcErr } = await admin.rpc('upsert_table_order_round_line', {
    p_restaurant_id: restaurantId,
    p_session_id: sessionId,
    p_table_id: tableId,
    p_guest_client_id: guestClientId,
    p_menu_item_id: menuItemId,
    p_qty: qty,
    p_note: typeof noteRaw === 'string' ? noteRaw : '',
    p_qty_mode: qtyMode,
    p_live_guest_count: liveGuestCount,
    p_per_person_round_cap: settings.sushi_per_person_per_round_cap,
    p_session_ordered_qty: Math.max(0, Math.floor(sessionOrderedQty)),
    p_apply_meal_limit: applyMealLimit,
    p_per_person_meal_limit: applyMealLimit ? perPersonMealLimit : null,
  });

  if (rpcErr) {
    return { ok: false, status: 500, error: 'line_update_failed' };
  }
  const payload = rpcData as { ok?: boolean; error?: string; line?: TableOrderRoundLineRow } | null;
  if (!payload || payload.ok !== true || !payload.line) {
    const error = typeof payload?.error === 'string' ? payload.error : 'line_update_failed';
    return { ok: false, status: statusForRoundLineMutateError(error), error };
  }

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders: [],
    settings,
  });
  snapshot.live_guest_count = liveGuestCount;
  snapshot.round_cap_total = roundCapTotal(settings.sushi_per_person_per_round_cap, liveGuestCount);

  return { ok: true, data: { line: payload.line, snapshot } };
}

/** Sole guest round-line delete under the same session advisory lock as upsert. */
export async function deleteOwnRoundLine(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  guestClientId: string;
  lineId: string;
  settings: SushiRoundSettings;
  liveGuestCount: number;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
}): Promise<ServiceResult<{ snapshot: RoundSnapshot }>> {
  const { admin, restaurantId, sessionId, guestClientId, lineId, settings, liveGuestCount, sessionOrders } =
    params;

  const { data: rpcData, error: rpcErr } = await admin.rpc('delete_table_order_round_line', {
    p_session_id: sessionId,
    p_guest_client_id: guestClientId,
    p_line_id: lineId,
  });
  if (rpcErr) {
    return { ok: false, status: 500, error: 'line_delete_failed' };
  }
  const payload = rpcData as { ok?: boolean; error?: string } | null;
  if (!payload || payload.ok !== true) {
    const error = typeof payload?.error === 'string' ? payload.error : 'line_delete_failed';
    return { ok: false, status: statusForRoundLineMutateError(error), error };
  }

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders,
    settings,
  });
  snapshot.live_guest_count = liveGuestCount;
  return { ok: true, data: { snapshot } };
}

export async function submitRequest(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  guestClientId: string;
  settings: SushiRoundSettings;
  liveGuestCount: number;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
}): Promise<ServiceResult<{ snapshot: RoundSnapshot }>> {
  const { admin, restaurantId, sessionId, guestClientId, settings, liveGuestCount, sessionOrders } =
    params;

  const reg = await registerGuestClient(admin, {
    sessionId,
    restaurantId,
    guestClientId,
    guestCount: liveGuestCount,
  });
  if (!reg.ok) return reg;

  const round = await loadActiveRound(admin, sessionId);
  if (!round) {
    return { ok: false, status: 404, error: 'round_not_found' };
  }
  if (round.status === 'pending_confirm') {
    return { ok: false, status: 409, error: 'round_confirm_pending' };
  }
  if (isCooldownActive(round.status, round.cooldown_until)) {
    return { ok: false, status: 409, error: 'round_cooldown_active' };
  }
  if (round.status !== 'collecting') {
    return { ok: false, status: 409, error: 'round_not_collecting' };
  }

  const lines = await loadRoundLines(admin, round.id);
  if (sumLineQty(lines) < 1) {
    return { ok: false, status: 400, error: 'round_empty' };
  }

  const now = Date.now();
  const submitRequestId = randomUUID();
  const appendClientRequestId = randomUUID();
  const deadline = new Date(now + settings.sushi_round_confirm_timeout_seconds * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: updated, error } = await admin
    .from('table_order_rounds')
    .update({
      status: 'pending_confirm',
      guest_count_snapshot: liveGuestCount,
      per_person_cap: settings.sushi_per_person_per_round_cap,
      submit_request_id: submitRequestId,
      submit_requested_at: nowIso,
      submit_deadline_at: deadline,
      append_client_request_id: appendClientRequestId,
      updated_at: nowIso,
    })
    .eq('id', round.id)
    .eq('status', 'collecting')
    .select(ROUND_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: 'submit_request_failed' };
  }
  if (!updated) {
    return { ok: false, status: 409, error: 'round_confirm_pending' };
  }

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders,
    settings,
  });
  return { ok: true, data: { snapshot } };
}

export async function finalizeRound(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  settings: SushiRoundSettings;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
  /** When true, skip deadline gate (internal only — prefer deadline path). */
  force?: boolean;
  buffetServiceMode?: BuffetServiceMode | string | null;
  displayName?: string;
}): Promise<
  ServiceResult<{
    snapshot: RoundSnapshot;
    order_id?: string;
    batch_id?: string;
    enqueue_token?: string;
    idempotent_replay?: boolean;
  }>
> {
  const { admin, restaurantId, sessionId, tableId, settings, force } = params;

  const round = await loadActiveRound(admin, sessionId);
  if (!round) {
    return { ok: false, status: 404, error: 'round_not_found' };
  }

  // Idempotent success: already in cooldown with append id
  if (
    round.status === 'cooldown' &&
    round.append_client_request_id &&
    !isCooldownExpired(round.status, round.cooldown_until)
  ) {
    const snapshot = await getRoundSnapshot({
      admin,
      restaurantId,
      sessionId,
      sessionOrders: params.sessionOrders,
      settings,
      skipExpirySettle: true,
    });
    const { data: idemRow } = await admin
      .from('order_append_idempotency')
      .select('order_id, batch_id, status')
      .eq('session_id', sessionId)
      .eq('client_request_id', round.append_client_request_id)
      .maybeSingle();
    const orderId =
      idemRow?.status === 'completed' && typeof idemRow.order_id === 'string'
        ? idemRow.order_id
        : undefined;
    const batchId =
      idemRow?.status === 'completed' && typeof idemRow.batch_id === 'string'
        ? idemRow.batch_id
        : undefined;
    return {
      ok: true,
      data: {
        snapshot,
        order_id: orderId,
        batch_id: batchId,
        idempotent_replay: true,
      },
    };
  }

  if (round.status !== 'pending_confirm' && round.status !== 'finalize_failed') {
    return { ok: false, status: 409, error: 'round_not_pending_confirm' };
  }

  if (!force && round.status === 'pending_confirm') {
    if (!isSubmitDeadlinePassed(round.submit_deadline_at)) {
      return { ok: false, status: 409, error: 'finalize_not_ready' };
    }
  }

  const lines = await loadRoundLines(admin, round.id);
  if (sumLineQty(lines) < 1) {
    return { ok: false, status: 400, error: 'round_empty' };
  }

  const clientRequestId = round.append_client_request_id || randomUUID();
  if (!round.append_client_request_id) {
    await admin
      .from('table_order_rounds')
      .update({ append_client_request_id: clientRequestId, updated_at: new Date().toISOString() })
      .eq('id', round.id);
  }

  const rawItems = aggregateRoundLinesForAppend(lines);

  const writeContext = await loadAppendWriteContext(admin, restaurantId, tableId);
  if (!writeContext.ok) {
    return { ok: false, status: writeContext.status, error: writeContext.error };
  }

  const secret = orderEnqueueSecret();
  if (!secret) {
    return { ok: false, status: 503, error: 'server_misconfigured' };
  }

  const claim = await claimAppendIdempotency({
    admin,
    restaurantId,
    sessionId,
    clientRequestId,
  });

  if (claim.kind === 'error') {
    return { ok: false, status: claim.status, error: claim.error };
  }

  if (claim.kind === 'in_progress') {
    return { ok: false, status: 409, error: 'append_in_progress' };
  }

  if (claim.kind === 'replay') {
    const enqueue_token = signOrderEnqueueToken(
      {
        restaurant_id: restaurantId,
        order_id: claim.result.orderId,
        batch_id: claim.result.batchId,
      },
      secret,
    );
    // Ensure cooldown state
    const nowIso = new Date().toISOString();
    const cooldownUntil = new Date(
      Date.now() + settings.sushi_round_cooldown_seconds * 1000,
    ).toISOString();
    await admin
      .from('table_order_rounds')
      .update({
        status: 'cooldown',
        cooldown_until: cooldownUntil,
        updated_at: nowIso,
      })
      .eq('id', round.id)
      .in('status', ['pending_confirm', 'finalize_failed', 'cooldown']);

    // Replay may follow a prior write that never printed; pending/processing dedupe skips dupes.
    await enqueueStationTicketsAfterRoundFinalize({
      admin,
      restaurantId,
      orderId: claim.result.orderId,
      batchId: claim.result.batchId,
    });

    const snapshot = await getRoundSnapshot({
      admin,
      restaurantId,
      sessionId,
      sessionOrders: params.sessionOrders,
      settings,
      skipExpirySettle: true,
    });
    return {
      ok: true,
      data: {
        snapshot,
        order_id: claim.result.orderId,
        batch_id: claim.result.batchId,
        enqueue_token,
        idempotent_replay: true,
      },
    };
  }

  let resolved;
  try {
    resolved = await resolveAppendCartItems({
      admin,
      restaurantId,
      rawItems,
      buffetServiceMode: params.buffetServiceMode ?? 'sushi',
      staffAssisted: false,
      sessionOrders: writeContext.context.sessionOrders,
    });
  } catch {
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
    return { ok: false, status: 500, error: 'menu_items_query_failed' };
  }

  if (!resolved.ok) {
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
    return { ok: false, status: 400, error: resolved.error };
  }

  let displayName = params.displayName;
  if (!displayName) {
    const { data: tableRow } = await admin
      .from('restaurant_tables')
      .select('display_name')
      .eq('id', tableId)
      .maybeSingle();
    displayName = (tableRow?.display_name as string) || '';
  }

  const writeResult = await writeAppendBatch({
    admin,
    restaurantId,
    tableId,
    displayName,
    sessionId,
    context: writeContext.context,
    newItems: resolved.items,
  });

  if (!writeResult.ok) {
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
    await admin
      .from('table_order_rounds')
      .update({ status: 'finalize_failed', updated_at: new Date().toISOString() })
      .eq('id', round.id)
      .in('status', ['pending_confirm', 'finalize_failed']);
    return { ok: false, status: writeResult.status, error: 'append_failed' };
  }

  await completeAppendIdempotency({
    admin,
    sessionId,
    clientRequestId,
    orderId: writeResult.orderId,
    batchId: resolved.batchId,
    hadDoneBefore: writeResult.hadDoneBefore,
    isFirstOrder: writeResult.isFirstOrder,
    lineCount: resolved.items.length,
  });

  const nowIso = new Date().toISOString();
  const cooldownUntil = new Date(
    Date.now() + settings.sushi_round_cooldown_seconds * 1000,
  ).toISOString();

  const { data: cooled } = await admin
    .from('table_order_rounds')
    .update({
      status: 'cooldown',
      cooldown_until: cooldownUntil,
      append_client_request_id: clientRequestId,
      updated_at: nowIso,
    })
    .eq('id', round.id)
    .in('status', ['pending_confirm', 'finalize_failed'])
    .select(ROUND_SELECT)
    .maybeSingle();

  // If condition update lost the race, another finalize won — still ok if cooldown
  if (!cooled) {
    const again = await loadActiveRound(admin, sessionId);
    if (again?.status !== 'cooldown') {
      // Append already written; mark cooldown best-effort
      await admin
        .from('table_order_rounds')
        .update({
          status: 'cooldown',
          cooldown_until: cooldownUntil,
          append_client_request_id: clientRequestId,
          updated_at: nowIso,
        })
        .eq('id', round.id);
    }
  }

  const enqueue_token = signOrderEnqueueToken(
    {
      restaurant_id: restaurantId,
      order_id: writeResult.orderId,
      batch_id: resolved.batchId,
    },
    secret,
  );

  await enqueueStationTicketsAfterRoundFinalize({
    admin,
    restaurantId,
    orderId: writeResult.orderId,
    batchId: resolved.batchId,
  });

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders: writeContext.context.sessionOrders,
    settings,
    skipExpirySettle: true,
  });

  return {
    ok: true,
    data: {
      snapshot,
      order_id: writeResult.orderId,
      batch_id: resolved.batchId,
      enqueue_token,
      idempotent_replay: false,
    },
  };
}

/**
 * Guest public append must not accept free dishes when sushi round is enabled.
 * Finalize calls writeAppendBatch directly (not HTTP).
 */
export function assertSushiGuestFreeItemsRequireRound(params: {
  waiterFlow: boolean;
  buffetServiceMode: unknown;
  sushiRoundOrderingEnabled: boolean;
  resolvedItems: Array<{ price?: number | null }>;
}): { ok: true } | { ok: false; error: 'sushi_round_required' } {
  if (params.waiterFlow) return { ok: true };
  if (!isSushiBuffetMode(params.buffetServiceMode)) return { ok: true };
  if (!params.sushiRoundOrderingEnabled) return { ok: true };
  const hasFree = params.resolvedItems.some((item) => Number(item.price) === 0);
  if (hasFree) {
    return { ok: false, error: 'sushi_round_required' };
  }
  return { ok: true };
}

export async function loadMenuItemForRoundLine(
  admin: SupabaseClient,
  restaurantId: string,
  menuItemId: string,
): Promise<
  | {
      ok: true;
      price: number;
      available: boolean;
      per_person_qty_limit: number | null;
      over_limit_unit_price: number | null;
    }
  | { ok: false; error: 'menu_item_not_found' | 'menu_items_query_failed' }
> {
  const { data, error } = await admin
    .from('menu_items')
    .select('id, price, available, per_person_qty_limit, over_limit_unit_price')
    .eq('restaurant_id', restaurantId)
    .eq('id', menuItemId)
    .maybeSingle();
  if (error) return { ok: false, error: 'menu_items_query_failed' };
  if (!data) return { ok: false, error: 'menu_item_not_found' };
  const rawLimit = data.per_person_qty_limit;
  const perPersonQtyLimit =
    typeof rawLimit === 'number' && Number.isInteger(rawLimit) && rawLimit >= 1 ? rawLimit : null;
  const rawOver = data.over_limit_unit_price;
  const overLimitUnitPrice =
    typeof rawOver === 'number' && Number.isFinite(rawOver) && rawOver >= 0 ? rawOver : null;
  return {
    ok: true,
    price: coerceCartPrice(data.price),
    available: data.available === true,
    per_person_qty_limit: perPersonQtyLimit,
    over_limit_unit_price: overLimitUnitPrice,
  };
}
