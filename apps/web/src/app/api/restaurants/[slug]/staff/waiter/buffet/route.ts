import { NextResponse } from 'next/server';
import { tableSessionOpenAuthFromRequest } from '@/lib/staff-api-auth';
import { parseBuffetWaiterOpenIntent } from '@/lib/buffet-waiter-open-intent';
import {
  parseBuffetWaiterRequestBody,
  runBuffetWaiterOpenPipeline,
} from '@/lib/buffet-waiter-pipeline';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyFailure,
} from '@/lib/dependency-unavailable';
import { dependencyUnavailableJsonResponse } from '@/lib/dependency-unavailable-response';
import { AUDIT_EVENT, scheduleStaffRecordAudit } from '@/lib/audit';
import { logJsonConsoleEvent } from '@/lib/json-console-log';
import { scheduleOpenTableReceiptPrint } from '@/lib/open-table-receipt-enqueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  loadWaiterOpenableFreshness,
  loadWaiterOpenableSnapshot,
} from '@/lib/buffet-openable-server';
import { loadCheckoutEntrySignals } from '@/lib/buffet-checkout-entry-server';

export const runtime = 'nodejs';

type WaiterBuffetFailureLog = {
  slug: string;
  restaurant_id?: string;
  user_id?: string;
  table_id?: string;
  intent?: string;
  buffet_id?: string;
  parse_table_id?: boolean;
  parse_intent?: boolean;
  parse_buffet?: boolean;
  status: number;
  error: string;
  code?: string;
  message?: string;
};

/**
 * Sole failure exit for POST …/staff/waiter/buffet.
 * Always emits one `[waiter_buffet] {"event":"open_failed",…}` line; optional `body` overrides JSON.
 */
function respondWaiterBuffetFailure(
  fields: WaiterBuffetFailureLog,
  body?: NextResponse,
): NextResponse {
  logJsonConsoleEvent('waiter_buffet', 'open_failed', fields);
  if (body) return body;
  return NextResponse.json(
    { error: fields.error, code: fields.code, message: fields.message },
    { status: fields.status },
  );
}

