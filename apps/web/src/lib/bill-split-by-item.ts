import {
  formatRational,
  normalizeRational,
  parseQtyInput,
  rationalFromInt,
  rationalFromNumber,
  type Rational,
  rationalsEqual,
  sumRationals,
} from '@/lib/rational-qty';
import type { ByItemLineSpec, ByItemSplitLine } from '@/lib/bill-split-by-item-lines';
import type { OrderItem, SplitPerson, SplitPersonItemShare } from '@/types';

export type { ByItemLineSpec, ByItemSplitLine } from '@/lib/bill-split-by-item-lines';

export type BuffetGuestType = 'adult' | 'child';

export type ByItemConsumerShare = {
  name: string;
  qty: Rational;
  guestType?: BuffetGuestType;
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
  qtyWhole: string;
  qtyNum: string;
  qtyDen: string;
  /** Buffet lines: one head per row; menu lines ignore this. */
  guestType?: BuffetGuestType | '';
};

export type QtyPartsIssue = 'missing_den' | 'zero_den' | 'improper_fraction';

export type QtyPartsLabels = {
  wholePlaceholder: string;
  numPlaceholder: string;
  denPlaceholder: string;
  missingDen: string;
  zeroDen: string;
  improperFraction: string;
};

export function sanitizeQtyDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

export function validateQtyParts(parts: {
  whole: string;
  num: string;
  den: string;
}):
  | { ok: true; qty: Rational }
  | { ok: false; issue: QtyPartsIssue }
  | { ok: false; issue: 'empty' } {
  const whole = parts.whole.trim();
  const num = parts.num.trim();
  const den = parts.den.trim();
  const hasWhole = whole.length > 0;
  const hasNum = num.length > 0;
  const hasDen = den.length > 0;

  if (!hasWhole && !hasNum && !hasDen) {
    return { ok: false, issue: 'empty' };
  }

  if (hasNum !== hasDen) {
    return { ok: false, issue: 'missing_den' };
  }

  if (hasDen) {
    const d = Number(den);
    const n = Number(num);
    if (!Number.isFinite(d) || d === 0) return { ok: false, issue: 'zero_den' };
    if (!Number.isFinite(n) || n >= d) return { ok: false, issue: 'improper_fraction' };
    const wholeN = hasWhole ? Number(whole) : 0;
    if (!Number.isFinite(wholeN) || wholeN < 0) return { ok: false, issue: 'empty' };
    return { ok: true, qty: normalizeRational({ num: wholeN * d + n, den: d }) };
  }

  const wholeN = Number(whole);
  if (!Number.isFinite(wholeN) || wholeN <= 0) return { ok: false, issue: 'empty' };
  return { ok: true, qty: rationalFromInt(wholeN) };
}

export function parseConsumerRowQty(row: ByItemConsumerRow): Rational | null {
  const result = validateQtyParts({
    whole: row.qtyWhole,
    num: row.qtyNum,
    den: row.qtyDen,
  });
  if (!result.ok) return null;
  if (result.qty.num <= 0) return null;
  return result.qty;
}

export function qtyPartsIssueLabel(issue: QtyPartsIssue, labels: QtyPartsLabels): string {
  switch (issue) {
    case 'missing_den':
      return labels.missingDen;
    case 'zero_den':
      return labels.zeroDen;
    case 'improper_fraction':
      return labels.improperFraction;
  }
}

export function getQtyPartsRowHint(row: ByItemConsumerRow, labels: QtyPartsLabels): string | null {
  const result = validateQtyParts({
    whole: row.qtyWhole,
    num: row.qtyNum,
    den: row.qtyDen,
  });
  if (result.ok || result.issue === 'empty') return null;
  return qtyPartsIssueLabel(result.issue, labels);
}

export function createByItemConsumerRow(opts?: { buffet?: boolean }): ByItemConsumerRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    qtyWhole: '',
    qtyNum: '',
    qtyDen: '',
    ...(opts?.buffet ? { guestType: '' as const } : {}),
  };
}

/** Ensures every visible line has a stable persisted row before the user can type. */
export function withDefaultByItemLineRows(
  allocations: Record<string, ByItemConsumerRow[]>,
  lineSpecs: ByItemLineSpec[],
): Record<string, ByItemConsumerRow[]> {
  const missing = lineSpecs.filter((spec) => !allocations[spec.key]?.length);
  if (missing.length === 0) return allocations;
  const next = { ...allocations };
  for (const spec of missing) {
    next[spec.key] = [createByItemConsumerRow({ buffet: spec.mode === 'buffet' })];
  }
  return next;
}

function lineQtyRational(lineQty: number): Rational {
  return rationalFromNumber(lineQty);
}

