export function isRestaurantSuspended(suspendedAt: string | null | undefined): boolean {
  return suspendedAt != null && suspendedAt !== '';
}
