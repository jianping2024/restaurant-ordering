import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PRINT_AGENT_STAFF_ROLE = 'print_agent' as const;

export const PRINT_AGENT_STAFF_EMAIL_DOMAIN = 'mesa.in';

export const PRINT_AGENT_STAFF_DISPLAY_NAME = 'Print Agent';

export function isPrintAgentStaffRole(role: string): boolean {
  return role === PRINT_AGENT_STAFF_ROLE;
}

/** Stable unique login_name local-part for the per-restaurant system account. */
export function printAgentLoginName(restaurantId: string): string {
  const hex = restaurantId.replace(/-/g, '').toLowerCase();
  return `pa${hex.slice(0, 30)}`;
}

export function printAgentStaffEmail(restaurantId: string): string {
  return `${printAgentLoginName(restaurantId)}@${PRINT_AGENT_STAFF_EMAIL_DOMAIN}`;
}

function randomPassword(): string {
  return randomBytes(32).toString('base64url');
}

export type EnsurePrintAgentStaffSuccess = {
  ok: true;
  userId: string;
  accountId: string;
  loginName: string;
  email: string;
};

export type EnsurePrintAgentStaffFailure = {
  ok: false;
  error: string;
  detail?: string;
};

export type EnsurePrintAgentStaffResult = EnsurePrintAgentStaffSuccess | EnsurePrintAgentStaffFailure;

type StaffRow = {
  id: string;
  user_id: string;
  login_name: string;
  disabled_at: string | null;
};

async function loadExisting(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<StaffRow | null> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id, user_id, login_name, disabled_at')
    .eq('restaurant_id', restaurantId)
    .eq('role', PRINT_AGENT_STAFF_ROLE)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as StaffRow | null) ?? null;
}

/**
 * Idempotent: ensures exactly one active print_agent staff account for the restaurant.
 */
export async function ensurePrintAgentStaff(
  admin: SupabaseClient,
  params: { restaurantId: string; restaurantSlug: string },
): Promise<EnsurePrintAgentStaffResult> {
  const { restaurantId, restaurantSlug } = params;
  const loginName = printAgentLoginName(restaurantId);
  const email = printAgentStaffEmail(restaurantId);

  try {
    const existing = await loadExisting(admin, restaurantId);
    if (existing) {
      if (existing.disabled_at) {
        const { error: enableErr } = await admin
          .from('restaurant_staff_accounts')
          .update({ disabled_at: null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (enableErr) {
          return { ok: false, error: 'enable_failed', detail: enableErr.message };
        }
        await admin.auth.admin.updateUserById(existing.user_id, {
          ban_duration: 'none',
        });
      }
      return {
        ok: true,
        userId: existing.user_id,
        accountId: existing.id,
        loginName: existing.login_name || loginName,
        email,
      };
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        account_type: 'staff',
        must_change_password: false,
        staff_role: PRINT_AGENT_STAFF_ROLE,
        restaurant_id: restaurantId,
        restaurant_slug: restaurantSlug,
      },
    });

    if (createError || !createdUser.user) {
      // Race: another ensure won the unique index / email — reload.
      const raced = await loadExisting(admin, restaurantId);
      if (raced) {
        return {
          ok: true,
          userId: raced.user_id,
          accountId: raced.id,
          loginName: raced.login_name || loginName,
          email,
        };
      }
      const msg = createError?.message || 'create_user_failed';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        return { ok: false, error: 'email_exists', detail: msg };
      }
      return { ok: false, error: 'create_user_failed', detail: msg };
    }

    const userId = createdUser.user.id;

    const { data: row, error: insertError } = await admin
      .from('restaurant_staff_accounts')
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        role: PRINT_AGENT_STAFF_ROLE,
        display_name: PRINT_AGENT_STAFF_DISPLAY_NAME,
        login_name: loginName,
        created_by: null,
      })
      .select('id, user_id, login_name')
      .single();

    if (insertError || !row) {
      await admin.auth.admin.deleteUser(userId);
      const raced = await loadExisting(admin, restaurantId);
      if (raced) {
        return {
          ok: true,
          userId: raced.user_id,
          accountId: raced.id,
          loginName: raced.login_name || loginName,
          email,
        };
      }
      return {
        ok: false,
        error: 'insert_failed',
        detail: insertError?.message,
      };
    }

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        account_type: 'staff',
        must_change_password: false,
        staff_role: PRINT_AGENT_STAFF_ROLE,
        restaurant_id: restaurantId,
        staff_account_id: row.id,
        restaurant_slug: restaurantSlug,
      },
    });

    return {
      ok: true,
      userId,
      accountId: row.id as string,
      loginName: (row.login_name as string) || loginName,
      email,
    };
  } catch (e) {
    return {
      ok: false,
      error: 'ensure_failed',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
