/** Gap between category pills in the compact row (matches `gap-2`). */
export const CUSTOMER_MENU_CATEGORY_ROW_GAP_PX = 8;

/**
 * How many top-category pills fit in one row.
 * If every chip fits, return all (no More). Otherwise reserve More and pack the rest.
 */
export function countVisibleCategoryPills({
  containerWidth,
  chipWidths,
  moreWidth,
  gap = CUSTOMER_MENU_CATEGORY_ROW_GAP_PX,
}: {
  containerWidth: number;
  chipWidths: number[];
  moreWidth: number;
  gap?: number;
}): number {
  const count = chipWidths.length;
  if (count === 0 || containerWidth <= 0) return 0;

  const rowWidth = (widths: number[]) =>
    widths.reduce((sum, width, index) => sum + width + (index > 0 ? gap : 0), 0);

  if (rowWidth(chipWidths) <= containerWidth) return count;

  const moreBudget = Math.max(0, containerWidth - moreWidth - (moreWidth > 0 ? gap : 0));
  let used = 0;
  let visible = 0;
  for (const width of chipWidths) {
    const next = visible === 0 ? width : used + gap + width;
    if (next > moreBudget) break;
    used = next;
    visible += 1;
  }
  return visible;
}
