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
import {
  parseSushiRoundSettingsFromRestaurantRow,
  type SushiRoundSettings,
} from '@/lib/table-order-round/settings';
import {
  canMutateRoundLines,
  isCooldownActive,
  isCooldownExpired,
  isDeferCooldownActive,
  isRoundBasketLocked,
  isSubmitDeadlinePassed,
  roundCapTotal,
} from '@/lib/table-order-round/status';
import type {
  RoundSnapshot,
  TableOrderRoundErrorCode,
  TableOrderRoundLineRow,
  TableOrderRoundRow,
  TableOrderRoundVoteRow,
  TableOrderRoundVoteValue,
} from '@/lib/table-order-round/types';
import { sessionGuestCountForLimits } from '@/lib/sushi-buffet-limits';
import { isSushiBuffetMode, type BuffetServiceMode } from '@mesa/shared';
import type { OrderItem } from '@/types';

const ROUND_SELECT =
  'id, restaurant_id, session_id, table_id, status, guest_count_snapshot, per_person_cap, submit_request_id, submit_requested_at, submit_deadline_at, defer_used_at, defer_cooldown_until, cooldown_until, append_client_request_id, created_at, updated_at';

const LINE_SELECT = 'id, round_id, menu_item_id, qty, guest_client_id, added_at';
const VOTE_SELECT = 'id, round_id, submit_request_id, guest_client_id, vote, voted_at';

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
      'sushi_round_ordering_enabled, sushi_per_person_per_round_cap, sushi_round_confirm_timeout_seconds, sushi_round_cooldown_seconds, sushi_round_defer_cooldown_seconds',
    )
    .eq('id', restaurantId)
    .maybeSingle();
  return parseSushiRoundSettingsFromRestaurantRow(data ?? undefined);
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

async function loadRoundVotes(
  admin: SupabaseClient,
  roundId: string,
  submitRequestId: string | null,
): Promise<TableOrderRoundVoteRow[]> {
  if (!submitRequestId) return [];
  const { data } = await admin
    .from('table_order_round_votes')
    .select(VOTE_SELECT)
    .eq('round_id', roundId)
    .eq('submit_request_id', submitRequestId);
  return (data || []) as TableOrderRoundVoteRow[];
}

