export type RestaurantJoinRow = { name: string; slug: string } | { name: string; slug: string }[];

export function pickRestaurantJoin(restaurants: RestaurantJoinRow): { name: string; slug: string } {
  return Array.isArray(restaurants) ? restaurants[0] : restaurants;
}
