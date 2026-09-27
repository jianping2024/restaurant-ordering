import { centsToEuros, eurosToCents } from '@/lib/money-allocation';

export type CustomAmountRow = {
  name: string;
  amount: number;
};

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
 * Sole multi-row bill balance: non-last rows stay (clamped so sum ≤ bill);
 * last row absorbs the remainder. Does not append people.
 */
export function rebalanceCustomRowsToBill(
  rows: readonly CustomAmountRow[],
  total: number,
): CustomAmountRow[] {
  if (rows.length === 0) return [];
  if (rows.length === 1) return seedCustomSoloFullAmount(rows, total);

  const totalCents = eurosToCents(total);
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
 * Sole custom amount commit path (does not change roster size):
 * - 1 person: clamp amount to [0, bill]
 * - ≥2: every row editable; absorb into last unless editing last → absorb into second-last
 */
export function applyCustomAmountEdit(params: {
  rows: readonly CustomAmountRow[];
  index: number;
  rawValue: string;
  total: number;
}): CustomAmountRow[] {
  const { rows, index, rawValue, total } = params;
  if (rows.length === 0 || index < 0 || index >= rows.length) {
    return rows.map((row) => ({ name: row.name, amount: row.amount }));
  }

  const totalCents = eurosToCents(total);
  const parsed = Number(rawValue);
  const safeCents = Number.isFinite(parsed)
    ? Math.max(0, eurosToCents(parsed))
    : 0;

  if (rows.length === 1) {
    const nextCents = Math.min(safeCents, totalCents);
    return [{ name: rows[0]!.name, amount: centsToEuros(nextCents) }];
  }

  const lastIdx = rows.length - 1;
  const absorbIdx = index === lastIdx ? lastIdx - 1 : lastIdx;
  const fixedOthersCents = rows.reduce((sum, row, idx) => {
    if (idx === index || idx === absorbIdx) return sum;
    return sum + eurosToCents(row.amount);
  }, 0);
  const maxAllowedCents = Math.max(0, totalCents - fixedOthersCents);
  const nextCents = Math.min(safeCents, maxAllowedCents);
  const absorbCents = Math.max(0, totalCents - fixedOthersCents - nextCents);

  return rows.map((row, idx) => {
    if (idx === index) return { name: row.name, amount: centsToEuros(nextCents) };
    if (idx === absorbIdx) return { name: row.name, amount: centsToEuros(absorbCents) };
    return { name: row.name, amount: row.amount };
  });
}

/**
 * Sole “+ add person” path: append one row whose amount is bill − sum(existing).
 * Does not change existing amounts.
 */
export function appendCustomPersonWithRemainder(
  rows: readonly CustomAmountRow[],
  total: number,
  nextGuestName: string,
): CustomAmountRow[] {
  const totalCents = eurosToCents(total);
  const usedCents = rows.reduce((sum, row) => sum + eurosToCents(row.amount), 0);
  const remainderCents = Math.max(0, totalCents - usedCents);
  return [
    ...rows.map((row) => ({ name: row.name, amount: row.amount })),
    { name: nextGuestName, amount: centsToEuros(remainderCents) },
  ];
}

/**
 * Sole post-remove roster path (rows already filtered):
 * - 1 person → full bill
 * - ≥2 → rebalanceCustomRowsToBill (last absorbs; no auto-append)
 */
export function afterRemoveCustomPerson(
  rows: readonly CustomAmountRow[],
  total: number,
): CustomAmountRow[] {
  if (rows.length === 0) return [];
  if (rows.length === 1) return seedCustomSoloFullAmount(rows, total);
  return rebalanceCustomRowsToBill(rows, total);
}
