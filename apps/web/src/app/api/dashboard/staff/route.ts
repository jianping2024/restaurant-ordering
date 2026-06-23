import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { buildStaffEmail } from '@/lib/staff-account';
import {
  loadOwnerRestaurantWithSlug,
  mapStaffRow,
  staffMetadataPayload,
  validateStaffCreateBody,
} from '@/lib/staff-dashboard-api';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const loaded = await loadOwnerRestaurantWithSlug();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data, error } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('restaurant_id', loaded.restaurant.id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: (data || []).map(mapStaffRow) });
}

export async function POST(req: Request) {
  const loaded = await loadOwnerRestaurantWithSlug();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = validateStaffCreateBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const email = buildStaffEmail(parsed.login_name);

  const supabase = await createClient();
  const {
    data: { user: owner },
  } = await supabase.auth.getUser();

  const { data: createdUser, error: createError } = await loaded.admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      account_type: 'staff',
      must_change_password: true,
      staff_role: parsed.role,
      restaurant_id: loaded.restaurant.id,
      restaurant_slug: loaded.restaurant.slug,
    },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({ error: 'login_name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'create_user_failed', message: createError.message }, { status: 500 });
  }

  const userId = createdUser.user.id;

  const { data: row, error: insertError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .insert({
      restaurant_id: loaded.restaurant.id,
      user_id: userId,
      role: parsed.role,
      display_name: parsed.display_name,
      login_name: parsed.login_name,
      email,
      created_by: owner?.id ?? null,
    })
    .select('*')
    .single();

  if (insertError) {
    await loaded.admin.auth.admin.deleteUser(userId);
    if (isDbMigrationRequiredError(insertError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'login_name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'insert_failed', message: insertError.message }, { status: 500 });
  }

  const account = mapStaffRow(row as Record<string, unknown>);
  await loaded.admin.auth.admin.updateUserById(userId, {
    user_metadata: staffMetadataPayload(
      account.id,
      loaded.restaurant.id,
      loaded.restaurant.slug,
      parsed.role,
      true,
    ),
  });

  return NextResponse.json({ staff: account }, { status: 201 });
}
