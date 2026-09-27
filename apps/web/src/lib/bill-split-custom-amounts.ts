import { centsToEuros, eurosToCents } from '@/lib/money-allocation';

export type CustomAmountRow = {
  name: string;
  amount: number;
};

export function customAmountRowsEqual(
  a: readonly CustomAmountRow[],
  b: readonly CustomAmountRow[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, idx) =>
      row.name === b[idx]!.name
      && eurosToCents(row.amount) === eurosToCents(b[idx]!.amount),
  );
}

/** Next default guest label not already used on the custom roster. */
export function mintNextCustomGuestName(
  rows: readonly { name: string }[],
  guestName: (n: number) => string,
): string {
  const used = new Set(
    rows.map((row) => row.name.trim().toLowerCase()).filter(Boolean),
  );
  for (let n = 1; n <= 20; n += 1) {
    const candidate = guestName(n);
    if (!used.has(candidate.trim().toLowerCase())) return candidate;
  }
  return guestName(rows.length + 1);
}

/**
 * Sole seed for a fresh single-payer custom draft: that row carries the full bill.
 * Multi-person rows are returned unchanged (caller keeps prior / continuation amounts).
 */
export function seedCustomSoloFullAmount(
  rows: readonly CustomAmountRow[],
  total: number,
): CustomAmountRow[] {
  if (rows.length !== 1) {
    return rows.map((row) => ({ name: row.name, amount: row.amount }));
  }
  const amount = centsToEuros(eurosToCents(total));
  return [{ name: rows[0]!.name, amount }];
}

/**
 * Sole custom roster invariant:
 * - sole row at 0 → full bill
 * - sole row below bill → append one remainder person
 * - sole row at/above bill → clamp to bill
 * - 2+ rows → last row is the remainder (non-last left as stored, clamped so sum ≤ bill)
 */
export function ensureCustomRemainderRoster(
  rows: readonly CustomAmountRow[],
  total: number,
  nextGuestName: string,
): CustomAmountRow[] {
  if (rows.length === 0) return [];

  const totalCents = eurosToCents(total);

  if (rows.length === 1) {
    const sole = rows[0]!;
    const soleCents = eurosToCents(sole.amount);
    if (soleCents <= 0) {
      return seedCustomSoloFullAmount(rows, total);
    }
    if (soleCents < totalCents) {
      return [
        { name: sole.name, amount: centsToEuros(soleCents) },
        {
          name: nextGuestName,
          amount: centsToEuros(totalCents - soleCents),
        },
      ];
    }
    return [{ name: sole.name, amount: centsToEuros(totalCents) }];
  }

  const next = rows.map((row) => ({ name: row.name, amount: row.amount }));
  let manualCents = 0;
  for (let i = 0; i < next.length - 1; i += 1) {
    const room = Math.max(0, totalCents - manualCents);
    const clamped = Math.min(Math.max(0, eurosToCents(next[i]!.amount)), room);
    next[i] = { name: next[i]!.name, amount: centsToEuros(clamped) };
    manualCents += clamped;
  }
  next[next.length - 1] = {
    name: next[next.length - 1]!.name,
    amount: centsToEuros(Math.max(0, totalCents - manualCents)),
  };
  return next;
}

/**
 * Sole custom amount commit path:
 * - clamps so manual (non-last) shares cannot exceed the bill
 * - then runs ensureCustomRemainderRoster (1→2 auto remainder; last = remainder)
 * Does not remove people when the first share returns to full (roster stays add/remove).
 */
export function applyCustomAmountEdit(params: {
  rows: readonly CustomAmountRow[];
  index: number;
  rawValue: string;
  total: number;
  nextGuestName: string;
}): CustomAmountRow[] {
  const { rows, index, rawValue, total, nextGuestName } = params;
  if (rows.length === 0 || index < 0 || index >= rows.length) {
    return rows.map((row) => ({ name: row.name, amount: row.amount }));
  }

  // Last row is remainder when length ≥ 2 — not manually editable.
  if (rows.length >= 2 && index === rows.length - 1) {
    return ensureCustomRemainderRoster(rows, total, nextGuestName);
  }

  const totalCents = eurosToCents(total);
  const parsed = Number(rawValue);
  const safeCents = Number.isFinite(parsed)
    ? Math.max(0, eurosToCents(parsed))
    : 0;

  const lastIdx = rows.length - 1;
  const manualOthersCents = rows.reduce((sum, row, idx) => {
    if (idx === index || (rows.length >= 2 && idx === lastIdx)) return sum;
    return sum + eurosToCents(row.amount);
  }, 0);
  const maxAllowedCents = Math.max(0, totalCents - manualOthersCents);
  const nextCents = Math.min(safeCents, maxAllowedCents);
  const nextAmount = centsToEuros(nextCents);

  const edited = rows.map((row, idx) =>
    idx === index ? { ...row, amount: nextAmount } : { name: row.name, amount: row.amount },
  );
  return ensureCustomRemainderRoster(edited, total, nextGuestName);
}
