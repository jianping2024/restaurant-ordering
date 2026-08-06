import type { BuffetServiceMode } from '@mesa/shared';

/**
 * Restaurant fields the floor board and embedded staff ordering panel need.
 * `buffet_service_mode` drives sushi limit gates in MenuOrderingController.
 */
export type FloorBoardRestaurant = {
  id: string;
  name: string;
  slug: string;
  buffet_service_mode?: BuffetServiceMode | string | null;
};

export function toFloorBoardRestaurant(row: {
  id: string;
  name: string;
  slug: string;
  buffet_service_mode?: BuffetServiceMode | string | null;
}): FloorBoardRestaurant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    buffet_service_mode: row.buffet_service_mode ?? null,
  };
}
