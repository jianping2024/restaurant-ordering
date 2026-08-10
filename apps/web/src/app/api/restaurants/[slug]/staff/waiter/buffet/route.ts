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
import { AUDIT_EVENT, scheduleRecordAudit, staffAuditActor } from '@/lib/audit';
import { logJsonConsoleEvent } from '@/lib/json-console-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

type WaiterBuffetFailureLog = {
  slug: string;
  restaurant_id?: string;
  user_id?: string;
  table_id?: string;
  intent?: string;
  buffet_count?: number;
  parse_table_id?: boolean;
  parse_intent?: boolean;
  parse_buffets?: boolean;
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
      buffets?: unknown;
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
    const parsedBuffets = parseBuffetWaiterRequestBody(body.buffets);
    const intent = parseBuffetWaiterOpenIntent(body.intent);

    if (!tableId || !parsedBuffets.ok || !intent) {
      return respondWaiterBuffetFailure({
        slug,
        restaurant_id: ctx.restaurant_id,
        user_id: ctx.user_id,
        table_id: tableId ?? undefined,
        intent: typeof body.intent === 'string' ? body.intent : undefined,
        buffet_count: Array.isArray(body.buffets) ? body.buffets.length : undefined,
        parse_table_id: Boolean(tableId),
        parse_intent: Boolean(intent),
        parse_buffets: parsedBuffets.ok,
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
        buffet_count: parsedBuffets.buffets.length,
        status: 503,
        error: 'server_misconfigured',
      });
    }

    const result = await runBuffetWaiterOpenPipeline(admin, {
      restaurantId: ctx.restaurant_id,
      userId: ctx.user_id,
      tableId,
      buffets: parsedBuffets.buffets,
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
            buffet_count: parsedBuffets.buffets.length,
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
        buffet_count: parsedBuffets.buffets.length,
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
      scheduleRecordAudit(admin, AUDIT_EVENT.SESSION_OPENED, {
        restaurantId: ctx.restaurant_id,
        actor: staffAuditActor(ctx.user_id, ctx.role_name || ctx.role, ctx.role),
        context: {
          sessionId: result.sessionId,
          tableName: result.tableName || '—',
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
