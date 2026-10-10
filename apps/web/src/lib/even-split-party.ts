/**
 * Sole even-split person identity: stable `party_id` (same mint as by-item).
 * Name is a label; seat order is only for display / even amounts.
 *
 * Do not import checkout-split-continuation here (that module imports this one).
 */
import { isWholeTablePayerName } from './split-person-label';
import { mintSplitPartyId, parseOptionalPartyId } from './split-party-id';
import type { BillSplit } from '../types';

export type EvenPersonDraft = {
  /** React key + wire party_id (UUID). */
  partyId: string;
  name: string;
};

function clampEvenCount(count: number): number {
  const raw = !Number.isFinite(count) ? 1 : Math.round(count);
  return Math.min(20, Math.max(1, raw));
}

/**
 * Sole even roster length from a persisted split.
 * When persons/result lengths diverge (legacy rename-append), prefer persons
 * (last client roster) so UI does not invent extra seats from orphan result rows.
 */
export function evenAuthoritativeRowCount(split: BillSplit | null | undefined): number {
  if (!split) return 0;
  const personsLen = split.persons?.length ?? 0;
  const resultLen = split.result?.length ?? 0;
  if (personsLen > 0 && resultLen > 0 && personsLen !== resultLen) {
    return personsLen;
  }
  return Math.max(personsLen, resultLen);
}

/** Hydrate even drafts from continuation persons/result (party_id preferred). */
export function evenPersonDraftsFromSplit(
  split: BillSplit | null | undefined,
  guestName: (n: number) => string,
): EvenPersonDraft[] | null {
  if (!split || split.split_mode !== 'even') return null;
  const count = evenAuthoritativeRowCount(split);
  if (count < 1) return null;

  const personCount = clampEvenCount(count);
  const drafts: EvenPersonDraft[] = [];
  const preferPersons =
    (split.persons?.length ?? 0) > 0 &&
    (split.persons?.length ?? 0) !== (split.result?.length ?? 0);

  for (let i = 0; i < personCount; i += 1) {
    const person = split.persons?.[i];
    const resultRow = split.result?.[i];
    const fromPersonName = person?.name?.trim() ?? '';
    const fromResultName = resultRow?.name?.trim() ?? '';
    const rawName = preferPersons
      ? fromPersonName || fromResultName
      : fromResultName || fromPersonName;
    const name =
      rawName && !isWholeTablePayerName(rawName) ? rawName : guestName(i + 1);

    const partyId =
      parseOptionalPartyId(person?.party_id) ??
      parseOptionalPartyId(resultRow?.party_id) ??
      findPartyIdByName(split, name) ??
      mintSplitPartyId();

    drafts.push({ partyId, name });
  }
  return drafts;
}

function findPartyIdByName(split: BillSplit, name: string): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  for (const row of split.result ?? []) {
    if (row.name.trim().toLowerCase() !== key) continue;
    const id = parseOptionalPartyId(row.party_id);
    if (id) return id;
  }
  for (const person of split.persons ?? []) {
    if (person.name.trim().toLowerCase() !== key) continue;
    const id = parseOptionalPartyId(person.party_id);
    if (id) return id;
  }
  return undefined;
}

/**
 * Sole even draft roster: pad/truncate to count, keep party_id per seat,
 * mint when missing; blank / whole-table names → guestName(i+1).
 */
export function ensureEvenPersonDrafts(
  people: ReadonlyArray<{ partyId?: string; name: string }>,
  count: number,
  guestName: (n: number) => string,
): EvenPersonDraft[] {
  const n = clampEvenCount(count);
  const next: EvenPersonDraft[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = people[i];
    const raw = prev?.name?.trim() ?? '';
    const name = raw && !isWholeTablePayerName(raw) ? raw : guestName(i + 1);
    const partyId = parseOptionalPartyId(prev?.partyId) ?? mintSplitPartyId();
    next.push({ partyId, name });
  }
  return next;
}

/** Default even roster (1 seat) with a fresh party_id. */
export function defaultEvenPersonDrafts(guestName: (n: number) => string): EvenPersonDraft[] {
  return ensureEvenPersonDrafts([], 1, guestName);
}

/** Paid / ledger-locked even seats — rename blocked by party_id (not name). */
export function allocationLockedEvenPartyIds(
  split: BillSplit | null | undefined,
  collectedPayments: ReadonlyArray<{ person_index: number | null }> = [],
): ReadonlySet<string> {
  const ids = new Set<string>();
  const result = split?.result ?? [];
  for (const row of result) {
    if (!row.paid) continue;
    const id = parseOptionalPartyId(row.party_id);
    if (id) ids.add(id);
  }
  for (const payment of collectedPayments) {
    if (payment.person_index == null || payment.person_index < 0) continue;
    const row = result[payment.person_index];
    const id = parseOptionalPartyId(row?.party_id);
    if (id) ids.add(id);
  }
  return ids;
}
