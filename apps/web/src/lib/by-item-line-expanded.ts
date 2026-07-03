/** UI expand/collapse resolution — all dish lines default expanded. */
export function resolveByItemLineExpanded(override: boolean | undefined): boolean {
  return override ?? true;
}

export const BY_ITEM_LINE_DEFAULT_EXPANDED = true;
