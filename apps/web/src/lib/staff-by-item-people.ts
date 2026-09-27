/**
 * Sole staff by-item rail ticket helpers: ledger filter, seed, rename-safe merge.
 * Identity is {@link splitPartyKey} (party_id when present, else name).
 * Whole-table sentinel never becomes a chip; unlocked ledger tickets are not re-injected after rename.
 */
import { mintSplitPartyId, splitPartyKey } from '@/lib/split-party-id';
import { isWholeTablePayerName } from '@/lib/split-person-label';

/** One chip on the staff by-item rail (display name + optional atomic ticket id). */
export type StaffByItemRailPerson = {
  name: string;
  partyId?: string;
};

export function staffByItemRailPersonKey(person: StaffByItemRailPerson): string {
  return splitPartyKey(person.partyId, person.name);
}

/** Sole filter: tickets that may seed/order a by-item rail (never whole-table sentinel). */
export function staffByItemLedgerPeople(
  people: ReadonlyArray<StaffByItemRailPerson>,
): StaffByItemRailPerson[] {
  const seen = new Set<string>();
  const out: StaffByItemRailPerson[] = [];
  for (const raw of people) {
    const name = raw.name.trim();
    if (!name || isWholeTablePayerName(name)) continue;
    const partyId = raw.partyId?.trim() || undefined;
    const key = splitPartyKey(partyId, name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(partyId ? { name, partyId } : { name });
  }
  return out;
}

/** Sole initial rail seed: locked ledger tickets then coalesced allocation tickets. */
export function staffByItemRailSeedPeople(params: {
  ledgerPeople: ReadonlyArray<StaffByItemRailPerson>;
  allocationPeople: ReadonlyArray<StaffByItemRailPerson>;
}): StaffByItemRailPerson[] {
  return staffByItemLedgerPeople([
    ...params.ledgerPeople,
    ...params.allocationPeople,
  ]);
}

/**
 * Sole authoritative rail tickets from locks + allocations (no blank mint).
 * When `awaitingHydrate`, returns [] so UI does not mint a ghost「客人 1」before persons land.
 */
export function resolveStaffByItemRailPeople(params: {
  lockedLedgerPeople: ReadonlyArray<StaffByItemRailPerson>;
  allocationPeople: ReadonlyArray<StaffByItemRailPerson>;
  /** Guest-submitted persons exist but draft allocations not ready yet. */
  awaitingHydrate: boolean;
}): StaffByItemRailPerson[] {
  const seeded = staffByItemRailSeedPeople({
    ledgerPeople: params.lockedLedgerPeople,
    allocationPeople: params.allocationPeople,
  });
  if (seeded.length > 0) return seeded;
  if (params.awaitingHydrate) return [];
  return [];
}

/**
 * Sole rail sync after hydrate / seed change.
 * Authoritative tickets replace a prior roster with no overlap (drops early blank mint).
 * When there is overlap, append only (keeps serial-collect unpaid blanks).
 */
export function syncStaffByItemRailPeople(
  prev: StaffByItemRailPerson[],
  authoritative: StaffByItemRailPerson[],
): StaffByItemRailPerson[] {
  if (authoritative.length === 0) return prev;
  const authKeys = new Set(
    authoritative.map((person) => staffByItemRailPersonKey(person)).filter(Boolean),
  );
  const overlap = prev.some((person) => {
    const key = staffByItemRailPersonKey(person);
    return Boolean(key && authKeys.has(key));
  });
  if (!overlap) return staffByItemLedgerPeople(authoritative);
  return appendStaffByItemRailPeople(prev, authoritative);
}

/**
 * Sole continuous rail merge after mount: append only allocation tickets and
 * locked ledger tickets. Unlocked ledger names are omitted so in-place rename
 * cannot resurrect the old marker as a second chip.
 */
export function appendStaffByItemRailPeople(
  prev: StaffByItemRailPerson[],
  incoming: ReadonlyArray<StaffByItemRailPerson>,
): StaffByItemRailPerson[] {
  const seen = new Set(
    prev.map((person) => staffByItemRailPersonKey(person)).filter(Boolean),
  );
  let changed = false;
  const next = [...prev];
  for (const raw of incoming) {
    const name = raw.name.trim();
    if (!name || isWholeTablePayerName(name)) continue;
    const partyId = raw.partyId?.trim() || undefined;
    const key = splitPartyKey(partyId, name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(partyId ? { name, partyId } : { name });
    changed = true;
  }
  return changed ? next : prev;
}

/** Locked ledger tickets that must stay on the rail after partial collection. */
export function staffByItemLockedLedgerPeople(
  ledgerPeople: ReadonlyArray<StaffByItemRailPerson>,
  lockedTicketKeys: ReadonlySet<string>,
): StaffByItemRailPerson[] {
  return staffByItemLedgerPeople(ledgerPeople).filter((person) =>
    lockedTicketKeys.has(staffByItemRailPersonKey(person)),
  );
}

/** Mint a new unpaid rail ticket (serial collect handoff). */
export function mintStaffByItemRailPerson(name: string): StaffByItemRailPerson {
  return { name: name.trim(), partyId: mintSplitPartyId() };
}
