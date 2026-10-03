import {
  getByItemLineStatusFromRows,
  isByItemLineComplete,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';

/** Sole guest by-item dish-card expansion: one open key, or none. */
export type ByItemExpandedLineKey = string | null;

export type ReconcileByItemExpandedLineKeyOpts = {
  /**
   * While the user is editing inside the open card (or the name suggestion rail),
   * do not auto-advance/collapse even if the line just became complete.
   * Manual toggle clears hold at the call site.
   */
  holdWhileEditing?: boolean;
};

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
 * True when focus belongs to the open dish card or the consumer-name suggestion rail
 * (rail is portaled to `document.body`, so it is outside the card DOM).
 */
export function isByItemExpansionHoldTarget(
  node: EventTarget | null | undefined,
  expandedKey: string | null,
): boolean {
  if (!expandedKey || node == null) return false;
  // Node unit tests have no DOM `Element`; browser focus handlers always pass Elements.
  if (typeof Element === 'undefined' || !(node instanceof Element)) return false;
  if (node.closest('[data-consumer-name-rail="1"]')) return true;
  const card = node.closest('[data-by-item-line-key]');
  return card?.getAttribute('data-by-item-line-key') === expandedKey;
}

/**
 * Sole expansion reconcile for guest by-item cards.
 * - Uninitialized (`undefined`) → first incomplete (or null when all complete).
 * - `null` (user collapsed) → stay closed.
 * - Current key still incomplete → keep (manual open of another incomplete OK).
 * - Current key complete or gone → advance to first incomplete — unless
 *   `holdWhileEditing` (mid-edit must not unmount the focused field).
 */
export function reconcileByItemExpandedLineKey(
  lineSpecs: readonly ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
  current: ByItemExpandedLineKey | undefined,
  opts?: ReconcileByItemExpandedLineKeyOpts,
): ByItemExpandedLineKey {
  const focus = findFirstIncompleteLineKey(lineSpecs, allocations);
  if (current === undefined) return focus;
  if (current === null) return null;
  if (!lineSpecs.some((spec) => spec.key === current)) return focus;
  if (isLineComplete(current, lineSpecs, allocations)) {
    if (opts?.holdWhileEditing) return current;
    return focus;
  }
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
