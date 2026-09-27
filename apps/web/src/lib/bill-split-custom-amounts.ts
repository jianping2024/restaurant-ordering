import { centsToEuros, eurosToCents } from '@/lib/money-allocation';

export type CustomAmountRow = {
  name: string;
  amount: number;
};

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
 * Sole custom amount commit path:
 * - clamps so manual (non-last) shares cannot exceed the bill
 * - writes the last row as the remainder when length ≥ 2
 * - when the sole row is set below total, appends one remainder person
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
    return rows.map((row) => ({ name: row.name, amount: row.amount }));
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

  if (rows.length === 1) {
    const sole = { name: rows[0]!.name, amount: nextAmount };
    if (nextCents < totalCents) {
      return [
        sole,
        {
          name: nextGuestName,
          amount: centsToEuros(totalCents - nextCents),
        },
      ];
    }
    return [sole];
  }

  const next = rows.map((row, idx) =>
    idx === index ? { ...row, amount: nextAmount } : { name: row.name, amount: row.amount },
  );
  const manualCents = next
    .slice(0, -1)
    .reduce((sum, row) => sum + eurosToCents(row.amount), 0);
  const lastCents = Math.max(0, totalCents - manualCents);
  const last = next[next.length - 1]!;
  next[next.length - 1] = { name: last.name, amount: centsToEuros(lastCents) };
  return next;
}
