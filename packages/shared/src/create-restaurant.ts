import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultRestaurantSlug } from './slug';

export type PrintLocale = 'zh' | 'en' | 'pt';

export type CreateRestaurantInput = {
  name: string;
  email: string;
  password: string;
  printLocale?: PrintLocale;
  slug?: string;
};

export type CreateRestaurantSuccess = {
  ok: true;
  slug: string;
  restaurantId: string;
  ownerId: string;
};

export type CreateRestaurantFailure = {
  ok: false;
  error: string;
  status: number;
  detail?: string;
};

export type CreateRestaurantResult = CreateRestaurantSuccess | CreateRestaurantFailure;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateRestaurantInput(input: CreateRestaurantInput): CreateRestaurantFailure | null {
  const name = (input.name || '').trim();
  const mail = (input.email || '').trim().toLowerCase();
  const pwd = input.password || '';

  if (pwd.length < 6) {
    return { ok: false, error: 'password_too_short', status: 400 };
  }
  if (!name) {
    return { ok: false, error: 'restaurant_name_required', status: 400 };
  }
  if (!mail || !EMAIL_RE.test(mail)) {
    return { ok: false, error: 'invalid_email', status: 400 };
  }
  const locale = input.printLocale ?? 'pt';
  if (!['zh', 'en', 'pt'].includes(locale)) {
    return { ok: false, error: 'invalid_print_locale', status: 400 };
  }
  return null;
}

export async function createRestaurantWithOwner(
  admin: SupabaseClient,
  input: CreateRestaurantInput,
): Promise<CreateRestaurantResult> {
  const validation = validateCreateRestaurantInput(input);
  if (validation) return validation;

  const name = input.name.trim();
  const mail = input.email.trim().toLowerCase();
  const pwd = input.password;
  const printLocale = input.printLocale ?? 'pt';
  const slug = (input.slug || '').trim() || defaultRestaurantSlug(name);

  const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
    email: mail,
    password: pwd,
    email_confirm: true,
  });

  if (createUserError || !userData.user) {
    const msg = createUserError?.message || '';
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
      return { ok: false, error: 'email_exists', status: 409 };
    }
    return { ok: false, error: 'create_user_failed', status: 400, detail: createUserError?.message };
  }

  const ownerId = userData.user.id;

  const { error: confirmError } = await admin.auth.admin.updateUserById(ownerId, {
    email_confirm: true,
  });
  if (confirmError) {
    await admin.auth.admin.deleteUser(ownerId);
    return { ok: false, error: 'confirm_email_failed', status: 500, detail: confirmError.message };
  }

  const { data: restaurantRow, error: insertError } = await admin
    .from('restaurants')
    .insert({
      name,
      slug,
      owner_id: ownerId,
      print_locale: printLocale,
    })
    .select('id')
    .single();

  if (insertError || !restaurantRow) {
    await admin.auth.admin.deleteUser(ownerId);
    return {
      ok: false,
      error: 'restaurant_insert_failed',
      status: 500,
      detail: insertError?.message,
    };
  }

  return {
    ok: true,
    slug,
    restaurantId: restaurantRow.id,
    ownerId,
  };
}
