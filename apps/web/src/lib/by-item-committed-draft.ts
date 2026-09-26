/**
 * Sole by-item dual-layer merge: server-backed committed shares vs unpaid local draft.
 * Realtime/persons hydrate may only rebuild committed — never reset draft.
 */
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import { splitPartyKey } from '@/lib/split-party-id';

export type ByItemAllocationRows = Record<string, ByItemConsumerRow[]>;

function rowTicketKey(row: Pick<ByItemConsumerRow, 'name' | 'partyId'>): string | null {
  return splitPartyKey(row.partyId, row.name);
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

/**
 * Working UI map = committed (persons) + draft overlay for unlocked tickets.
 * Locked tickets always come from committed; draft never paints over them.
 */
export function mergeByItemCommittedAndDraft(
  committed: ByItemAllocationRows,
  draft: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const draftTicketKeys = new Set<string>();
  for (const rows of Object.values(draft)) {
    for (const row of rows) {
      const key = rowTicketKey(row);
      if (!key || lockedTicketKeys.has(key)) continue;
      draftTicketKeys.add(key);
    }
  }

  const lineKeys = Array.from(
    new Set([...Object.keys(committed), ...Object.keys(draft)]),
  );
  const merged: ByItemAllocationRows = {};

  for (const lineKey of lineKeys) {
    const committedRows = committed[lineKey] ?? [];
    const draftRows = draft[lineKey] ?? [];
    const next: ByItemConsumerRow[] = [];

    for (const row of committedRows) {
      const key = rowTicketKey(row);
      if (key && draftTicketKeys.has(key) && !lockedTicketKeys.has(key)) continue;
      next.push(row);
    }
    for (const row of draftRows) {
      const key = rowTicketKey(row);
      if (!key || lockedTicketKeys.has(key)) continue;
      next.push(row);
    }
    if (next.length > 0) merged[lineKey] = next;
  }

  return merged;
}

/**
 * Persist only unlocked ticket rows into the draft layer (from a full working map).
 * Locked / paidLocked rows stay on committed and are not stored in draft.
 */
export function extractByItemDraftAllocations(
  working: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const draft: ByItemAllocationRows = {};
  for (const [lineKey, rows] of Object.entries(working)) {
    const kept = rows.filter((row) => {
      if (row.paidLocked) return false;
      const key = rowTicketKey(row);
      if (!key) return Boolean(row.name.trim());
      return !lockedTicketKeys.has(key);
    });
    if (kept.length > 0) draft[lineKey] = kept;
  }
  return draft;
}

/** Drop draft rows whose ticket is now locked (absorbed into committed). */
export function pruneByItemDraftAgainstLocks(
  draft: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  if (lockedTicketKeys.size === 0) return draft;
  return extractByItemDraftAllocations(draft, lockedTicketKeys);
}
