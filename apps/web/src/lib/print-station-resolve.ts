/**
 * Effective thermal station ids for a dish:
 * item `print_station_ids` when non-empty, else category walk (single default → one-id list).
 * Sole resolver for menu → station routing (enqueue, kitchen board, dish history).
 */

export type PrintStationCategoryRow = {
  id: string;
  parent_id?: string | null;
  print_station_id?: string | null;
};

/** Normalize dish binding: unique ids, drop empties, preserve first-seen order. */
export function normalizePrintStationIds(
  raw: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function resolveCategoryPrintStationId(
  categoryId: string | null | undefined,
  categories: PrintStationCategoryRow[],
): string | null {
  if (!categoryId) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let id: string | null = categoryId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const c = byId.get(id);
    if (!c) break;
    if (c.print_station_id) return c.print_station_id;
    const p = c.parent_id;
    id = p != null && p !== '' ? p : null;
  }
  return null;
}

/**
 * Sole effective station list for a dish.
 * Empty item binding → inherit category default (0 or 1 id).
 * Non-empty item binding → that list (override; may be multiple).
 */
export function resolveEffectivePrintStationIds(
  itemPrintStationIds: readonly (string | null | undefined)[] | null | undefined,
  categoryId: string | null | undefined,
  categories: PrintStationCategoryRow[],
): string[] {
  const explicit = normalizePrintStationIds(itemPrintStationIds);
  if (explicit.length > 0) return explicit;
  const fromCategory = resolveCategoryPrintStationId(categoryId, categories);
  return fromCategory ? [fromCategory] : [];
}

/** True when this kitchen/print station should see the dish line. */
export function orderItemMatchesPrintStation(
  item: {
    print_station_ids?: string[] | null;
    /** Legacy remake/enrich snapshot (single). Prefer print_station_ids. */
    print_station_id?: string | null;
  },
  printStationId: string,
): boolean {
  const ids = normalizePrintStationIds(item.print_station_ids);
  if (ids.length > 0) return ids.includes(printStationId);
  return Boolean(item.print_station_id && item.print_station_id === printStationId);
}
