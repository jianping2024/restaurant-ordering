/**
 * Effective thermal station for a dish: item override, else first non-null
 * print_station_id walking up menu_categories via parent_id (ancestor chain).
 */

export type PrintStationCategoryRow = {
  id: string;
  parent_id?: string | null;
  print_station_id?: string | null;
};

export function resolveEffectivePrintStationId(
  itemPrintStationId: string | null | undefined,
  categoryId: string | null | undefined,
  categories: PrintStationCategoryRow[],
): string | null {
  if (itemPrintStationId) return itemPrintStationId;
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
