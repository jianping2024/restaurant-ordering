import 'server-only';

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrderRestaurant, type OrderRestaurantContext } from '@/lib/order-restaurant-context';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { loadAppendWriteContext, type AppendWriteContext } from '@/lib/append-write-context';
import { parseGuestClientId } from '@/lib/table-order-round/guest-client';
import { tableOrderRoundRateLimitCheck } from '@/lib/table-order-round/rate-limit';
import { loadRestaurantSushiRoundSettings } from '@/lib/table-order-round/service';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';
import { sessionGuestCountForLimits } from '@/lib/sushi-buffet-limits';
import { isSushiBuffetMode } from '@mesa/shared';

/** Sole API context loader for table-order-round routes. */
export type TableOrderRoundApiContext = {
  admin: SupabaseClient;
  restaurant: OrderRestaurantContext;
  settings: SushiRoundSettings;
  tableId: string;
  displayName: string;
  guestClientId: string | null;
  writeContext: AppendWriteContext;
  liveGuestCount: number;
};

export async function loadTableOrderRoundContext(params: {
  slug: string;
  tableIdRaw: unknown;
  guestClientIdRaw?: unknown;
  requireGuestClient?: boolean;
}): Promise<
  | { ok: true; ctx: TableOrderRoundApiContext }
  | { ok: false; response: NextResponse }
> {
  const { slug, tableIdRaw, guestClientIdRaw, requireGuestClient } = params;
  if (!slug) {
    return { ok: false, response: NextResponse.json({ error: 'missing_slug' }, { status: 400 }) };
  }

  const tableId = parseTableIdParam(tableIdRaw);
  if (!tableId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid_table_id' }, { status: 400 }),
    };
  }

  let guestClientId: string | null = null;
  if (guestClientIdRaw !== undefined && guestClientIdRaw !== null && guestClientIdRaw !== '') {
    guestClientId = parseGuestClientId(guestClientIdRaw);
    if (!guestClientId) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'invalid_guest_client_id' }, { status: 400 }),
      };
    }
  }
  if (requireGuestClient && !guestClientId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid_guest_client_id' }, { status: 400 }),
    };
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'server_misconfigured' }, { status: 503 }),
    };
  }

  const resolvedRestaurant = await resolveOrderRestaurant(admin, slug, 'guest');
  if (!resolvedRestaurant.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: resolvedRestaurant.error },
        { status: resolvedRestaurant.status },
      ),
    };
  }
  const restaurant = resolvedRestaurant.restaurant;

  if (!isSushiBuffetMode(restaurant.buffetServiceMode)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'sushi_round_disabled' }, { status: 400 }),
    };
  }

  const settings = await loadRestaurantSushiRoundSettings(admin, restaurant.restaurantId);
  if (!settings.sushi_round_ordering_enabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'sushi_round_disabled' }, { status: 400 }),
    };
  }

  const { data: tableRow } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurant.restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!tableRow) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'table_not_available' }, { status: 400 }),
    };
  }

  const writeContext = await loadAppendWriteContext(admin, restaurant.restaurantId, tableId);
  if (!writeContext.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: writeContext.error }, { status: writeContext.status }),
    };
  }

  const sessionId = writeContext.context.session.id as string;
  const rl = tableOrderRoundRateLimitCheck(sessionId);
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      admin,
      restaurant,
      settings,
      tableId,
      displayName: tableRow.display_name as string,
      guestClientId,
      writeContext: writeContext.context,
      liveGuestCount: sessionGuestCountForLimits(writeContext.context.sessionOrders),
    },
  };
}

export function roundSnapshotJson(snapshot: {
  round: unknown;
  lines: unknown;
  votes: unknown;
  settings: SushiRoundSettings;
  live_guest_count: number;
  round_cap_total: number;
  lines_qty_total: number;
}) {
  return {
    ok: true as const,
    round: snapshot.round,
    lines: snapshot.lines,
    votes: snapshot.votes,
    settings: snapshot.settings,
    live_guest_count: snapshot.live_guest_count,
    round_cap_total: snapshot.round_cap_total,
    lines_qty_total: snapshot.lines_qty_total,
  };
}

/** @deprecated alias — prefer roundSnapshotJson */
export const roundSnapshotResponse = roundSnapshotJson;