export async function getRoundSnapshot(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
  settings?: SushiRoundSettings;
}): Promise<RoundSnapshot> {
  const settings =
    params.settings ?? (await loadRestaurantSushiRoundSettings(params.admin, params.restaurantId));
  const liveGuestCount = sessionGuestCountForLimits(
    params.sessionOrders as Parameters<typeof sessionGuestCountForLimits>[0],
  );
  const round = await loadActiveRound(params.admin, params.sessionId);
  if (!round) {
    return {
      round: null,
      lines: [],
      votes: [],
      settings,
      live_guest_count: liveGuestCount,
      round_cap_total: roundCapTotal(settings.sushi_per_person_per_round_cap, liveGuestCount),
      lines_qty_total: 0,
    };
  }

  const lines = await loadRoundLines(params.admin, round.id);
  const votes = await loadRoundVotes(params.admin, round.id, round.submit_request_id);
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
    votes,
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

async function closeExpiredCooldownRound(
  admin: SupabaseClient,
  round: TableOrderRoundRow,
): Promise<void> {
  if (!isCooldownExpired(round.status, round.cooldown_until)) return;
  await admin
    .from('table_order_rounds')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', round.id)
    .eq('status', 'cooldown');
}

export async function upsertRoundLine(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  guestClientId: string;
  menuItemId: string;
  qty: number;
  /** Caller must verify price === 0 from menu row. */
  priceIsFree: boolean;
  settings: SushiRoundSettings;
  liveGuestCount: number;
}): Promise<ServiceResult<{ line: TableOrderRoundLineRow; snapshot: RoundSnapshot }>> {
  const {
    admin,
    restaurantId,
    sessionId,
    tableId,
    guestClientId,
    menuItemId,
    qty,
    priceIsFree,
    settings,
    liveGuestCount,
  } = params;

  if (!settings.sushi_round_ordering_enabled) {
    return { ok: false, status: 400, error: 'sushi_round_disabled' };
  }
  if (!priceIsFree) {
    return { ok: false, status: 400, error: 'menu_item_not_free' };
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, status: 400, error: 'invalid_qty' };
  }

  const reg = await registerGuestClient(admin, {
    sessionId,
    restaurantId,
    guestClientId,
    guestCount: liveGuestCount,
  });
  if (!reg.ok) return reg;

  let round = await loadActiveRound(admin, sessionId);
  if (round && isCooldownActive(round.status, round.cooldown_until)) {
    return { ok: false, status: 409, error: 'round_cooldown_active' };
  }
  if (round && isCooldownExpired(round.status, round.cooldown_until)) {
    await closeExpiredCooldownRound(admin, round);
    round = null;
  }

  if (round && isRoundBasketLocked(round.status)) {
    return { ok: false, status: 409, error: 'round_basket_locked' };
  }
  if (round && round.status === 'finalize_failed') {
    return { ok: false, status: 409, error: 'round_basket_locked' };
  }
  if (round && !canMutateRoundLines(round.status)) {
    return { ok: false, status: 409, error: 'round_not_collecting' };
  }

  if (!round) {
    const nowIso = new Date().toISOString();
    const { data: created, error: createErr } = await admin
      .from('table_order_rounds')
      .insert({
        restaurant_id: restaurantId,
        session_id: sessionId,
        table_id: tableId,
        status: 'collecting',
        guest_count_snapshot: liveGuestCount,
        per_person_cap: settings.sushi_per_person_per_round_cap,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(ROUND_SELECT)
      .single();
    if (createErr || !created) {
      // Concurrent create — reload
      round = await loadActiveRound(admin, sessionId);
      if (!round || !canMutateRoundLines(round.status)) {
        return { ok: false, status: 500, error: 'round_create_failed' };
      }
    } else {
      round = asRound(created)!;
    }
  }

  const existingLines = await loadRoundLines(admin, round.id);
  const otherQty = sumLineQty(
    existingLines.filter(
      (l) => !(l.menu_item_id === menuItemId && l.guest_client_id === guestClientId),
    ),
  );
  const nextTotal = otherQty + qty;
  const cap = roundCapTotal(settings.sushi_per_person_per_round_cap, liveGuestCount);
  if (nextTotal > cap) {
    return { ok: false, status: 400, error: 'round_cap_exceeded' };
  }

  const existing = existingLines.find(
    (l) => l.menu_item_id === menuItemId && l.guest_client_id === guestClientId,
  );

  let line: TableOrderRoundLineRow;
  if (existing) {
    const { data: updated, error } = await admin
      .from('table_order_round_lines')
      .update({ qty })
      .eq('id', existing.id)
      .select(LINE_SELECT)
      .single();
    if (error || !updated) {
      return { ok: false, status: 500, error: 'line_update_failed' };
    }
    line = updated as TableOrderRoundLineRow;
  } else {
    const { data: inserted, error } = await admin
      .from('table_order_round_lines')
      .insert({
        round_id: round.id,
        menu_item_id: menuItemId,
        qty,
        guest_client_id: guestClientId,
      })
      .select(LINE_SELECT)
      .single();
    if (error || !inserted) {
      return { ok: false, status: 500, error: 'line_insert_failed' };
    }
    line = inserted as TableOrderRoundLineRow;
  }

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders: [],
    settings,
  });
  // Preserve live guest count passed in (caller has session orders).
  snapshot.live_guest_count = liveGuestCount;
  snapshot.round_cap_total = roundCapTotal(settings.sushi_per_person_per_round_cap, liveGuestCount);

  return { ok: true, data: { line, snapshot } };
}

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

  const round = await loadActiveRound(admin, sessionId);
  if (!round) {
    return { ok: false, status: 404, error: 'round_not_found' };
  }
  if (isRoundBasketLocked(round.status) || round.status === 'finalize_failed') {
    return { ok: false, status: 409, error: 'round_basket_locked' };
  }
  if (!canMutateRoundLines(round.status)) {
    return { ok: false, status: 409, error: 'round_not_collecting' };
  }

  const { data: line, error } = await admin
    .from('table_order_round_lines')
    .select(LINE_SELECT)
    .eq('id', lineId)
    .eq('round_id', round.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: 'line_query_failed' };
  }
  if (!line) {
    return { ok: false, status: 404, error: 'line_not_found' };
  }
  if ((line as TableOrderRoundLineRow).guest_client_id !== guestClientId) {
    return { ok: false, status: 403, error: 'line_not_owned' };
  }

  const { error: delErr } = await admin.from('table_order_round_lines').delete().eq('id', lineId);
  if (delErr) {
    return { ok: false, status: 500, error: 'line_delete_failed' };
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
  if (!canMutateRoundLines(round.status)) {
    return { ok: false, status: 409, error: 'round_not_collecting' };
  }
  if (isDeferCooldownActive(round.defer_cooldown_until)) {
    return { ok: false, status: 409, error: 'round_defer_cooldown' };
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

  // Submitter is already requesting kitchen — count as confirm.
  await admin.from('table_order_round_votes').upsert(
    {
      round_id: (updated as TableOrderRoundRow).id,
      submit_request_id: submitRequestId,
      guest_client_id: guestClientId,
      vote: 'confirm',
      voted_at: nowIso,
    },
    { onConflict: 'round_id,submit_request_id,guest_client_id' },
  );

  const quorum = Math.max(0, liveGuestCount);
  if (quorum <= 1) {
    const finalized = await finalizeRound({
      admin,
      restaurantId,
      sessionId,
      tableId: (updated as TableOrderRoundRow).table_id,
      settings,
      sessionOrders,
      force: true,
      buffetServiceMode: 'sushi',
    });
    if (finalized.ok) {
      return { ok: true, data: { snapshot: finalized.data.snapshot } };
    }
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

export async function castVote(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  guestClientId: string;
  vote: Extract<TableOrderRoundVoteValue, 'confirm' | 'defer'>;
  settings: SushiRoundSettings;
  liveGuestCount: number;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
  buffetServiceMode?: BuffetServiceMode | string | null;
  displayName?: string;
}): Promise<
  ServiceResult<{
    snapshot: RoundSnapshot;
    finalized?: boolean;
    deferred?: boolean;
    enqueue_token?: string;
    order_id?: string;
  }>
> {
  const {
    admin,
    restaurantId,
    sessionId,
    guestClientId,
    vote,
    settings,
    liveGuestCount,
    sessionOrders,
  } = params;

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
  if (round.status !== 'pending_confirm') {
    return { ok: false, status: 409, error: 'round_not_pending_confirm' };
  }
  if (!round.submit_request_id) {
    return { ok: false, status: 500, error: 'submit_request_missing' };
  }

  if (vote === 'defer') {
    if (round.defer_used_at) {
      return { ok: false, status: 409, error: 'round_defer_already_used' };
    }
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const deferUntil = new Date(
      now + settings.sushi_round_defer_cooldown_seconds * 1000,
    ).toISOString();

    const { data: deferred, error: deferErr } = await admin
      .from('table_order_rounds')
      .update({
        status: 'collecting',
        defer_used_at: nowIso,
        defer_cooldown_until: deferUntil,
        submit_request_id: null,
        submit_requested_at: null,
        submit_deadline_at: null,
        append_client_request_id: null,
        updated_at: nowIso,
      })
      .eq('id', round.id)
      .eq('status', 'pending_confirm')
      .select(ROUND_SELECT)
      .maybeSingle();

    if (deferErr) {
      return { ok: false, status: 500, error: 'defer_failed' };
    }
    if (!deferred) {
      return { ok: false, status: 409, error: 'round_not_pending_confirm' };
    }

    await admin
      .from('table_order_round_votes')
      .delete()
      .eq('round_id', round.id)
      .eq('submit_request_id', round.submit_request_id);

    const snapshot = await getRoundSnapshot({
      admin,
      restaurantId,
      sessionId,
      sessionOrders,
      settings,
    });
    return { ok: true, data: { snapshot, finalized: false, deferred: true } };
  }

  // confirm
  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await admin.from('table_order_round_votes').upsert(
    {
      round_id: round.id,
      submit_request_id: round.submit_request_id,
      guest_client_id: guestClientId,
      vote: 'confirm',
      voted_at: nowIso,
    },
    { onConflict: 'round_id,submit_request_id,guest_client_id' },
  );
  if (upsertErr) {
    return { ok: false, status: 500, error: 'vote_failed' };
  }

  const votes = await loadRoundVotes(admin, round.id, round.submit_request_id);
  const confirmCount = votes.filter((v) => v.vote === 'confirm').length;
  const quorum = Math.max(0, round.guest_count_snapshot);

  if (quorum > 0 && confirmCount >= quorum) {
    const finalized = await finalizeRound({
      admin,
      restaurantId,
      sessionId,
      tableId: round.table_id,
      settings,
      sessionOrders,
      force: true,
      buffetServiceMode: params.buffetServiceMode,
      displayName: params.displayName,
    });
    if (!finalized.ok) {
      const snapshot = await getRoundSnapshot({
        admin,
        restaurantId,
        sessionId,
        sessionOrders,
        settings,
      });
      return { ok: true, data: { snapshot, finalized: false } };
    }
    return {
      ok: true,
      data: {
        snapshot: finalized.data.snapshot,
        finalized: true,
        enqueue_token: finalized.data.enqueue_token,
        order_id: finalized.data.order_id,
      },
    };
  }

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders,
    settings,
  });
  return { ok: true, data: { snapshot, finalized: false } };
}

