import type { BuffetServiceMode } from '@mesa/shared';
import { kitchenReadyAfterMinutesFromConfig } from '@/lib/print-agent-config';

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
};

export function toFloorBoardRestaurant(row: {
  id: string;
  name: string;
  slug: string;
  buffet_service_mode?: BuffetServiceMode | string | null;
  feature_flags?: Record<string, boolean> | null | Record<string, unknown> | null;
  kitchen_ready_after_minutes?: number | null;
  print_agent_config?: unknown;
}): FloorBoardRestaurant {
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
  };
}
