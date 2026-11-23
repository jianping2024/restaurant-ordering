import { NextResponse } from 'next/server';
import {
  isPrintAgentStaffRole,
  linkStaffMembership,
  loadStaffIdentity,
  loadStaffIdentityByLoginName,
  removeStaffMembership,
} from '@mesa/shared';
import { requirePlatformAdmin, requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

/**
 * Ops «关联已有账号» (multi-store plan §8.3): look up an existing staff account by login name,
 * link it to many stores in one submit, or unlink it from many. Only ops links (rule 1);
 * one platform audit row per store.
 */

const MAX_STORES_PER_SUBMIT = 200;

type AdminClient = NonNullable<Awaited<ReturnType<typeof requirePlatformAdmin>>['admin']>;

type MembershipRow = {
  id: string;
  restaurant_id: string;
  role: string;
  display_name: string;
  disabled_at: string | null;
  restaurant_roles: { name: string } | { name: string }[] | null;
};

async function loadMemberships(admin: AdminClient, userId: string): Promise<MembershipRow[]> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id, restaurant_id, role, display_name, disabled_at, restaurant_roles(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MembershipRow[];
}

function roleNameOf(row: MembershipRow): string {
  const joined = Array.isArray(row.restaurant_roles) ? row.restaurant_roles[0] : row.restaurant_roles;
  return joined?.name ?? row.role;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0)));
}

export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const login = new URL(req.url).searchParams.get('login') ?? '';
  const identity = await loadStaffIdentityByLoginName(admin, login);
  if (!identity) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });

  const memberships = await loadMemberships(admin, identity.user_id);
  return NextResponse.json({
    account: {
      userId: identity.user_id,
      loginName: identity.login_name,
      isPrintAgent: memberships.some((m) => isPrintAgentStaffRole(m.role)),
    },
    memberships: memberships.map((m) => ({
      membershipId: m.id,
      restaurantId: m.restaurant_id,
      roleName: roleNameOf(m),
      displayName: m.display_name,
      disabledAt: m.disabled_at,
    })),
  });
}

/** Body `{ user_id, links: [{ restaurant_id, role_id }] }` — role ids come from the preview. */
export async function POST(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const body = await readJson(req);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const links = Array.isArray(body?.links)
    ? (body.links as unknown[]).flatMap((l) => {
        const row = l as { restaurant_id?: unknown; role_id?: unknown };
        return typeof row?.restaurant_id === 'string' && typeof row?.role_id === 'string'
          ? [{ restaurantId: row.restaurant_id, roleId: row.role_id }]
          : [];
      })
    : [];
  if (!userId || links.length === 0 || links.length > MAX_STORES_PER_SUBMIT) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const identity = await loadStaffIdentity(admin, userId);
  if (!identity) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  const memberships = await loadMemberships(admin, userId);
  if (memberships.some((m) => isPrintAgentStaffRole(m.role))) {
    return NextResponse.json({ error: 'print_agent_account' }, { status: 409 });
  }
  const displayName = memberships[0]?.display_name || identity.login_name;

  const { data: stores, error: storesError } = await admin
    .from('restaurants')
    .select('id, deployment_mode')
    .in('id', Array.from(new Set(links.map((l) => l.restaurantId))));
  if (storesError) {
    return NextResponse.json({ error: 'fetch_failed', detail: storesError.message }, { status: 500 });
  }
  const cloudStores = new Set(
    (stores ?? []).filter((s) => s.deployment_mode === 'cloud').map((s) => String(s.id)),
  );

  const results: { restaurantId: string; ok: boolean; error?: string }[] = [];
  for (const link of links) {
    if (!cloudStores.has(link.restaurantId)) {
      results.push({ restaurantId: link.restaurantId, ok: false, error: 'store_not_linkable' });
      continue;
    }
    const res = await linkStaffMembership(admin, {
      restaurantId: link.restaurantId,
      userId,
      loginName: identity.login_name,
      roleId: link.roleId,
      displayName,
      createdBy: ctx.userId,
    });
    if (!res.ok) {
      results.push({ restaurantId: link.restaurantId, ok: false, error: res.error });
      continue;
    }
    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'staff.link',
      targetType: 'restaurant_staff_account',
      targetId: res.membershipId,
      restaurantId: link.restaurantId,
      metadata: { loginName: identity.login_name, userId, roleName: res.roleName },
    });
    results.push({ restaurantId: link.restaurantId, ok: true });
  }

  return NextResponse.json({ results });
}

/** Body `{ user_id, restaurant_ids }` — the last store left retires the account (2A helper). */
export async function DELETE(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const body = await readJson(req);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const restaurantIds = uniqueStrings(body?.restaurant_ids);
  if (!userId || restaurantIds.length === 0 || restaurantIds.length > MAX_STORES_PER_SUBMIT) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const identity = await loadStaffIdentity(admin, userId);
  if (!identity) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  const byStore = new Map((await loadMemberships(admin, userId)).map((m) => [m.restaurant_id, m]));

  const results: { restaurantId: string; ok: boolean; error?: string; accountRetired?: boolean }[] = [];
  for (const restaurantId of restaurantIds) {
    const membership = byStore.get(restaurantId);
    if (!membership) {
      results.push({ restaurantId, ok: false, error: 'not_linked' });
      continue;
    }
    if (isPrintAgentStaffRole(membership.role)) {
      results.push({ restaurantId, ok: false, error: 'print_agent_account' });
      continue;
    }
    const res = await removeStaffMembership(admin, {
      restaurantId,
      membershipId: membership.id,
      userId,
    });
    if (!res.ok) {
      results.push({ restaurantId, ok: false, error: res.error });
      continue;
    }
    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'staff.unlink',
      targetType: 'restaurant_staff_account',
      targetId: membership.id,
      restaurantId,
      metadata: {
        loginName: identity.login_name,
        userId,
        roleName: roleNameOf(membership),
        accountRetired: res.accountRetired,
      },
    });
    results.push({ restaurantId, ok: true, accountRetired: res.accountRetired });
  }

  return NextResponse.json({ results });
}
