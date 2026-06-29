import {
  formatRational,
  normalizeRational,
  parseQtyInput,
  rationalFromNumber,
  type Rational,
  rationalsEqual,
  sumRationals,
} from '@/lib/rational-qty';
import type { SplitPerson, SplitPersonItemShare } from '@/types';

export type ByItemSplitLine = {
  key: string;
  name: string;
  qty: number;
  unitPrice: number;
};

export type ByItemConsumerShare = {
  name: string;
  qty: Rational;
};

export type ByItemLineAllocation = Record<string, ByItemConsumerShare[]>;

export type ByItemSplitRow = {
  name: string;
  amount: number;
  items: Array<{ name: string; qty: number; price: number }>;
};

export type ByItemConsumerRow = {
  id: string;
  name: string;
  qtyInput: string;
};

function lineQtyRational(lineQty: number): Rational {
  return rationalFromNumber(lineQty);
}

export function parseConsumerRows(
  rows: ByItemConsumerRow[],
): Array<{ name: string; qty: Rational }> {
  const parsed: Array<{ name: string; qty: Rational }> = [];
  for (const row of rows) {
    const name = row.name.trim();
    const qty = parseQtyInput(row.qtyInput);
    if (!name || !qty || qty.num <= 0) continue;
    parsed.push({ name, qty });
  }
  return parsed;
}

export function lineAllocationComplete(
  lineQty: number,
  shares: Array<{ qty: Rational }>,
): boolean {
  if (shares.length === 0) return false;
  const sum = sumRationals(shares.map((share) => share.qty));
  return rationalsEqual(sum, lineQtyRational(lineQty));
}

export function byItemLinePriceShare(
  lineTotal: number,
  shares: ByItemConsumerShare[],
  personName: string,
): number {
  const totalCents = Math.round(lineTotal * 100);
  if (totalCents <= 0 || shares.length === 0) return 0;

  const lineQty = sumRationals(shares.map((share) => share.qty));
  const sorted = [...shares].sort((a, b) => a.name.localeCompare(b.name));
  const centsByName = new Map<string, number>();
  let assigned = 0;

  for (const share of sorted) {
    const cents = Math.floor(
      (totalCents * share.qty.num * lineQty.den) / (share.qty.den * lineQty.num),
    );
    centsByName.set(share.name, cents);
    assigned += cents;
  }

  let remainder = totalCents - assigned;
  for (const share of sorted) {
    if (remainder <= 0) break;
    centsByName.set(share.name, (centsByName.get(share.name) ?? 0) + 1);
    remainder -= 1;
  }

  return (centsByName.get(personName) ?? 0) / 100;
}

export function buildByItemAllocationsFromRows(
  lines: Array<{ key: string; rows: ByItemConsumerRow[] }>,
): ByItemLineAllocation {
  const allocations: ByItemLineAllocation = {};
  for (const line of lines) {
    const shares = parseConsumerRows(line.rows);
    if (shares.length > 0) {
      allocations[line.key] = shares;
    }
  }
  return allocations;
}

export function buildByItemAllocationsFromPersons(
  persons: SplitPerson[],
  lineQtyByKey: Record<string, number>,
): ByItemLineAllocation {
  const allocations: ByItemLineAllocation = {};

  for (const person of persons) {
    if (person.item_shares?.length) {
      for (const share of person.item_shares) {
        const rows = allocations[share.key] ?? [];
        rows.push({
          name: person.name,
          qty: normalizeRational({ num: share.qty_num, den: share.qty_den }),
        });
        allocations[share.key] = rows;
      }
      continue;
    }

    for (const key of person.items || []) {
      const rows = allocations[key] ?? [];
      rows.push({ name: person.name, qty: { num: 0, den: 1 } });
      allocations[key] = rows;
    }
  }

  for (const [key, shares] of Object.entries(allocations)) {
    if (!shares.every((share) => share.qty.num === 0)) continue;
    const lineQty = lineQtyByKey[key] ?? 1;
    const qty = lineQtyRational(lineQty);
    allocations[key] = shares.map((share) => ({
      name: share.name,
      qty: normalizeRational({ num: qty.num, den: qty.den * shares.length }),
    }));
  }

  return allocations;
}