/**
 * 开台列表 ensure: buffets openable now + buffet_config_version + current slot.
 * `knownVersion` + `knownSlotKey` → `{ unchanged: true }` when both match (same pattern as
 * customer menu-catalog). With `table_id`, always includes checkout-entry signals.
 */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const ctx = await tableSessionOpenAuthFromRequest(req, params.slug);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const tableIdRaw = url.searchParams.get('table_id');
  const tableId = tableIdRaw ? parseTableIdParam(tableIdRaw) : null;
  if (tableIdRaw && !tableId) return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  const knownVersionRaw = url.searchParams.get('knownVersion');
  const knownVersion =
    knownVersionRaw != null && knownVersionRaw !== '' ? Number(knownVersionRaw) : null;
  const knownSlotKey = url.searchParams.get('knownSlotKey');
  try {
    const admin = createAdminClient();
    const [freshness, session] = await Promise.all([
      loadWaiterOpenableFreshness(admin, ctx.restaurant_id),
      tableId
        ? admin
            .from('table_sessions')
            .select('id')
            .eq('restaurant_id', ctx.restaurant_id)
            .eq('table_id', tableId)
            .in('status', ['open', 'billing'])
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const sessionId = (session.data as { id?: string } | null)?.id ?? null;
    const checkoutEntry = sessionId
      ? await loadCheckoutEntrySignals(admin, ctx.restaurant_id, sessionId)
      : null;
    const knownMatches =
      knownVersion != null
      && Number.isFinite(knownVersion)
      && knownSlotKey != null
      && knownSlotKey === freshness.slotKey
      && knownVersion === freshness.version;
    if (knownMatches) {
      return NextResponse.json({
        unchanged: true,
        version: freshness.version,
        slot_key: freshness.slotKey,
        checkout_entry: checkoutEntry,
      });
    }
    const snapshot = await loadWaiterOpenableSnapshot(admin, ctx.restaurant_id);
    return NextResponse.json({
      version: snapshot.version,
      slot_key: snapshot.slotKey,
      buffet_ids: snapshot.openableBuffetIds,
      prices: snapshot.pricesByBuffetId,
      min_guest_count: snapshot.minGuestCountByBuffetId,
      checkout_entry: checkoutEntry,
    });
  } catch (err) {
    if (isDependencyFailure(err)) return dependencyUnavailableJsonResponse();
    return NextResponse.json({ error: 'openable_lookup_failed' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return respondWaiterBuffetFailure({
      slug: '',
      status: 400,
      error: 'missing_slug',
    });
  }

  try {
    const ctx = await tableSessionOpenAuthFromRequest(req, slug);
    if (!ctx) {
      return respondWaiterBuffetFailure({
        slug,
        status: 401,
        error: 'unauthorized',
      });
    }

    let body: {
      table_id?: unknown;
      buffet?: unknown;
      intent?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return respondWaiterBuffetFailure({
        slug,
        restaurant_id: ctx.restaurant_id,
        user_id: ctx.user_id,
        status: 400,
        error: 'invalid_json',
      });
    }

    const tableId = parseTableIdParam(body.table_id);
    const parsedBuffet = parseBuffetWaiterRequestBody(body.buffet);
    const intent = parseBuffetWaiterOpenIntent(body.intent);

    if (!tableId || !parsedBuffet.ok || !intent) {
      return respondWaiterBuffetFailure({
        slug,
        restaurant_id: ctx.restaurant_id,
        user_id: ctx.user_id,
        table_id: tableId ?? undefined,
        intent: typeof body.intent === 'string' ? body.intent : undefined,
        parse_table_id: Boolean(tableId),
        parse_intent: Boolean(intent),
        parse_buffet: parsedBuffet.ok,
        status: 400,
        error: 'invalid_body',
      });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return respondWaiterBuffetFailure({
        slug,
        restaurant_id: ctx.restaurant_id,
        user_id: ctx.user_id,
        table_id: tableId,
        intent,
        buffet_id: parsedBuffet.buffet.buffetId,
        status: 503,
        error: 'server_misconfigured',
      });
    }

    const result = await runBuffetWaiterOpenPipeline(admin, {
      restaurantId: ctx.restaurant_id,
      userId: ctx.user_id,
      tableId,
      buffet: parsedBuffet.buffet,
      intent,
    });

    if (!result.ok) {
      if (result.message && isDependencyFailure(result.message)) {
        return respondWaiterBuffetFailure(
          {
            slug,
            restaurant_id: ctx.restaurant_id,
            user_id: ctx.user_id,
            table_id: tableId,
            intent,
            buffet_id: parsedBuffet.buffet.buffetId,
            status: 503,
            error: DEPENDENCY_UNAVAILABLE,
            code: result.code,
            message: result.message,
          },
          dependencyUnavailableJsonResponse(),
        );
      }
      return respondWaiterBuffetFailure({
        slug,
        restaurant_id: ctx.restaurant_id,
        user_id: ctx.user_id,
        table_id: tableId,
        intent,
        buffet_id: parsedBuffet.buffet.buffetId,
        status: result.status,
        error: result.error,
        code: result.code,
        message: result.message,
      });
    }

    if (
      result.sessionOpened === true &&
      typeof result.sessionId === 'string' &&
      result.sessionId
    ) {
      scheduleStaffRecordAudit(admin, AUDIT_EVENT.SESSION_OPENED, {
        restaurantId: ctx.restaurant_id,
        userId: ctx.user_id,
        role: ctx.role,
        context: {
          sessionId: result.sessionId,
          tableName: result.tableName || '—',
          adultCount: result.adultCount ?? 0,
          childCount: result.childCount ?? 0,
        },
      });
      scheduleOpenTableReceiptPrint({
        admin,
        restaurantId: ctx.restaurant_id,
        sessionId: result.sessionId,
        tableId,
        tableDisplayName: result.tableName || '—',
      });
    } else if (
      result.guestCountChanged === true &&
      typeof result.sessionId === 'string' &&
      result.sessionId
    ) {
      scheduleStaffRecordAudit(admin, AUDIT_EVENT.GUEST_COUNT_CHANGED, {
        restaurantId: ctx.restaurant_id,
        userId: ctx.user_id,
        role: ctx.role,
        context: {
          sessionId: result.sessionId,
          tableName: result.tableName || '—',
          previousAdultCount: result.previousAdultCount ?? 0,
          previousChildCount: result.previousChildCount ?? 0,
          adultCount: result.adultCount ?? 0,
          childCount: result.childCount ?? 0,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      model: result.model,
      ...(result.unchanged ? { unchanged: true } : {}),
    });
  } catch (err) {
    if (isDependencyFailure(err)) {
      return respondWaiterBuffetFailure(
        {
          slug,
          status: 503,
          error: DEPENDENCY_UNAVAILABLE,
          message: err instanceof Error ? err.message : String(err),
        },
        dependencyUnavailableJsonResponse(),
      );
    }
    throw err;
  }
}