export function parseConsumerRows(
  rows: ByItemConsumerRow[],
): ByItemConsumerShare[] {
  const parsed: ByItemConsumerShare[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    const qty = parseConsumerRowQty(row);
    if (!name || !qty) continue;
    parsed.push({ name, qty });
  }
  return parsed;
}

export function parseBuffetConsumerRows(
  rows: ByItemConsumerRow[],
): Array<{ name: string; guestType: BuffetGuestType }> {
  const parsed: Array<{ name: string; guestType: BuffetGuestType }> = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || (row.guestType !== 'adult' && row.guestType !== 'child')) continue;
    parsed.push({ name, guestType: row.guestType });
  }
  return parsed;
}

function evaluateBuffetLineShares(
  adultsNeeded: number,
  childrenNeeded: number,
  shares: Array<{ name: string; guestType: BuffetGuestType }>,
): ByItemLineStatus {
  if (shares.length === 0) {
    if (adultsNeeded === 0 && childrenNeeded === 0) {
      return { kind: 'complete', allocated: rationalFromInt(0) };
    }
    return { kind: 'buffet_empty', adultsNeeded, childrenNeeded };
  }

  const names = shares.map((share) => share.name.trim().toLowerCase());
  if (names.some((name) => !name)) {
    return { kind: 'missing_names', allocated: rationalFromInt(shares.length) };
  }
  if (new Set(names).size !== names.length) {
    return { kind: 'duplicate_names', allocated: rationalFromInt(shares.length) };
  }

  const adultsAssigned = shares.filter((share) => share.guestType === 'adult').length;
  const childrenAssigned = shares.filter((share) => share.guestType === 'child').length;
  const adultDiff = adultsNeeded - adultsAssigned;
  const childDiff = childrenNeeded - childrenAssigned;
  const allocated = rationalFromInt(adultsAssigned + childrenAssigned);

  if (adultDiff === 0 && childDiff === 0) {
    return { kind: 'complete', allocated };
  }
  if (adultDiff > 0 || childDiff > 0) {
    return {
      kind: 'buffet_short',
      adultsRemaining: Math.max(0, adultDiff),
      childrenRemaining: Math.max(0, childDiff),
      allocated,
    };
  }
  return {
    kind: 'buffet_over',
    adultsExcess: Math.max(0, -adultDiff),
    childrenExcess: Math.max(0, -childDiff),
    allocated,
  };
}

export function getBuffetLineStatusFromRows(
  rows: ByItemConsumerRow[],
  spec: { adults: number; children: number },
): ByItemLineStatus {
  for (const row of rows) {
    if (row.name.trim() && row.guestType !== 'adult' && row.guestType !== 'child') {
      const partial = parseBuffetConsumerRows(rows);
      return { kind: 'missing_guest_type', allocated: rationalFromInt(partial.length) };
    }
  }

  const namedRows = rows.filter((row) => row.name.trim());
  const lower = namedRows.map((row) => row.name.trim().toLowerCase());
  if (lower.length > 0 && new Set(lower).size !== lower.length) {
    const partial = parseBuffetConsumerRows(rows);
    return { kind: 'duplicate_names', allocated: rationalFromInt(partial.length) };
  }

  for (const row of rows) {
    if (!row.name.trim() && (row.guestType === 'adult' || row.guestType === 'child')) {
      const partial = parseBuffetConsumerRows(rows);
      return { kind: 'missing_names', allocated: rationalFromInt(partial.length) };
    }
  }

  return evaluateBuffetLineShares(spec.adults, spec.children, parseBuffetConsumerRows(rows));
}

export function getBuffetLineStatusFromShares(
  spec: { adults: number; children: number },
  shares: ByItemConsumerShare[],
): ByItemLineStatus {
  return evaluateBuffetLineShares(
    spec.adults,
    spec.children,
    shares
      .filter((share): share is ByItemConsumerShare & { guestType: BuffetGuestType } =>
        share.guestType === 'adult' || share.guestType === 'child',
      )
      .map((share) => ({ name: share.name, guestType: share.guestType })),
  );
}

