/**
 * Sole by-item dual-layer merge: locked committed shares vs unpaid local draft.
 *
 * Contract (one representation):
 * - committed = paidLocked / locked-ticket rows only (Realtime may rebuild)
 * - draft = named unpaid editable rows only (never unnamed seeds)
 * - Unlocked persons never live in committed; seed into draft once at hook level
 */
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import { splitPartyKey } from '@/lib/split-party-id';

export type ByItemAllocationRows = Record<string, ByItemConsumerRow[]>;

function rowTicketKey(row: Pick<ByItemConsumerRow, 'name' | 'partyId'>): string | null {
  return splitPartyKey(row.partyId, row.name);
}

function isNamedRow(row: Pick<ByItemConsumerRow, 'name'>): boolean {
  return Boolean(row.name.trim());
}

/** Ticket keys present in a by-item row map (named rows only). */
export function byItemAllocationTicketKeys(
  allocations: ByItemAllocationRows,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const rows of Object.values(allocations)) {
    for (const row of rows) {
      const key = rowTicketKey(row);
      if (key) keys.add(key);
    }
  }
  return keys;
}

/** True when draft has any named (non-seed) row. */
export function byItemDraftHasNamedRows(allocations: ByItemAllocationRows): boolean {
  for (const rows of Object.values(allocations)) {
    if (rows.some(isNamedRow)) return true;
  }
  return false;
}

/**
 * Sole filter: locked UI rows from a persons hydrate map.
 * Keeps paidLocked rows and rows whose ticket is in lockedTicketKeys.
 * Drops unnamed seeds and unlocked editable shares (those belong in draft only).
 */
export function extractByItemLockedAllocations(
  working: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const locked: ByItemAllocationRows = {};
  for (const [lineKey, rows] of Object.entries(working)) {
    const kept = rows.filter((row) => {
      if (!isNamedRow(row)) return false;
      if (row.paidLocked) return true;
      const key = rowTicketKey(row);
      return Boolean(key && lockedTicketKeys.has(key));
    });
    if (kept.length > 0) locked[lineKey] = kept;
  }
  return locked;
}

/**
 * Working UI map = locked committed + unpaid draft.
 * Draft never paints over locked tickets; committed must already be locked-only.
 */
export function mergeByItemCommittedAndDraft(
  committed: ByItemAllocationRows,
  draft: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const lineKeys = Array.from(
    new Set([...Object.keys(committed), ...Object.keys(draft)]),
  );
  const merged: ByItemAllocationRows = {};

  for (const lineKey of lineKeys) {
    const next: ByItemConsumerRow[] = [...(committed[lineKey] ?? [])];
    for (const row of draft[lineKey] ?? []) {
      if (!isNamedRow(row) || row.paidLocked) continue;
      const key = rowTicketKey(row);
      if (!key || lockedTicketKeys.has(key)) continue;
      next.push(row);
    }
    if (next.length > 0) merged[lineKey] = next;
  }

  return merged;
}

/**
 * Persist only named unpaid ticket rows into the draft layer.
 * Drops paidLocked, locked tickets, and unnamed seeds (even if they carry partyId).
 */
export function extractByItemDraftAllocations(
  working: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const draft: ByItemAllocationRows = {};
  for (const [lineKey, rows] of Object.entries(working)) {
    const kept = rows.filter((row) => {
      if (row.paidLocked || !isNamedRow(row)) return false;
      const key = rowTicketKey(row);
      if (!key) return true;
      return !lockedTicketKeys.has(key);
    });
    if (kept.length > 0) draft[lineKey] = kept;
  }
  return draft;
}

/** Drop locked-ticket rows and unnamed seeds from draft. */
export function pruneByItemDraftAgainstLocks(
  draft: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  return extractByItemDraftAllocations(draft, lockedTicketKeys);
}
