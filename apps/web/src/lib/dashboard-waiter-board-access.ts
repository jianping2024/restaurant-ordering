import type {
  DashboardAccessResult,
  StaffDashboardRestaurant,
} from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  staffLandingPathFromCapabilities,
  type FloorBoardCapabilities,
} from '@/lib/permissions/resolve';
import type { FloorBoardRestaurantRow } from '@/lib/floor-board-restaurant';
import type { Restaurant } from '@/types';

/**
 * Session restaurant for the floor-board **access gate** only.
 * Full floor model (`FloorBoardRestaurant` + kitchen_enabled_station_ids) is loaded
 * solely by `loadFloorBoardRestaurant` in the waiter layout — do not pretend the
 * gate already has that shape.
 */
export type WaiterBoardAccessRestaurant = FloorBoardRestaurantRow & {
  logo_url?: string | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;
};

export type WaiterBoardDashboardContext = {
  restaurant: WaiterBoardAccessRestaurant;
  capabilities: Capabilities;
  floorCapabilities: FloorBoardCapabilities;
};

export type WaiterBoardAccessDecision =
  | { ok: true; restaurant: WaiterBoardAccessRestaurant }
  | { ok: false; redirectTo: string };

function toWaiterBoardAccessRestaurant(
  restaurant: Restaurant | StaffDashboardRestaurant,
): WaiterBoardAccessRestaurant {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    buffet_service_mode: restaurant.buffet_service_mode ?? null,
    feature_flags:
      (restaurant.feature_flags as Record<string, boolean> | null | undefined) ?? null,
    logo_url: restaurant.logo_url ?? null,
    suspended_at: restaurant.suspended_at ?? null,
    suspension_reason: restaurant.suspension_reason ?? null,
    print_agent_config:
      'print_agent_config' in restaurant ? restaurant.print_agent_config : undefined,
  };
}

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
  return { ok: true, restaurant: toWaiterBoardAccessRestaurant(access.restaurant) };
}
