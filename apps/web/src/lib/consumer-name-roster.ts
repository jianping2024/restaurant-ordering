import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';

export function normalizeConsumerName(name: string): string {
  return name.trim();
}

/** Case-insensitive dedup; keeps the first spelling seen. */
export function addToConsumerRoster(roster: string[], name: string): string[] {
  const trimmed = normalizeConsumerName(name);
  if (!trimmed) return roster;
  const lower = trimmed.toLowerCase();
  if (roster.some((entry) => entry.toLowerCase() === lower)) return roster;
  return [...roster, trimmed].sort((a, b) => a.localeCompare(b));
}

export function isPartialConsumerNameEdit(roster: string[], name: string): boolean {
  const trimmed = normalizeConsumerName(name);
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return roster.some((entry) => {
    const entryLower = entry.toLowerCase();
    return entryLower !== lower && entryLower.startsWith(lower);
  });
}

export function rememberConsumerName(roster: string[], name: string, fromList: boolean): string[] {
  const trimmed = normalizeConsumerName(name);
  if (!trimmed) return roster;
  if (fromList) return addToConsumerRoster(roster, trimmed);
  if (trimmed.length < 2) return roster;
  if (isPartialConsumerNameEdit(roster, trimmed)) return roster;
  return addToConsumerRoster(roster, trimmed);
}

export function namesUsedOnOtherDishRows(
  rows: ByItemConsumerRow[],
  rowId: string,
): Set<string> {
  const used = new Set<string>();
  for (const row of rows) {
    if (row.id === rowId) continue;
    const name = normalizeConsumerName(row.name);
    if (name) used.add(name.toLowerCase());
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
  return params.roster.filter((name) => !blocked.has(name.toLowerCase()));
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
