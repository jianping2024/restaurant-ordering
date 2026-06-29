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

export function createByItemConsumerRow(): ByItemConsumerRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    qtyInput: '',
  };
}

/** Ensures every visible line has a stable persisted row before the user can type. */
export function withDefaultByItemLineRows(
  allocations: Record<string, ByItemConsumerRow[]>,
  lineKeys: string[],
): Record<string, ByItemConsumerRow[]> {
  const missing = lineKeys.filter((key) => !allocations[key]?.length);
  if (missing.length === 0) return allocations;
  const next = { ...allocations };
  for (const key of missing) {
    next[key] = [createByItemConsumerRow()];
  }
  return next;
}

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

export type ByItemLineStatus =
  | { kind: 'empty'; target: Rational }
  | { kind: 'missing_names'; allocated: Rational }
  | { kind: 'duplicate_names'; allocated: Rational }
  | { kind: 'short'; remaining: Rational; allocated: Rational }
  | { kind: 'over'; excess: Rational; allocated: Rational }
  | { kind: 'complete'; allocated: Rational };

function allocatedSum(shares: Array<{ qty: Rational }>): Rational {
  if (shares.length === 0) return { num: 0, den: 1 };
  return sumRationals(shares.map((share) => share.qty));
}

function qtyDiff(target: Rational, allocated: Rational): Rational {
  return normalizeRational({
    num: target.num * allocated.den - allocated.num * target.den,
    den: target.den * allocated.den,
  });
}

function evaluateByItemLineShares(
  lineQty: number,
  shares: Array<{ name: string; qty: Rational }>,
): ByItemLineStatus {
  const target = lineQtyRational(lineQty);
  if (shares.length === 0) {
    return { kind: 'empty', target };
  }

  const names = shares.map((share) => share.name.trim().toLowerCase());
  const allocated = allocatedSum(shares);
  if (names.some((name) => !name)) {
    return { kind: 'missing_names', allocated };
  }
  if (new Set(names).size !== names.length) {
    return { kind: 'duplicate_names', allocated };
  }

  const diff = qtyDiff(target, allocated);
  if (diff.num === 0) return { kind: 'complete', allocated };
  if (diff.num > 0) return { kind: 'short', remaining: diff, allocated };
  return {
    kind: 'over',
    excess: normalizeRational({ num: -diff.num, den: diff.den }),
    allocated,
  };
}

export function getByItemLineStatusFromRows(
  rows: ByItemConsumerRow[],
  lineQty: number,
): ByItemLineStatus {
  for (const row of rows) {
    const qty = parseQtyInput(row.qtyInput);
    if (qty && qty.num > 0 && !row.name.trim()) {
      const partial = parseConsumerRows(rows);
      return { kind: 'missing_names', allocated: allocatedSum(partial) };
    }
  }

  const names = rows.map((row) => row.name.trim()).filter(Boolean);
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length > 0 && new Set(lower).size !== lower.length) {
    const partial = parseConsumerRows(rows);
    return { kind: 'duplicate_names', allocated: allocatedSum(partial) };
  }

  return evaluateByItemLineShares(lineQty, parseConsumerRows(rows));
}

export function getByItemLineStatusFromShares(
  lineQty: number,
  shares: ByItemConsumerShare[],
): ByItemLineStatus {
  return evaluateByItemLineShares(
    lineQty,
    shares.map((share) => ({ name: share.name, qty: share.qty })),
  );
}

export type ByItemLineStatusLabels = {
  complete: string;
  remaining: string;
  over: string;
  missingNames: string;
  duplicateNames: string;
  unassigned: string;
};

export type ByItemLineStatusTone = 'success' | 'muted' | 'error';

export function byItemLineStatusSummary(
  status: ByItemLineStatus,
  labels: ByItemLineStatusLabels,
): { text: string; tone: ByItemLineStatusTone } {
  const allocatedLabel = formatRational(
    status.kind === 'empty' ? { num: 0, den: 1 } : status.allocated,
  );

  switch (status.kind) {
    case 'complete':
      return {
        text: labels.complete.replace('{qty}', formatRational(status.allocated)),
        tone: 'success',
      };
    case 'short':
      return {
        text: labels.remaining
          .replace('{qty}', formatRational(status.remaining))
          .replace('{allocated}', allocatedLabel),
        tone: 'muted',
      };
    case 'over':
      return {
        text: labels.over
          .replace('{qty}', formatRational(status.excess))
          .replace('{allocated}', allocatedLabel),
        tone: 'error',
      };
    case 'missing_names':
      return { text: labels.missingNames, tone: 'error' };
    case 'duplicate_names':
      return { text: labels.duplicateNames, tone: 'error' };
    case 'empty':
      return {
        text: labels.unassigned.replace('{qty}', formatRational(status.target)),
        tone: 'muted',
      };
  }
}

export function isByItemLineComplete(status: ByItemLineStatus): boolean {
  return status.kind === 'complete';
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
