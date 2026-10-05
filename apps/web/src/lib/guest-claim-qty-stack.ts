/**
 * Sole guest by-item qty chrome (no keyboard): preset unit 1|½|⅓|¼|⅕ then ± stack.
 * Wire stays whole+num/den via {@link rationalToRowQtyFields}.
 */
import {
  rationalToRowQtyFields,
  type ByItemConsumerRow,
} from './bill-split-by-item';
import {
  addRationals,
  compareRationals,
  formatRational,
  normalizeRational,
  type Rational,
} from './rational-qty';

/** Denominators offered before a line’s fraction method is locked. */
export const GUEST_CLAIM_UNIT_DENS = [1, 2, 3, 4, 5] as const;
export type GuestClaimUnitDen = (typeof GUEST_CLAIM_UNIT_DENS)[number];

function lcm(a: number, b: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (!x || !y) return x || y || 1;
  const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));
  return (x / gcd(x, y)) * y;
}

/**
 * When others already used a fraction method on the line, everyone must follow that den.
 * Whole-only shares (normalized den === 1) do not lock. Mixed dens → LCM.
 */
export function lockedGuestClaimUnitDen(
  othersQtys: ReadonlyArray<Rational>,
): number | null {
  let locked: number | null = null;
  for (const qty of othersQtys) {
    const { den } = normalizeRational(qty);
    if (den <= 1) continue;
    locked = locked == null ? den : lcm(locked, den);
  }
  return locked;
}

/** Presets shown for the unit picker (locked line → only 1 and 1/lockedDen). */
export function guestClaimUnitPresets(lockedDen: number | null): number[] {
  if (lockedDen != null && lockedDen > 1) return [1, lockedDen];
  return [...GUEST_CLAIM_UNIT_DENS];
}

export function rationalFromGuestClaimRow(
  row: Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>,
): Rational {
  const whole = Number.parseInt(row.qtyWhole.trim() || '0', 10);
  const num = Number.parseInt(row.qtyNum.trim() || '0', 10);
  const denRaw = Number.parseInt(row.qtyDen.trim() || '0', 10);
  const w = Number.isFinite(whole) ? whole : 0;
  const n = Number.isFinite(num) ? num : 0;
  const den = Number.isFinite(denRaw) && denRaw > 0 ? denRaw : 1;
  if (w === 0 && n === 0) return { num: 0, den: 1 };
  return normalizeRational({ num: w * den + n, den });
}

export function formatGuestClaimQtyLabel(qty: Rational): string {
  const n = normalizeRational(qty);
  if (n.num <= 0) return '0';
  return formatRational(n);
}

export function guestClaimUnitRational(den: number): Rational {
  const d = Math.max(1, Math.trunc(den));
  return d === 1 ? { num: 1, den: 1 } : { num: 1, den: d };
}

/**
 * Add one unit of `unitDen` when remaining allows. Returns null when + must stay disabled.
 */
export function stackGuestClaimUnit(params: {
  current: Rational;
  unitDen: number;
  remaining: Rational;
}): Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'> | null {
  const unit = guestClaimUnitRational(params.unitDen);
  const next = addRationals(params.current, unit);
  if (compareRationals(next, params.remaining) > 0) return null;
  return rationalToRowQtyFields(next);
}

/**
 * Remove one unit of `unitDen` (floor at 0). Returns null when − must stay disabled.
 */
export function unstackGuestClaimUnit(params: {
  current: Rational;
  unitDen: number;
}): Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'> | null {
  const unit = guestClaimUnitRational(params.unitDen);
  if (compareRationals(params.current, unit) < 0) {
    if (params.current.num <= 0) return null;
    return rationalToRowQtyFields({ num: 0, den: 1 });
  }
  const next = normalizeRational({
    num: params.current.num * unit.den - unit.num * params.current.den,
    den: params.current.den * unit.den,
  });
  if (next.num <= 0) return { qtyWhole: '', qtyNum: '', qtyDen: '' };
  return rationalToRowQtyFields(next);
}

export function canStackGuestClaimUnit(params: {
  current: Rational;
  unitDen: number;
  remaining: Rational;
}): boolean {
  return stackGuestClaimUnit(params) != null;
}

export function canUnstackGuestClaimUnit(params: {
  current: Rational;
  unitDen: number;
}): boolean {
  return params.current.num > 0;
}
