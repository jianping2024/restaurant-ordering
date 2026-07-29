import type { DashboardAccessResult } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  staffLandingPathFromCapabilities,
  type FloorBoardCapabilities,
} from '@/lib/permissions/resolve';
import type { FloorBoardRestaurant } from '@/lib/floor-board-restaurant';

export type WaiterBoardDashboardContext = {
  restaurant: FloorBoardRestaurant & {
    logo_url?: string | null;
    feature_flags?: Record<string, unknown> | null;
    suspended_at?: string | null;
    suspension_reason?: string | null;
  };
  capabilities: Capabilities;
  floorCapabilities: FloorBoardCapabilities;
};

export type WaiterBoardAccessDecision =
  | { ok: true; restaurant: WaiterBoardDashboardContext['restaurant'] }
  | { ok: false; redirectTo: string };

/** Pure gate: capability + restaurant session — no staff role/mode enum. */
export function resolveWaiterBoardDashboardAccess(
  access: DashboardAccessResult,
  capabilities: Capabilities | null,
): WaiterBoardAccessDecision {
  if (access.mode === 'unauthenticated') {
    return { ok: false, redirectTo: '/auth/login' };
  }
  if (access.mode === 'onboarding' || access.mode === 'access_error') {
    return { ok: false, redirectTo: '/dashboard' };
  }
  if (!capabilities || !can(capabilities, 'dashboard.waiter_board.view')) {
    return {
      ok: false,
      redirectTo: staffLandingPathFromCapabilities(
        access.restaurant.slug,
        capabilities ?? new Set(),
      ),
    };
  }
  return { ok: true, restaurant: access.restaurant };
}
