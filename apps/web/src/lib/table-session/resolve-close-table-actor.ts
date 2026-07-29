import { isRestaurantSuspended } from '@mesa/shared';
import type { DashboardAccessResult } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import type { PrincipalWithCapabilities } from '@/lib/permissions/principal';
import type { SettledCloseActorReason } from '@/lib/table-session/operational-close-reasons';

const DESK_CLOSE_ACCESS_MODES = new Set(['store_owner', 'frontdesk', 'cashier']);

export type CloseTableSessionActorGate = 'checkout_close' | 'manual';

export type CloseTableSessionDeskActorDecision =
  | {
      ok: true;
      restaurantId: string;
      userId: string;
      staffRole: string;
      closedReason: SettledCloseActorReason;
    }
  | { ok: false; error: string; status: number };

function hasCloseTableCapability(
  capabilities: Capabilities,
  gate: CloseTableSessionActorGate,
): boolean {
  if (can(capabilities, 'tables.checkout_close')) return true;
  if (gate === 'manual' && can(capabilities, 'tables.force_close')) return true;
  return false;
}

export function settledCloseReasonForStaffPreset(
  presetKey: string | null | undefined,
): SettledCloseActorReason {
  return presetKey === 'cashier' ? 'cashier_closed' : 'frontdesk_closed';
}

/** Pure desk close actor gate: capability + dashboard access — no staff role enum whitelist. */
export function resolveCloseTableSessionDeskActor(
  access: DashboardAccessResult,
  loaded: PrincipalWithCapabilities | null,
  gate: CloseTableSessionActorGate,
  options?: { requireWritable?: boolean },
): CloseTableSessionDeskActorDecision {
  if (access.mode === 'unauthenticated') {
    return { ok: false, error: 'unauthorized', status: 401 };
  }
  if (access.mode === 'access_error' || access.mode === 'onboarding') {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (!DESK_CLOSE_ACCESS_MODES.has(access.mode)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (!loaded || loaded.principal.kind !== 'staff') {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (!hasCloseTableCapability(loaded.capabilities, gate)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (
    options?.requireWritable &&
    isRestaurantSuspended(
      'suspended_at' in access.restaurant ? access.restaurant.suspended_at : null,
    )
  ) {
    return { ok: false, error: 'restaurant_suspended', status: 403 };
  }

  const staffRole =
    loaded.principal.presetKey === 'cashier'
      ? 'cashier'
      : loaded.principal.presetKey === 'owner'
        ? 'owner'
        : 'frontdesk';

  return {
    ok: true,
    restaurantId: access.restaurant.id,
    userId: loaded.principal.userId,
    staffRole,
    closedReason: settledCloseReasonForStaffPreset(loaded.principal.presetKey),
  };
}