export type ByItemLineStatus =
  | { kind: 'empty'; target: Rational }
  | { kind: 'buffet_empty'; adultsNeeded: number; childrenNeeded: number }
  | { kind: 'missing_names'; allocated: Rational }
  | { kind: 'missing_guest_type'; allocated: Rational }
  | { kind: 'duplicate_names'; allocated: Rational }
  | { kind: 'invalid_qty'; issue: QtyPartsIssue; allocated: Rational }
  | { kind: 'short'; remaining: Rational; allocated: Rational }
  | { kind: 'over'; excess: Rational; allocated: Rational }
  | { kind: 'buffet_short'; adultsRemaining: number; childrenRemaining: number; allocated: Rational }
  | { kind: 'buffet_over'; adultsExcess: number; childrenExcess: number; allocated: Rational }
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
  spec: ByItemLineSpec,
): ByItemLineStatus {
  if (spec.mode === 'buffet') {
    return getBuffetLineStatusFromRows(rows, spec);
  }

  for (const row of rows) {
    const parts = validateQtyParts({
      whole: row.qtyWhole,
      num: row.qtyNum,
      den: row.qtyDen,
    });
    if (!parts.ok && parts.issue !== 'empty') {
      const partial = parseConsumerRows(rows);
      return { kind: 'invalid_qty', issue: parts.issue, allocated: allocatedSum(partial) };
    }
  }

  for (const row of rows) {
    const qty = parseConsumerRowQty(row);
    if (qty && !row.name.trim()) {
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

  return evaluateByItemLineShares(spec.lineQty, parseConsumerRows(rows));
}

export function getByItemLineStatusFromShares(
  spec: ByItemLineSpec,
  shares: ByItemConsumerShare[],
): ByItemLineStatus {
  if (spec.mode === 'buffet') {
    return getBuffetLineStatusFromShares(spec, shares);
  }
  return evaluateByItemLineShares(
    spec.lineQty,
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
  invalidQty: string;
  buffetComplete: string;
  buffetShortAdult: string;
  buffetShortChild: string;
  buffetOverAdult: string;
  buffetOverChild: string;
  buffetMissingGuestType: string;
};

function buffetStatusParts(
  labels: ByItemLineStatusLabels,
  kind: 'short' | 'over',
  adults: number,
  children: number,
): string[] {
  const parts: string[] = [];
  if (adults > 0) {
    parts.push(
      (kind === 'short' ? labels.buffetShortAdult : labels.buffetOverAdult).replace('{n}', String(adults)),
    );
  }
  if (children > 0) {
    parts.push(
      (kind === 'short' ? labels.buffetShortChild : labels.buffetOverChild).replace('{n}', String(children)),
    );
  }
  return parts;
}

/** Non-complete dish states share one alert style in the UI. */
export type ByItemLineStatusTone = 'success' | 'alert';

export function byItemLineStatusSummary(
  status: ByItemLineStatus,
  labels: ByItemLineStatusLabels,
  qtyLabels?: QtyPartsLabels,
  opts?: { buffet?: boolean },
): { text: string; tone: ByItemLineStatusTone } {
  const allocatedLabel = formatRational(
    status.kind === 'empty'
      ? { num: 0, den: 1 }
      : status.kind === 'buffet_empty'
        ? { num: 0, den: 1 }
        : status.allocated,
  );

  switch (status.kind) {
    case 'complete':
      return {
        text: opts?.buffet
          ? labels.buffetComplete
          : labels.complete.replace('{qty}', formatRational(status.allocated)),
        tone: 'success',
      };
    case 'buffet_empty':
      return {
        text: buffetStatusParts(labels, 'short', status.adultsNeeded, status.childrenNeeded).join(' · '),
        tone: 'alert',
      };
    case 'buffet_short':
      return {
        text: buffetStatusParts(labels, 'short', status.adultsRemaining, status.childrenRemaining).join(' · '),
        tone: 'alert',
      };
    case 'buffet_over':
      return {
        text: buffetStatusParts(labels, 'over', status.adultsExcess, status.childrenExcess).join(' · '),
        tone: 'alert',
      };
    case 'missing_guest_type':
      return { text: labels.buffetMissingGuestType, tone: 'alert' };
    case 'short':
      return {
        text: labels.remaining
          .replace('{qty}', formatRational(status.remaining))
          .replace('{allocated}', allocatedLabel),
        tone: 'alert',
      };
    case 'over':
      return {
        text: labels.over
          .replace('{qty}', formatRational(status.excess))
          .replace('{allocated}', allocatedLabel),
        tone: 'alert',
      };
    case 'missing_names':
      return { text: labels.missingNames, tone: 'alert' };
    case 'duplicate_names':
      return { text: labels.duplicateNames, tone: 'alert' };
    case 'invalid_qty':
      return {
        text: qtyLabels
          ? qtyPartsIssueLabel(status.issue, qtyLabels)
          : labels.invalidQty,
        tone: 'alert',
      };
    case 'empty':
      return {
        text: labels.unassigned.replace('{qty}', formatRational(status.target)),
        tone: 'alert',
      };
  }
}

export function isByItemLineComplete(status: ByItemLineStatus): boolean {
  return status.kind === 'complete';
}

export function countByItemAllocationProgress(
  lineSpecs: ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): { complete: number; total: number } {
  let complete = 0;
  for (const spec of lineSpecs) {
    const status = getByItemLineStatusFromRows(allocations[spec.key] ?? [], spec);
    if (isByItemLineComplete(status)) complete += 1;
  }
  return { complete, total: lineSpecs.length };
}

export function isRowQtyOverAllocated(
  row: ByItemConsumerRow,
  rows: ByItemConsumerRow[],
  lineQty: number,
): boolean {
  const rowQty = parseConsumerRowQty(row);
  if (!rowQty) return false;
  const others = rows
    .filter((candidate) => candidate.id !== row.id)
    .map((candidate) => parseConsumerRowQty(candidate))
    .filter((qty): qty is Rational => !!qty);
  const diff = qtyDiff(lineQtyRational(lineQty), sumRationals([...others, rowQty]));
  return diff.num < 0;
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

export function buffetLineAllocationComplete(
  line: Extract<ByItemSplitLine, { mode: 'buffet' }>,
  shares: ByItemConsumerShare[],
): boolean {
  const status = getBuffetLineStatusFromShares(
    { adults: line.adults, children: line.children },
    shares,
  );
  return status.kind === 'complete';
}

export function buildByItemAllocationsFromRows(
  lineSpecs: ByItemLineSpec[],
  rowsByKey: Record<string, ByItemConsumerRow[]>,
): ByItemLineAllocation {
  const allocations: ByItemLineAllocation = {};
  for (const spec of lineSpecs) {
    if (spec.mode === 'buffet') {
      const shares = parseBuffetConsumerRows(rowsByKey[spec.key] ?? []).map((row) => ({
        name: row.name,
        qty: rationalFromInt(1),
        guestType: row.guestType,
      }));
      if (shares.length > 0) allocations[spec.key] = shares;
      continue;
    }
    const shares = parseConsumerRows(rowsByKey[spec.key] ?? []);
    if (shares.length > 0) allocations[spec.key] = shares;
  }
  return allocations;
}

export function buildByItemAllocationsFromPersons(
  persons: SplitPerson[],
  lineSpecs: ByItemLineSpec[],
): ByItemLineAllocation {
  const allocations: ByItemLineAllocation = {};
  const lineQtyByKey = Object.fromEntries(
    lineSpecs.map((spec) => [spec.key, spec.mode === 'menu' ? spec.lineQty : 1]),
  );

  for (const person of persons) {
    if (person.item_shares?.length) {
      for (const share of person.item_shares) {
        const rows = allocations[share.key] ?? [];
        const guestType =
          share.guest_type === 'adult' || share.guest_type === 'child'
            ? share.guest_type
            : undefined;
        rows.push({
          name: person.name,
          qty: guestType
            ? rationalFromInt(1)
            : normalizeRational({ num: share.qty_num, den: share.qty_den }),
          ...(guestType ? { guestType } : {}),
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
    if (line.mode === 'buffet') {
      if (!buffetLineAllocationComplete(line, shares)) continue;
      for (const share of shares) {
        const price =
          share.guestType === 'child' ? line.childUnitPrice : line.adultUnitPrice;
        const existing = people.get(share.name) ?? {
          name: share.name,
          amount: 0,
          items: [],
        };
        existing.items.push({
          name: line.name.trim(),
          qty: 1,
          price,
        });
        existing.amount = Math.round((existing.amount + price) * 100) / 100;
        people.set(share.name, existing);
      }
      continue;
    }

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
      rows.push({
        key,
        qty_num: normalized.num,
        qty_den: normalized.den,
        ...(share.guestType ? { guest_type: share.guestType } : {}),
      });
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
  spec: ByItemLineSpec,
): ByItemConsumerShare[] {
  const explicit: ByItemConsumerShare[] = [];
  const legacyNames: string[] = [];

  for (const person of persons) {
    const share = person.item_shares?.find((row) => row.key === lineKey);
    if (share) {
      const guestType =
        share.guest_type === 'adult' || share.guest_type === 'child'
          ? share.guest_type
          : undefined;
      explicit.push({
        name: person.name,
        qty: guestType
          ? rationalFromInt(1)
          : normalizeRational({ num: share.qty_num, den: share.qty_den }),
        ...(guestType ? { guestType } : {}),
      });
      continue;
    }
    if ((person.items || []).includes(lineKey)) {
      legacyNames.push(person.name);
    }
  }

  if (explicit.length > 0) return explicit;
  if (legacyNames.length === 0) return [];

  const lineQty = spec.mode === 'menu' ? spec.lineQty : 1;
  const qty = lineQtyRational(lineQty);
  return legacyNames.map((name) => ({
    name,
    qty: normalizeRational({ num: qty.num, den: qty.den * legacyNames.length }),
  }));
}

export function buffetShareUnitPrice(
  item: Pick<OrderItem, 'adult_unit_price' | 'child_unit_price'>,
  guestType: BuffetGuestType,
): number {
  return guestType === 'child'
    ? (item.child_unit_price ?? 0)
    : (item.adult_unit_price ?? 0);
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
