/**
 * Sole by-item fraction-unit rule: one dish line is cut one way.
 * A fractional share records the unit it was picked in (`qty_unit_den`, 2..5), because
 * `2/4` is stored as `1/2` and the cut cannot be recovered from qty alone.
 * Whoever reaches the server plan first fixes the unit; later writers must follow it.
 * Shares without a stored unit (old plans / old pages) fall back to their own denominator.
 */
import { normalizeRational, type Rational } from '@/lib/rational-qty';
import { splitPartyKey } from '@/lib/split-party-id';
import type { SplitPerson } from '@/types';

/** Units a dish can be cut into; whole portions (unit 1) carry no unit. */
export const FRACTION_UNIT_DENS = [2, 3, 4, 5] as const;

/** One unit of the cut: `1/unitDen` (unit 1 = a whole portion). Sole unit→qty map. */
export function fractionUnitQty(unitDen: number): Rational {
  return { num: 1, den: Math.max(1, Math.trunc(unitDen)) };
}

export type FractionUnitShare = { qty: Rational; unitDen?: number };

export function parseOptionalUnitDen(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return undefined;
  return (FRACTION_UNIT_DENS as readonly number[]).includes(raw) ? raw : undefined;
}

function fractionalShares(shares: ReadonlyArray<FractionUnitShare>) {
  return shares
    .map((share) => ({ den: normalizeRational(share.qty).den, unitDen: share.unitDen }))
    .filter((share) => share.den > 1);
}

function lcm(a: number, b: number): number {
  const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));
  return (a / gcd(a, b)) * b;
}

/** The cut this line already uses (explicit unit first, else inferred), or null when free. */
export function fractionUnitOfLine(
  shares: ReadonlyArray<FractionUnitShare>,
): number | null {
  const fractional = fractionalShares(shares);
  if (fractional.length === 0) return null;
  const explicit = fractional.find((share) => share.unitDen);
  if (explicit?.unitDen) return explicit.unitDen;
  return fractional.map((share) => share.den).reduce(lcm);
}

/** True when the line's fractional shares are not all cut the same way. */
export function fractionUnitConflict(shares: ReadonlyArray<FractionUnitShare>): boolean {
  const fractional = fractionalShares(shares);
  if (fractional.length === 0) return false;
  const explicit = Array.from(
    new Set(fractional.flatMap((share) => (share.unitDen ? [share.unitDen] : []))),
  );
  if (explicit.length > 1) return true;
  if (explicit.length === 1) {
    return fractional.some((share) => explicit[0]! % share.den !== 0);
  }
  // No stored unit (old plans): shares must nest in one cut the picker could have offered.
  const dens = fractional.map((share) => share.den);
  const largest = Math.max(...dens);
  if (dens.reduce(lcm) !== largest) return true;
  return new Set(dens).size > 1 && largest > Math.max(...FRACTION_UNIT_DENS);
}

/** Unit to store on a share: only fractional qty carries one. */
export function unitDenForQty(
  qty: Rational,
  unitDen: number | null | undefined,
): number | undefined {
  if (normalizeRational(qty).den <= 1) return undefined;
  return parseOptionalUnitDen(unitDen);
}

function sharesByLine(persons: ReadonlyArray<SplitPerson>) {
  const byLine = new Map<string, Array<FractionUnitShare & { ticket: string }>>();
  for (const person of persons) {
    const ticket = splitPartyKey(person.party_id, person.name);
    for (const share of person.item_shares ?? []) {
      const rows = byLine.get(share.key) ?? [];
      rows.push({
        ticket,
        qty: normalizeRational({ num: share.qty_num, den: share.qty_den }),
        unitDen: parseOptionalUnitDen(share.qty_unit_den),
      });
      byLine.set(share.key, rows);
    }
  }
  return byLine;
}

/** Line keys (within `scope`, default all) whose fractional shares are cut inconsistently. */
export function fractionUnitConflictLineKeys(
  persons: ReadonlyArray<SplitPerson>,
  scope?: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const [key, shares] of Array.from(sharesByLine(persons))) {
    if (scope && !scope.has(key)) continue;
    if (fractionUnitConflict(shares)) out.push(key);
  }
  return out;
}

/** Line keys whose fractional shares differ between two plans (what a write touched). */
export function changedFractionLineKeys(
  existing: ReadonlyArray<SplitPerson>,
  next: ReadonlyArray<SplitPerson>,
): Set<string> {
  const signature = (persons: ReadonlyArray<SplitPerson>) => {
    const out = new Map<string, string>();
    for (const [key, shares] of Array.from(sharesByLine(persons))) {
      const parts = shares
        .filter((share) => share.qty.den > 1)
        .map((share) => `${share.ticket}|${share.qty.num}/${share.qty.den}|${share.unitDen ?? ''}`)
        .sort();
      if (parts.length > 0) out.set(key, parts.join(';'));
    }
    return out;
  };
  const before = signature(existing);
  const after = signature(next);
  const changed = new Set<string>();
  for (const key of Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))) {
    if (before.get(key) !== after.get(key)) changed.add(key);
  }
  return changed;
}

/**
 * Lines whose fraction cut a write would change: the stored plan already has a cut on the
 * line and the new fractional shares are not cut the same way. A line left without fractional
 * shares changes nothing. Used to keep a staff draft from re-cutting a dish before collect.
 */
export function fractionCutChangedLineKeys(
  existing: ReadonlyArray<SplitPerson>,
  next: ReadonlyArray<SplitPerson>,
): string[] {
  const before = sharesByLine(existing);
  const after = sharesByLine(next);
  const out: string[] = [];
  for (const [key, nextShares] of Array.from(after)) {
    const stored = fractionUnitOfLine(before.get(key) ?? []);
    if (stored == null || stored > Math.max(...FRACTION_UNIT_DENS)) continue;
    const fractional = nextShares.filter((share) => normalizeRational(share.qty).den > 1);
    if (fractional.length === 0) continue;
    if (fractionUnitConflict([{ qty: fractionUnitQty(stored), unitDen: stored }, ...fractional])) {
      out.push(key);
    }
  }
  return out;
}
