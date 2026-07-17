/** One selected board lane (floor group or together-group). Replaces multi-collapse prefs. */
export type WaiterBoardLaneKind = 'floor' | 'party';

export type WaiterBoardLaneKey = `${WaiterBoardLaneKind}:${string}`;

const KEY_PREFIX = 'mesa-waiter-board-lane:';

export function waiterBoardSelectedLaneStorageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

export function floorLaneKey(sectionId: string): WaiterBoardLaneKey {
  return `floor:${sectionId}`;
}

export function partyLaneKey(partyId: string): WaiterBoardLaneKey {
  return `party:${partyId}`;
}

export function parseWaiterBoardLaneKey(raw: string): {
  kind: WaiterBoardLaneKind;
  id: string;
} | null {
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  const kind = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if ((kind !== 'floor' && kind !== 'party') || !id) return null;
  return { kind, id };
}

export function loadWaiterBoardSelectedLaneKey(restaurantId: string): WaiterBoardLaneKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(waiterBoardSelectedLaneStorageKey(restaurantId));
    if (!raw || typeof raw !== 'string') return null;
    return parseWaiterBoardLaneKey(raw) ? (raw as WaiterBoardLaneKey) : null;
  } catch {
    return null;
  }
}

export function saveWaiterBoardSelectedLaneKey(
  restaurantId: string,
  laneKey: WaiterBoardLaneKey | null,
): void {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = waiterBoardSelectedLaneStorageKey(restaurantId);
    if (!laneKey) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, laneKey);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Keep the remembered lane when still visible; otherwise first floor, then first party.
 */
export function resolveWaiterBoardSelectedLaneKey(
  preferred: WaiterBoardLaneKey | null,
  floorKeys: readonly WaiterBoardLaneKey[],
  partyKeys: readonly WaiterBoardLaneKey[],
): WaiterBoardLaneKey | null {
  if (preferred && (floorKeys.includes(preferred) || partyKeys.includes(preferred))) {
    return preferred;
  }
  return floorKeys[0] ?? partyKeys[0] ?? null;
}
