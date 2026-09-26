import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import { splitPersonKey } from '@/lib/split-person-identity';
import { splitPartyKey } from '@/lib/split-party-id';

/** Names shorter than this are ignored for combobox suggestions. */
export const MIN_ACTIVE_CONSUMER_NAME_LENGTH = 2;

export function normalizeConsumerName(name: string): string {
  return name.trim();
}

/** Case-insensitive dedup; keeps the first spelling seen. */
export function addToConsumerRoster(roster: string[], name: string): string[] {
  const trimmed = normalizeConsumerName(name);
  if (!trimmed) return roster;
  const key = splitPersonKey(trimmed);
  if (roster.some((entry) => splitPersonKey(entry) === key)) return roster;
  return [...roster, trimmed].sort((a, b) => a.localeCompare(b));
}

/** Unique names currently typed on any by-item row (session pool for combobox). */
export function collectActiveConsumerNames(
  allocations: Record<string, ByItemConsumerRow[]>,
): string[] {
  let roster: string[] = [];
  for (const rows of Object.values(allocations)) {
    for (const row of rows) {
      const trimmed = normalizeConsumerName(row.name);
      if (trimmed.length < MIN_ACTIVE_CONSUMER_NAME_LENGTH) continue;
      roster = addToConsumerRoster(roster, trimmed);
    }
  }
  return roster;
}

/**
 * Ticket keys used on other rows of the same dish.
 * Same display name may repeat across party_id; same ticket cannot.
 */
export function namesUsedOnOtherDishRows(
  rows: ByItemConsumerRow[],
  rowId: string,
): Set<string> {
  const used = new Set<string>();
  for (const row of rows) {
    if (row.id === rowId) continue;
    const name = normalizeConsumerName(row.name);
    if (!name) continue;
    const key = splitPartyKey(row.partyId, name);
    if (key) used.add(key);
  }
  return used;
}

export function filterConsumerNameOptions(options: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return options.filter((name) => {
    const lower = name.toLowerCase();
    return lower.includes(normalized) && lower !== normalized;
  });
}

export function availableConsumerNamesForRow(params: {
  roster: string[];
  dishRows: ByItemConsumerRow[];
  rowId: string;
}): string[] {
  const blocked = namesUsedOnOtherDishRows(params.dishRows, params.rowId);
  const self = params.dishRows.find((row) => row.id === params.rowId);
  const selfKey = self ? splitPartyKey(self.partyId, self.name) : '';
  return params.roster.filter((name) => {
    const candidateKey = splitPartyKey(self?.partyId, name);
    if (blocked.has(candidateKey) && candidateKey !== selfKey) return false;
    // Legacy name-only collision on this dish
    const legacyKey = splitPartyKey(undefined, name);
    if (!self?.partyId && blocked.has(legacyKey) && legacyKey !== selfKey) return false;
    return true;
  });
}

export function suggestConsumerNamesForRow(params: {
  roster: string[];
  dishRows: ByItemConsumerRow[];
  rowId: string;
  query: string;
}): string[] {
  return filterConsumerNameOptions(
    availableConsumerNamesForRow(params),
    params.query,
  );
}

export function shouldShowConsumerNameMenu(options: string[], query: string): boolean {
  return filterConsumerNameOptions(options, query).length > 0;
}
