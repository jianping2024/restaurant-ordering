import { isRestaurantSuspended } from '@mesa/shared';
import type { DashboardAccessResult } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import type { PrincipalWithCapabilities } from '@/lib/permissions/principal';
import { mayForceCloseTable } from '@/lib/table-session/force-close-table-policy';
import type { SettledCloseActorReason } from '@/lib/table-session/operational-close-reasons';

/** checkout_close = 关台结账 (tables.checkout_close); manual = 强制关台 (tables.force_close). */
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

export function settledCloseReasonForStaffPreset(
  presetKey: string | null | undefined,
): SettledCloseActorReason {
  if (presetKey === 'cashier') return 'cashier_closed';
  if (presetKey === 'owner') return 'owner_closed';
  return 'frontdesk_closed';
}

function hasCloseTableCapability(
  capabilities: Capabilities,
  gate: CloseTableSessionActorGate,
): boolean {
  if (gate === 'checkout_close') return can(capabilities, 'tables.checkout_close');
  return mayForceCloseTable(capabilities);
}

/** Pure desk close actor gate: staff principal + capability for the gate (no mode/role whitelist). */
export function resolveCloseTableSessionDeskActor(
  access: DashboardAccessResult,
  loaded: PrincipalWithCapabilities | null,
  options?: { requireWritable?: boolean; gate?: CloseTableSessionActorGate },
): CloseTableSessionDeskActorDecision {
  const gate = options?.gate ?? 'manual';
  if (access.mode === 'unauthenticated') {
    return { ok: false, error: 'unauthorized', status: 401 };
  }
  if (access.mode === 'access_error' || access.mode === 'onboarding') {
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
