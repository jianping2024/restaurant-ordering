import {
  getByItemLineStatusFromRows,
  isByItemLineComplete,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';

export type ByItemLineExpansionState = Record<string, boolean>;

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

export function defaultExpandedLineKey(
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): string | null {
  return findFirstIncompleteLineKey(lineSpecs, allocations) ?? lineSpecs[0]?.key ?? null;
}

/** Seed expansion only before any user toggle (empty expansion map). */
export function seedInitialLineExpansion(
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
  expanded: ByItemLineExpansionState,
): ByItemLineExpansionState {
  if (Object.keys(expanded).length > 0) return expanded;
  const key = defaultExpandedLineKey(lineSpecs, allocations);
  if (!key) return expanded;
  return { [key]: true };
}

export function isByItemLineExpanded(
  key: string,
  expanded: ByItemLineExpansionState,
): boolean {
  return expanded[key] ?? false;
}

/**
 * Toggle one dish card. Collapsing a completed line auto-opens the next incomplete line.
 */
export function toggleByItemLineExpansion(
  key: string,
  expanded: ByItemLineExpansionState,
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): ByItemLineExpansionState {
  const currentlyExpanded = expanded[key] ?? false;
  const next: ByItemLineExpansionState = { ...expanded, [key]: !currentlyExpanded };

  if (!currentlyExpanded) return next;

  const spec = lineSpecs.find((candidate) => candidate.key === key);
  if (!spec) return next;

  const status = getByItemLineStatusFromRows(allocations[key] ?? [], spec);
  if (!isByItemLineComplete(status)) return next;

  const nextIncomplete = findFirstIncompleteLineKey(lineSpecs, allocations, { exclude: key });
  if (nextIncomplete) next[nextIncomplete] = true;

  return next;
}