export async function finalizeRound(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  settings: SushiRoundSettings;
  sessionOrders: Array<{ items?: OrderItem[] | null; status: string }>;
  /** When true, skip quorum/deadline gate (internal after full confirm). */
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
    });
    return { ok: true, data: { snapshot, idempotent_replay: true } };
  }

  if (round.status !== 'pending_confirm' && round.status !== 'finalize_failed') {
    return { ok: false, status: 409, error: 'round_not_pending_confirm' };
  }

  if (!force && round.status === 'pending_confirm') {
    const votes = await loadRoundVotes(admin, round.id, round.submit_request_id);
    if (votes.some((v) => v.vote === 'defer')) {
      return { ok: false, status: 409, error: 'round_not_pending_confirm' };
    }
    const confirmCount = votes.filter((v) => v.vote === 'confirm').length;
    const quorum = Math.max(0, round.guest_count_snapshot);
    const ready =
      (quorum > 0 && confirmCount >= quorum) || isSubmitDeadlinePassed(round.submit_deadline_at);
    if (!ready) {
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

  // Aggregate by menu_item_id
  const qtyByItem = new Map<string, number>();
  for (const line of lines) {
    qtyByItem.set(line.menu_item_id, (qtyByItem.get(line.menu_item_id) || 0) + line.qty);
  }
  const rawItems = Array.from(qtyByItem.entries()).map(([menu_item_id, qty]) => ({
    menu_item_id,
    qty,
  }));

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

    const snapshot = await getRoundSnapshot({
      admin,
      restaurantId,
      sessionId,
      sessionOrders: params.sessionOrders,
      settings,
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

  const snapshot = await getRoundSnapshot({
    admin,
    restaurantId,
    sessionId,
    sessionOrders: writeContext.context.sessionOrders,
    settings,
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
  | { ok: true; price: number; available: boolean }
  | { ok: false; error: 'menu_item_not_found' | 'menu_items_query_failed' }
> {
  const { data, error } = await admin
    .from('menu_items')
    .select('id, price, available')
    .eq('restaurant_id', restaurantId)
    .eq('id', menuItemId)
    .maybeSingle();
  if (error) return { ok: false, error: 'menu_items_query_failed' };
  if (!data) return { ok: false, error: 'menu_item_not_found' };
  return {
    ok: true,
    price: coerceCartPrice(data.price),
    available: data.available === true,
  };
}
