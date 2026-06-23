export function restaurantNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function defaultRestaurantSlug(name: string): string {
  const base = restaurantNameToSlug(name) || 'restaurant';
  return `${base}-${Date.now().toString(36)}`;
}
