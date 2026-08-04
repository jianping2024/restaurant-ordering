import type { WaiterBoardFilter } from '@/lib/waiter-board-session';

/** One selected board lane (floor group or together-group). */
export type WaiterBoardLaneKind = 'floor' | 'party';

export type WaiterBoardLaneKey = `${WaiterBoardLaneKind}:${string}`;

/** Sole persisted board UI condition set (KPI filter + search + lane). */
export type WaiterBoardViewPreference = {
  laneKey: WaiterBoardLaneKey | null;
  filter: WaiterBoardFilter;
  search: string;
};

export const DEFAULT_WAITER_BOARD_VIEW_PREFERENCE: WaiterBoardViewPreference = {
  laneKey: null,
  filter: 'all',
  search: '',
};

const VIEW_KEY_PREFIX = 'mesa-waiter-board-view:';
/** Pre-view-preference storage: plain lane key string only. */
const LEGACY_LANE_KEY_PREFIX = 'mesa-waiter-board-lane:';

const WAITER_BOARD_FILTERS: readonly WaiterBoardFilter[] = [
  'all',
  'checkout',
  'dining',
  'idle',
];

export function waiterBoardViewPreferenceStorageKey(restaurantId: string): string {
  return `${VIEW_KEY_PREFIX}${restaurantId}`;
}

function legacyWaiterBoardLaneStorageKey(restaurantId: string): string {
  return `${LEGACY_LANE_KEY_PREFIX}${restaurantId}`;
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

export function parseWaiterBoardFilter(raw: unknown): WaiterBoardFilter {
  return typeof raw === 'string' &&
    (WAITER_BOARD_FILTERS as readonly string[]).includes(raw)
    ? (raw as WaiterBoardFilter)
    : 'all';
}

/** Normalize unknown storage payload into the sole preference shape. */
export function parseWaiterBoardViewPreference(raw: unknown): WaiterBoardViewPreference {
  if (typeof raw === 'string') {
    const lane = parseWaiterBoardLaneKey(raw);
    if (lane) {
      return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE, laneKey: raw as WaiterBoardLaneKey };
    }
    return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE };
  }
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE };
  }
  const obj = raw as Record<string, unknown>;
  const laneRaw = obj.laneKey;
  let laneKey: WaiterBoardLaneKey | null = null;
  if (typeof laneRaw === 'string' && parseWaiterBoardLaneKey(laneRaw)) {
    laneKey = laneRaw as WaiterBoardLaneKey;
  }
  const search = typeof obj.search === 'string' ? obj.search : '';
  return {
    laneKey,
    filter: parseWaiterBoardFilter(obj.filter),
    search,
  };
}

export function loadWaiterBoardViewPreference(
  restaurantId: string,
): WaiterBoardViewPreference {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE };
  }
  try {
    const viewKey = waiterBoardViewPreferenceStorageKey(restaurantId);
    const viewRaw = localStorage.getItem(viewKey);
    if (viewRaw != null) {
      try {
        return parseWaiterBoardViewPreference(JSON.parse(viewRaw));
      } catch {
        return parseWaiterBoardViewPreference(viewRaw);
      }
    }
    const legacyRaw = localStorage.getItem(legacyWaiterBoardLaneStorageKey(restaurantId));
    if (legacyRaw != null) {
      return parseWaiterBoardViewPreference(legacyRaw);
    }
    return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE };
  } catch {
    return { ...DEFAULT_WAITER_BOARD_VIEW_PREFERENCE };
  }
}

export function saveWaiterBoardViewPreference(
  restaurantId: string,
  preference: WaiterBoardViewPreference,
): void {
  if (typeof window === 'undefined') return;
  try {
    const viewKey = waiterBoardViewPreferenceStorageKey(restaurantId);
    const legacyKey = legacyWaiterBoardLaneStorageKey(restaurantId);
    const normalized = parseWaiterBoardViewPreference(preference);
    const isDefault =
      normalized.laneKey == null &&
      normalized.filter === 'all' &&
      normalized.search === '';
    if (isDefault) {
      localStorage.removeItem(viewKey);
    } else {
      localStorage.setItem(viewKey, JSON.stringify(normalized));
    }
    localStorage.removeItem(legacyKey);
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
