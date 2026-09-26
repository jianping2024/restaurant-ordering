/**
 * Sole staff by-item rail person-name helpers: ledger filter, seed, rename-safe merge.
 * Whole-table sentinel never becomes a chip; unlocked ledger names are not re-injected after rename.
 */
import { splitPersonKey } from '@/lib/split-person-identity';
import { isWholeTablePayerName } from '@/lib/split-person-label';

/** Sole filter: names that may seed/order a by-item rail (never whole-table sentinel). */
export function staffByItemLedgerPersonNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || isWholeTablePayerName(name)) continue;
    const key = splitPersonKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Sole initial rail seed inputs: filtered ledger then allocation names (deduped). */
export function staffByItemRailSeedNames(params: {
  ledgerNames: readonly string[];
  allocationNames: readonly string[];
}): string[] {
  return staffByItemLedgerPersonNames([
    ...params.ledgerNames,
    ...params.allocationNames,
  ]);
}

/**
 * Sole continuous rail merge after mount: append only allocation names and
 * locked ledger names. Unlocked ledger names are omitted so in-place rename
 * cannot resurrect the old marker as a second chip.
 */
export function appendStaffByItemRailPeople(
  prev: string[],
  incoming: readonly string[],
): string[] {
  const seen = new Set(prev.map((name) => splitPersonKey(name)).filter(Boolean));
  let changed = false;
  const next = [...prev];
  for (const raw of incoming) {
    const name = raw.trim();
    if (!name || isWholeTablePayerName(name)) continue;
    const key = splitPersonKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(name);
    changed = true;
  }
  return changed ? next : prev;
}

/** Locked ledger markers that must stay on the rail after partial collection. */
export function staffByItemLockedLedgerNames(
  ledgerNames: readonly string[],
  lockedPersonKeys: ReadonlySet<string>,
): string[] {
  return staffByItemLedgerPersonNames(ledgerNames).filter((name) =>
    lockedPersonKeys.has(splitPersonKey(name)),
  );
}
