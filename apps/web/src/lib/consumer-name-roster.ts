import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import { splitPersonKey } from '@/lib/split-person-identity';

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

export function namesUsedOnOtherDishRows(
  rows: ByItemConsumerRow[],
  rowId: string,
): Set<string> {
  const used = new Set<string>();
  for (const row of rows) {
    if (row.id === rowId) continue;
    const name = normalizeConsumerName(row.name);
    if (name) used.add(splitPersonKey(name));
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
  return params.roster.filter((name) => !blocked.has(splitPersonKey(name)));
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
