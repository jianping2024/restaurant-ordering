import {
  getByItemLineStatusFromRows,
  isByItemLineComplete,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';

/** Sole guest by-item dish-card expansion: one open key, or none. */
export type ByItemExpandedLineKey = string | null;

export function findFirstIncompleteLineKey(
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
  opts?: { exclude?: string },
): string | null {
  const match = lineSpecs.find((spec) => {
    if (opts?.exclude && spec.key === opts.exclude) return false;
    const rows = allocations[spec.key] ?? [];
    return !isByItemLineComplete(getByItemLineStatusFromRows(rows, spec));
  });
  return match?.key ?? null;
}

function isLineComplete(
  key: string,
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): boolean {
  const spec = lineSpecs.find((candidate) => candidate.key === key);
  if (!spec) return true;
  return isByItemLineComplete(getByItemLineStatusFromRows(allocations[key] ?? [], spec));
}

/**
 * Sole expansion reconcile for guest by-item cards.
 * - Uninitialized (`undefined`) → first incomplete (or null when all complete).
 * - `null` (user collapsed) → stay closed.
 * - Current key still incomplete → keep (manual open of another incomplete OK).
 * - Current key complete or gone → advance to first incomplete.
 */
export function reconcileByItemExpandedLineKey(
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
  current: ByItemExpandedLineKey | undefined,
): ByItemExpandedLineKey {
  const focus = findFirstIncompleteLineKey(lineSpecs, allocations);
  if (current === undefined) return focus;
  if (current === null) return null;
  if (!lineSpecs.some((spec) => spec.key === current)) return focus;
  if (isLineComplete(current, lineSpecs, allocations)) return focus;
  return current;
}

export function isByItemLineExpanded(
  key: string,
  expandedKey: ByItemExpandedLineKey | undefined,
): boolean {
  return expandedKey === key;
}

/**
 * Toggle one dish card. Collapsing a completed line advances to the next incomplete.
 */
export function toggleByItemExpandedLineKey(
  key: string,
  current: ByItemExpandedLineKey | undefined,
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): ByItemExpandedLineKey {
  if (current === key) {
    if (isLineComplete(key, lineSpecs, allocations)) {
      return findFirstIncompleteLineKey(lineSpecs, allocations, { exclude: key });
    }
    return null;
  }
  return key;
}
