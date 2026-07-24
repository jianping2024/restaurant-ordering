import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import {
  parseBuffetWaiterRequestBody,
  runBuffetWaiterOpenPipeline,
} from '@/lib/buffet-waiter-pipeline';
import { isDependencyFailure } from '@/lib/dependency-unavailable';
import { dependencyUnavailableJsonResponse } from '@/lib/dependency-unavailable-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  try {
    const ctx = await openTableAuthFromRequest(req, slug);
    if (!ctx) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let body: {
      table_id?: unknown;
      buffets?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const tableId = parseTableIdParam(body.table_id);
    const parsedBuffets = parseBuffetWaiterRequestBody(body.buffets);

    if (!tableId || !parsedBuffets.ok) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }

    const result = await runBuffetWaiterOpenPipeline(admin, {
      restaurantId: ctx.restaurant_id,
      userId: ctx.user_id,
      tableId,
      buffets: parsedBuffets.buffets,
    });

    if (!result.ok) {
      if (result.message && isDependencyFailure(result.message)) {
        return dependencyUnavailableJsonResponse();
      }
      return NextResponse.json(
        { error: result.error, code: result.code, message: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      model: result.model,
      ...(result.unchanged ? { unchanged: true } : {}),
    });
  } catch (err) {
    if (isDependencyFailure(err)) {
      return dependencyUnavailableJsonResponse();
    }
    throw err;
  }
}
