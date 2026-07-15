/** Stable person identity for split allocation, merge, and ledger matching. */
export function splitPersonKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Default display label: Latin names title-cased; other scripts unchanged. */
export function displaySplitPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/^[A-Za-z]/.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return trimmed;
}

/** Prefer existing spelling when continuing a split row; otherwise normalize display. */
export function resolveSplitPersonDisplayName(
  existingName: string | undefined,
  incomingName: string,
): string {
  const existing = existingName?.trim();
  if (existing) return existing;
  return displaySplitPersonName(incomingName);
}
