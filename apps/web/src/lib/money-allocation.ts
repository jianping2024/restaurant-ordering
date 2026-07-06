/** Integer cents ↔ euro helpers (checkout money must stay on cent boundaries). */
export function eurosToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

/**
 * Split totalCents across slots by weight; remainder cents go to slots with lowest sort keys first.
 * Returns one cent amount per slot (same order as weights).
 */
export function allocateProportionalCents(
  totalCents: number,
  weights: readonly number[],
  sortKeyForIndex: (index: number) => string = () => '',
): number[] {
  if (weights.length === 0) return [];
  if (totalCents <= 0) return weights.map(() => 0);

  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const cents = weights.map((w) => Math.floor((totalCents * Math.max(0, w)) / weightSum));
  let remainder = totalCents - cents.reduce((sum, c) => sum + c, 0);

  const order = weights
    .map((_, index) => ({ index, key: sortKeyForIndex(index) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const { index } of order) {
    if (remainder <= 0) break;
    cents[index] += 1;
    remainder -= 1;
  }

  return cents;
}

/**
 * Even split of totalCents across ordered names; remainder cents by name sort order.
 */
export function allocateEvenAmounts(totalEuros: number, names: readonly string[]): number[] {
  const n = names.length;
  if (n === 0) return [];

  const totalCents = eurosToCents(totalEuros);
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;

  const cents = Array.from({ length: n }, () => base);
  const order = names
    .map((name, index) => ({ index, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const { index } of order) {
    if (remainder <= 0) break;
    cents[index] += 1;
    remainder -= 1;
  }

  return cents.map(centsToEuros);
}