export function calcByItemSplitResults(params: {
  lines: ByItemSplitLine[];
  allocations: ByItemLineAllocation;
}): ByItemSplitRow[] {
  const { lines, allocations } = params;
  const people = new Map<string, ByItemSplitRow>();

  for (const line of lines) {
    const shares = allocations[line.key] || [];
    if (!lineAllocationComplete(line.qty, shares)) continue;

    const lineTotal = line.unitPrice * line.qty;
    for (const share of shares) {
      const price = byItemLinePriceShare(lineTotal, shares, share.name);
      const existing = people.get(share.name) ?? {
        name: share.name,
        amount: 0,
        items: [],
      };
      existing.items.push({
        name: line.name.trim(),
        qty: share.qty.num / share.qty.den,
        price,
      });
      existing.amount = Math.round((existing.amount + price) * 100) / 100;
      people.set(share.name, existing);
    }
  }

  return Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSplitPersonsFromAllocations(
  allocations: ByItemLineAllocation,
): SplitPerson[] {
  const byName = new Map<string, SplitPersonItemShare[]>();

  for (const [key, shares] of Object.entries(allocations)) {
    for (const share of shares) {
      const normalized = normalizeRational(share.qty);
      const rows = byName.get(share.name) ?? [];
      rows.push({ key, qty_num: normalized.num, qty_den: normalized.den });
      byName.set(share.name, rows);
    }
  }

  return Array.from(byName.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, item_shares]) => ({ name, item_shares }));
}

export function consumersForLineFromPersons(
  persons: SplitPerson[],
  lineKey: string,
  lineQty: number,
): ByItemConsumerShare[] {
  const explicit: ByItemConsumerShare[] = [];
  const legacyNames: string[] = [];

  for (const person of persons) {
    const share = person.item_shares?.find((row) => row.key === lineKey);
    if (share) {
      explicit.push({
        name: person.name,
        qty: normalizeRational({ num: share.qty_num, den: share.qty_den }),
      });
      continue;
    }
    if ((person.items || []).includes(lineKey)) {
      legacyNames.push(person.name);
    }
  }

  if (explicit.length > 0) return explicit;
  if (legacyNames.length === 0) return [];

  const qty = lineQtyRational(lineQty);
  return legacyNames.map((name) => ({
    name,
    qty: normalizeRational({ num: qty.num, den: qty.den * legacyNames.length }),
  }));
}

export function shareQtyLabel(share: Rational): string {
  return formatRational(share);
}

export { parseQtyInput };

/** @deprecated Legacy equal-split label; kept for old persisted splits without item_shares. */
export function legacyEqualShareQtyLabel(lineQty: number, assigneeCount: number): string {
  const qty = rationalFromNumber(lineQty);
  const count = Math.max(1, assigneeCount);
  return formatRational(normalizeRational({ num: qty.num, den: qty.den * count }));
}

/** @deprecated Legacy cent-safe equal split among assignee ids. */
export function legacyEqualLineShare(
  lineTotal: number,
  assigneeIds: string[],
  personId: string,
): number {
  const n = assigneeIds.length;
  if (n === 0) return 0;
  const sorted = [...assigneeIds].sort();
  const sortedIdx = sorted.indexOf(personId);
  if (sortedIdx < 0) return 0;
  const totalCents = Math.round(lineTotal * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return (base + (sortedIdx < remainder ? 1 : 0)) / 100;
}

/** @deprecated Legacy helper for old persons[].items string[] format. */
export function legacyAssigneeIdsForKey(
  persons: Array<{ items?: string[] }>,
  lineKey: string,
): string[] {
  const assignees: string[] = [];
  persons.forEach((person, idx) => {
    if ((person.items || []).includes(lineKey)) {
      assignees.push(`p${idx + 1}`);
    }
  });
  return assignees;
}
