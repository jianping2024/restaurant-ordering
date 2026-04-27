import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

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

  const name = (restaurantName || '').trim();
  const mail = (email || '').trim().toLowerCase();
  const pwd = password || '';

  if (pwd.length < 6) {
    return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'restaurant_name_required' }, { status: 400 });
  }
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
      email: mail,
      password: pwd,
      email_confirm: true,
    });

    if (createUserError || !userData.user) {
      const msg = createUserError?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'create_user_failed', detail: createUserError?.message },
        { status: 400 },
      );
    }

    const { error: confirmError } = await admin.auth.admin.updateUserById(userData.user.id, {
      email_confirm: true,
    });
    if (confirmError) {
      await admin.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { error: 'confirm_email_failed', detail: confirmError.message },
        { status: 500 },
      );
    }

    const baseSlug = toSlug(name) || 'restaurant';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { error: insertError } = await admin.from('restaurants').insert({
      name,
      slug,
      owner_id: userData.user.id,
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { error: 'restaurant_insert_failed', detail: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'internal_error', detail: message }, { status: 500 });
  }
}
