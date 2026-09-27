/**
 * Sole staff by-item rail ticket helpers: ledger filter, seed, rename-safe merge.
 * Identity is {@link splitPartyKey} (party_id when present, else name).
 * Whole-table sentinel never becomes a chip; unlocked ledger tickets are not re-injected after rename.
 */
import { mintSplitPartyId, splitPartyKey } from '@/lib/split-party-id';
import { isWholeTablePayerName } from '@/lib/split-person-label';

/** Placeholder serial-mint labels (客人 N / Guest N / Pessoa N) — not guest-submitted names. */
const DEFAULT_GUEST_RAIL_NAME_RE = /^(?:客人|Guest|Pessoa)\s*\d+$/i;

/** True when the chip is still a default serial-collect blank (not a real ticket name). */
export function isDefaultGuestRailName(name: string): boolean {
  return DEFAULT_GUEST_RAIL_NAME_RE.test(name.trim());
}

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
 * While `awaitingHydrate`, only locked ledger chips — unpaid persons land via draft
 * hydrate into allocationPeople; do not treat a partial alloc roster as complete.
 */
export function resolveStaffByItemRailPeople(params: {
  lockedLedgerPeople: ReadonlyArray<StaffByItemRailPerson>;
  allocationPeople: ReadonlyArray<StaffByItemRailPerson>;
  /** Guest-submitted persons exist but draft allocations not ready yet. */
  awaitingHydrate: boolean;
}): StaffByItemRailPerson[] {
  if (params.awaitingHydrate) {
    return staffByItemLedgerPeople(params.lockedLedgerPeople);
  }
  return staffByItemRailSeedPeople({
    ledgerPeople: params.lockedLedgerPeople,
    allocationPeople: params.allocationPeople,
  });
}

/**
 * Sole rail sync after hydrate / seed change.
 * - No overlap → replace (drops early blank mint).
 * - Auth gains new tickets (persons hydrate) → auth wins; drop default guest blanks.
 * - Overlap, no new auth tickets → append only (keeps in-progress serial-collect blank).
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

  const prevKeys = new Set(
    prev.map((person) => staffByItemRailPersonKey(person)).filter(Boolean),
  );
  const authHasNew = authoritative.some((person) => {
    const key = staffByItemRailPersonKey(person);
    return Boolean(key && !prevKeys.has(key));
  });
  if (authHasNew) {
    const renamedExtras = prev.filter((person) => {
      const key = staffByItemRailPersonKey(person);
      if (!key || authKeys.has(key)) return false;
      return !isDefaultGuestRailName(person.name);
    });
    return staffByItemLedgerPeople([...authoritative, ...renamedExtras]);
  }
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
