import { createRestaurantWithOwner } from '@mesa/shared';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_BOOTSTRAP_SECRET is not set' },
      { status: 503 },
    );
  }

  let body: {
    adminSecret?: string;
    restaurantName?: string;
    email?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { adminSecret, restaurantName, email, password } = body;
  if (!adminSecret || adminSecret !== expected) {
    return NextResponse.json({ error: 'invalid_secret' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const result = await createRestaurantWithOwner(admin, {
      name: restaurantName || '',
      email: email || '',
      password: password || '',
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, detail: result.detail },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, slug: result.slug }, {
      headers: {
        Deprecation: 'true',
        Warning: '299 - "Use Mesa Ops /api/ops/restaurants instead"',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'internal_error', detail: message }, { status: 500 });
  }
}
