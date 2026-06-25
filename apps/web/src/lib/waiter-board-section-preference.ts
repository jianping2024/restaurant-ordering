const KEY_PREFIX = 'mesa-waiter-board-collapsed:';

export function waiterBoardCollapsedStorageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

export function loadWaiterBoardCollapsedSectionIds(restaurantId: string): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(waiterBoardCollapsedStorageKey(restaurantId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return null;
  }
}

export function saveWaiterBoardCollapsedSectionIds(
  restaurantId: string,
  collapsedSectionIds: ReadonlySet<string>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      waiterBoardCollapsedStorageKey(restaurantId),
      JSON.stringify(Array.from(collapsedSectionIds)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
