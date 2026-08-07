import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuffetServiceMode } from '@mesa/shared';
import { kitchenReadyAfterMinutesFromConfig } from '@/lib/print-agent-config';
import { loadKitchenEnabledStationIds } from '@/lib/kitchen-progress-display';

/**
 * Restaurant fields the floor board and embedded staff ordering panel need.
 * `buffet_service_mode` drives sushi limit gates in MenuOrderingController.
 */
export type FloorBoardRestaurant = {
  id: string;
  name: string;
  slug: string;
  buffet_service_mode?: BuffetServiceMode | string | null;
  feature_flags?: Record<string, boolean> | null;
  /** Resolved from print_agent_config; used for effective ready display / 上桌. */
  kitchen_ready_after_minutes?: number;
  /**
   * Stations with kitchen_enabled — same gate as guest `kitchen_progress.enabled_station_ids`
   * for floor progress labels and 上桌 eligibility.
   */
  kitchen_enabled_station_ids: string[];
};

export type FloorBoardRestaurantRow = {
  id: string;
  name: string;
  slug: string;
  buffet_service_mode?: BuffetServiceMode | string | null;
  feature_flags?: Record<string, boolean> | null | Record<string, unknown> | null;
  kitchen_ready_after_minutes?: number | null;
  print_agent_config?: unknown;
};

export function toFloorBoardRestaurant(
  row: FloorBoardRestaurantRow,
  options: { kitchen_enabled_station_ids?: string[] } = {},
): FloorBoardRestaurant {
  const minutes =
    typeof row.kitchen_ready_after_minutes === 'number'
      ? row.kitchen_ready_after_minutes
      : kitchenReadyAfterMinutesFromConfig(row.print_agent_config);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    buffet_service_mode: row.buffet_service_mode ?? null,
    feature_flags: (row.feature_flags as Record<string, boolean> | null | undefined) ?? null,
    kitchen_ready_after_minutes: minutes,
    kitchen_enabled_station_ids: options.kitchen_enabled_station_ids ?? [],
  };
}

/** Sole server entry: floor restaurant + kitchen-enabled station ids (one load). */
export async function loadFloorBoardRestaurant(
  admin: SupabaseClient,
  row: FloorBoardRestaurantRow,
): Promise<FloorBoardRestaurant> {
  const kitchen_enabled_station_ids = await loadKitchenEnabledStationIds(admin, row.id);
  return toFloorBoardRestaurant(row, { kitchen_enabled_station_ids });
}
