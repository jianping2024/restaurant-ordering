import { NextResponse } from 'next/server';
import {
  loadDishFeedbackState,
  markDishFeedbackShown,
  resolveCustomerDishFeedbackContext,
  skipDishFeedback,
  submitDishFeedback,
} from '@/lib/customer-dish-feedback';
import { parseDishFeedbackSubmitItems } from '@/lib/dish-feedback-reasons';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type Bucket = { count: number; windowStart: number };
const ipBuckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  let b = ipBuckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { count: 0, windowStart: now };
    ipBuckets.set(key, b);
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
}

async function adminOr503() {
  try {
    return { ok: true as const, admin: createAdminClient() };
  } catch {
    return { ok: false as const };
  }
}

/** Hydrate + mark shown. Sole guest read/write entry with POST. */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }
  if (!rateLimitOk(clientIpFromRequest(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const adminRes = await adminOr503();
  if (!adminRes.ok) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }
  const { admin } = adminRes;

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const tableIdParam = new URL(req.url).searchParams.get('table_id');
  const ctx = await resolveCustomerDishFeedbackContext({
    admin,
    restaurantId: loaded.restaurant.id,
    tableIdParam,
  });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const shown = await markDishFeedbackShown({
    admin,
    restaurantId: ctx.restaurantId,
    sessionId: ctx.session.id,
  });
  if (!shown.ok) {
    return NextResponse.json({ error: shown.error }, { status: shown.status });
  }

  const state = await loadDishFeedbackState(admin, ctx.session.id);
  return NextResponse.json({
    session_id: ctx.session.id,
    submitted: state.submitted,
    skipped: state.skipped,
    votes: state.votes,
  });
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }
  if (!rateLimitOk(clientIpFromRequest(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: { table_id?: unknown; action?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = body.action === 'skip' || body.action === 'submit' ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const adminRes = await adminOr503();
  if (!adminRes.ok) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }
  const { admin } = adminRes;

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const tableIdParam =
    typeof body.table_id === 'string' ? body.table_id : null;
  const ctx = await resolveCustomerDishFeedbackContext({
    admin,
    restaurantId: loaded.restaurant.id,
    tableIdParam,
  });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (action === 'skip') {
    const skipped = await skipDishFeedback({
      admin,
      restaurantId: ctx.restaurantId,
      sessionId: ctx.session.id,
    });
    if (!skipped.ok) {
      return NextResponse.json({ error: skipped.error }, { status: skipped.status });
    }
    return NextResponse.json({ ok: true, action: 'skip' });
  }

  const parsed = parseDishFeedbackSubmitItems(body.items);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const submitted = await submitDishFeedback({
    admin,
    restaurantId: ctx.restaurantId,
    sessionId: ctx.session.id,
    items: parsed.items,
  });
  if (!submitted.ok) {
    return NextResponse.json(
      { error: submitted.error },
      { status: submitted.status },
    );
  }
  return NextResponse.json({ ok: true, action: 'submit' });
}
