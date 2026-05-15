import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import {
  staffLoginRateLimitCheck,
  staffLoginRecordFailure,
  staffLoginRecordSuccess,
} from '@/lib/staff-login-rate-limit';
import { parseStaffUserMetadata } from '@/lib/staff-account';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = clientIpFromRequest(req);
  const rl = staffLoginRateLimitCheck(email, ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, disabled_at, role')
    .eq('email', email)
    .maybeSingle();

  if (!account || account.disabled_at) {
    staffLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    staffLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const meta = parseStaffUserMetadata(data.user.user_metadata as Record<string, unknown>);
  if (!meta || meta.account_type !== 'staff') {
    await supabase.auth.signOut();
    staffLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  staffLoginRecordSuccess(email, ip);

  return NextResponse.json({
    ok: true,
    must_change_password: meta.must_change_password === true,
    role: meta.staff_role,
    slug: meta.restaurant_slug,
  });
}
