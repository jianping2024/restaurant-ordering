/**
 * Sole guest by-item sync reconcile (phone editor).
 * Locked server rows overwrite; unpaid local edits keep; new lines only append defaults.
 * Never whole-replace local unpaid draft when lineSpecs expand.
 */
import {
  normalizeByItemDraftPartyIds,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  extractByItemLockedAllocations,
  mergeMissingByItemDraftTickets,
  type ByItemAllocationRows,
} from '@/lib/by-item-committed-draft';
import { splitPartyKey } from '@/lib/split-party-id';

function rowTicketKey(row: Pick<ByItemConsumerRow, 'name' | 'partyId'>): string | null {
  return splitPartyKey(row.partyId, row.name);
}

function isNamedRow(row: Pick<ByItemConsumerRow, 'name'>): boolean {
  return Boolean(row.name.trim());
}

/**
 * Extract named unlocked rows + unnamed add-consumer slots from the local draft.
 * Locked tickets belong to the server overlay and are dropped here.
 */
function extractGuestLocalDraft(
  prev: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const draft: ByItemAllocationRows = {};
  for (const [lineKey, rows] of Object.entries(prev)) {
    const kept = rows.filter((row) => {
      if (!isNamedRow(row)) return true;
      if (row.paidLocked) return false;
      const key = rowTicketKey(row);
      return !key || !lockedTicketKeys.has(key);
    });
    if (kept.length > 0) draft[lineKey] = kept;
  }
  return draft;
}

/**
 * Extract named unlocked rows from a persons hydrate map (server unpaid tickets).
 */
function extractGuestServerUnlocked(
  serverRows: ByItemAllocationRows,
  lockedTicketKeys: ReadonlySet<string>,
): ByItemAllocationRows {
  const unlocked: ByItemAllocationRows = {};
  for (const [lineKey, rows] of Object.entries(serverRows)) {
    const kept = rows.filter((row) => {
      if (!isNamedRow(row) || row.paidLocked) return false;
      const key = rowTicketKey(row);
      return Boolean(key && !lockedTicketKeys.has(key));
    });
    if (kept.length > 0) unlocked[lineKey] = kept;
  }
  return unlocked;
}

/** Merge locked committed + guest draft (keeps unnamed slots unlike staff merge). */
function mergeGuestCommittedAndDraft(
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
      if (row.paidLocked) continue;
      if (!isNamedRow(row)) {
        next.push(row);
        continue;
      }
      const key = rowTicketKey(row);
      if (!key || lockedTicketKeys.has(key)) continue;
      next.push(row);
    }
    if (next.length > 0) merged[lineKey] = next;
  }

  return merged;
}

export function reconcileGuestByItemAllocations(params: {
  prev: ByItemAllocationRows;
  serverRows: ByItemAllocationRows;
  lineSpecs: ByItemLineSpec[];
  lockedTicketKeys: ReadonlySet<string>;
}): ByItemAllocationRows {
  const { prev, serverRows, lineSpecs, lockedTicketKeys } = params;
  const locked = extractByItemLockedAllocations(serverRows, lockedTicketKeys);
  const localDraft = extractGuestLocalDraft(prev, lockedTicketKeys);
  const withMissing = mergeMissingByItemDraftTickets(
    localDraft,
    extractGuestServerUnlocked(serverRows, lockedTicketKeys),
  );
  const merged = mergeGuestCommittedAndDraft(locked, withMissing, lockedTicketKeys);
  return normalizeByItemDraftPartyIds(
    withDefaultByItemLineRows(merged, lineSpecs),
    lockedTicketKeys,
  );
}

/**
 * Sole guest refresh restore of this phone's local by-item draft.
 * Local unpaid rows win (newer than the server snapshot, e.g. edits after
 * checkout → resume ordering); only server-locked rows overlay. Server unpaid
 * tickets are not re-added, so shares the guest removed stay removed.
 */
export function restoreGuestByItemLocalDraft(params: {
  localRows: ByItemAllocationRows;
  serverRows: ByItemAllocationRows;
  lineSpecs: ByItemLineSpec[];
  lockedTicketKeys: ReadonlySet<string>;
}): ByItemAllocationRows {
  const { localRows, serverRows, lineSpecs, lockedTicketKeys } = params;
  return reconcileGuestByItemAllocations({
    prev: localRows,
    serverRows: extractByItemLockedAllocations(serverRows, lockedTicketKeys),
    lineSpecs,
    lockedTicketKeys,
  });
}
