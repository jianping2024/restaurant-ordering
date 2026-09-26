import {
  allocateProportionalCents,
  centsToEuros,
  eurosToCents,
} from '@/lib/money-allocation';
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
import {
  displaySplitPersonName,
  splitPersonKey,
} from '@/lib/split-person-identity';
import { splitPartyKey, mintSplitPartyId, parseOptionalPartyId } from '@/lib/split-party-id';
import type { OrderItem, SplitPerson, SplitPersonItemShare } from '@/types';

export type { ByItemLineSpec, ByItemSplitLine } from '@/lib/bill-split-by-item-lines';

export type BuffetGuestType = 'adult' | 'child';

export type ByItemConsumerShare = {
  name: string;
  qty: Rational;
  guestType?: BuffetGuestType;
  /** Atomic ticket id when present. */
  partyId?: string;
  /**
   * When set, this share keeps this euro amount; open shares split the remainder
   * of the line's allocated total (paid-ticket amount freeze).
   */
  frozenAmount?: number;
};

export type ByItemLineAllocation = Record<string, ByItemConsumerShare[]>;

export type ByItemSplitRow = {
  name: string;
  amount: number;
  items: Array<{ name: string; qty: number; price: number }>;
  partyId?: string;
};

export type ByItemConsumerRow = {
  id: string;
  name: string;
  qtyWhole: string;
  qtyNum: string;
  qtyDen: string;
  /** Buffet lines: integer headcounts per payer; menu lines ignore these. */
  adultQty?: string;
  childQty?: string;
  /**
   * Share frozen by prior collection — read-only; new same dish uses another row
   * (never merge into this one).
   */
  paidLocked?: boolean;
  /** Atomic ticket id when present (optional for legacy rows). */
  partyId?: string;
  /** Stamped euro amount when paidLocked — sole per-share freeze. */
  lockedAmount?: number;
};

export type QtyPartsIssue = 'missing_den' | 'zero_den' | 'improper_fraction';

export type QtyPartsLabels = {
  /** Visible field role (column header + aria-label); not an in-input placeholder. */
  wholeLabel: string;
  numLabel: string;
  denLabel: string;
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

export function createByItemConsumerRow(opts?: { buffet?: boolean; seed?: boolean }): ByItemConsumerRow {
  const buffet = opts?.buffet ?? false;
  const seed = opts?.seed ?? false;
  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    partyId: mintSplitPartyId(),
    qtyWhole: !buffet && seed ? '1' : '',
    qtyNum: '',
    qtyDen: '',
    ...(buffet ? { adultQty: seed ? '1' : '', childQty: '' } : {}),
  };
}

/** Map a rational share to the qty input fields used by ByItemConsumerRow. */
export function rationalToRowQtyFields(
  qty: Rational,
): Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'> {
  const { num, den } = normalizeRational(qty);
  if (den === 1) {
    return { qtyWhole: String(num), qtyNum: '', qtyDen: '' };
  }
  const sign = num < 0 ? -1 : 1;
  const absNum = Math.abs(num);
  const whole = Math.floor(absNum / den);
  const rem = absNum % den;
  const signPrefix = sign < 0 ? '-' : '';
  if (whole > 0 && rem > 0) {
    return {
      qtyWhole: `${signPrefix}${whole}`,
      qtyNum: String(rem),
      qtyDen: String(den),
    };
  }
  return { qtyWhole: '', qtyNum: `${signPrefix}${absNum}`, qtyDen: String(den) };
}

/**
 * Append a payer row, prefilling the line remainder after named prior allocations.
 * Used when the guest finishes one payer and adds the next consumer on the same dish.
 */
export function appendByItemConsumerRow(
  rows: ByItemConsumerRow[],
  spec: ByItemLineSpec,
): ByItemConsumerRow[] {
  const base = {
    ...createByItemConsumerRow({ buffet: spec.mode === 'buffet' }),
  };

  if (spec.mode === 'buffet') {
    const assigned = parseBuffetConsumerRows(rows);
    const adultsAssigned = assigned.reduce((sum, row) => sum + row.adults, 0);
    const childrenAssigned = assigned.reduce((sum, row) => sum + row.children, 0);
    const adultsRemaining = spec.adults - adultsAssigned;
    const childrenRemaining = spec.children - childrenAssigned;
    if (adultsRemaining <= 0 && childrenRemaining <= 0) {
      return [...rows, base];
    }
    return [...rows, {
      ...base,
      adultQty: adultsRemaining > 0 ? String(adultsRemaining) : '',
      childQty: childrenRemaining > 0 ? String(childrenRemaining) : '',
    }];
  }

  const allocated = allocatedSum(parseConsumerRows(rows));
  const remainder = qtyDiff(lineQtyRational(spec.lineQty), allocated);
  if (remainder.num <= 0) {
    return [...rows, base];
  }
  return [...rows, {
    ...base,
    ...rationalToRowQtyFields(remainder),
  }];
}

/** Drop one payer row; always keep at least one empty row for the dish line. */
export function removeByItemConsumerRow(
  rows: ByItemConsumerRow[],
  rowId: string,
  opts?: { buffet?: boolean },
): ByItemConsumerRow[] {
  const next = rows.filter((row) => row.id !== rowId);
  return next.length > 0 ? next : [createByItemConsumerRow({ buffet: opts?.buffet, seed: true })];
}

export type BuffetConsumerAllocation = {
  name: string;
  adults: number;
  children: number;
  partyId?: string;
};

export function parseBuffetHeadcountInput(raw: string | undefined): number {
  const digits = sanitizeQtyDigits(raw ?? '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/** Name + empty counts → 1 adult; explicit zeros are respected when child count is set. */
export function resolveBuffetRowCounts(row: ByItemConsumerRow): { adults: number; children: number } {
  const adultRaw = (row.adultQty ?? '').trim();
  const childRaw = (row.childQty ?? '').trim();
  let adults = parseBuffetHeadcountInput(adultRaw);
  const children = parseBuffetHeadcountInput(childRaw);
  if (row.name.trim() && !adultRaw && !childRaw) {
    adults = 1;
  }
  return { adults, children };
}

export function parseBuffetConsumerRows(rows: ByItemConsumerRow[]): BuffetConsumerAllocation[] {
  const parsed: BuffetConsumerAllocation[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const { adults, children } = resolveBuffetRowCounts(row);
    if (adults <= 0 && children <= 0) continue;
    parsed.push({
      name,
      adults,
      children,
      ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
    });
  }
  return parsed;
}

function buffetSharesFromAllocations(
  allocations: BuffetConsumerAllocation[],
): ByItemConsumerShare[] {
  const shares: ByItemConsumerShare[] = [];
  for (const row of allocations) {
    if (row.adults > 0) {
      shares.push({
        name: row.name,
        qty: rationalFromInt(row.adults),
        guestType: 'adult',
        ...(row.partyId ? { partyId: row.partyId } : {}),
      });
    }
    if (row.children > 0) {
      shares.push({
        name: row.name,
        qty: rationalFromInt(row.children),
        guestType: 'child',
        ...(row.partyId ? { partyId: row.partyId } : {}),
      });
    }
  }
  return shares;
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
    next[spec.key] = [createByItemConsumerRow({
      buffet: spec.mode === 'buffet',
      seed: true,
    })];
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
    parsed.push({
      name,
      qty,
      ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
      ...(row.paidLocked && row.lockedAmount != null && Number.isFinite(row.lockedAmount)
        ? { frozenAmount: row.lockedAmount }
        : {}),
    });
  }
  return parsed;
}

export type BuffetCountFields = {
  adultsNeeded: number;
  childrenNeeded: number;
  adultsAssigned: number;
  childrenAssigned: number;
};

function buffetCountSummary(labels: ByItemLineStatusLabels, counts: BuffetCountFields): string {
  const parts: string[] = [];
  if (counts.adultsNeeded > 0) {
    parts.push(
      labels.buffetAdultProgress
        .replace('{allocated}', String(counts.adultsAssigned))
        .replace('{total}', String(counts.adultsNeeded)),
    );
  }
  if (counts.childrenNeeded > 0) {
    parts.push(
      labels.buffetChildProgress
        .replace('{allocated}', String(counts.childrenAssigned))
        .replace('{total}', String(counts.childrenNeeded)),
    );
  }
  return parts.join(' · ');
}

function evaluateBuffetLineShares(
  adultsNeeded: number,
  childrenNeeded: number,
  allocations: BuffetConsumerAllocation[],
): ByItemLineStatus {
  if (allocations.length === 0) {
    if (adultsNeeded === 0 && childrenNeeded === 0) {
      return { kind: 'complete', allocated: rationalFromInt(0) };
    }
    return {
      kind: 'buffet_empty',
      adultsNeeded,
      childrenNeeded,
      adultsAssigned: 0,
      childrenAssigned: 0,
    };
  }

  const names = allocations.map((row) => row.name.trim().toLowerCase());
  if (names.some((name) => !name)) {
    return { kind: 'missing_names', allocated: rationalFromInt(allocations.length) };
  }
  const partyKeys = allocations.map((row) => splitPartyKey(row.partyId, row.name));
  if (new Set(partyKeys).size !== partyKeys.length) {
    return { kind: 'duplicate_names', allocated: rationalFromInt(allocations.length) };
  }

  const adultsAssigned = allocations.reduce((sum, row) => sum + row.adults, 0);
  const childrenAssigned = allocations.reduce((sum, row) => sum + row.children, 0);
  const adultDiff = adultsNeeded - adultsAssigned;
  const childDiff = childrenNeeded - childrenAssigned;
  const allocated = rationalFromInt(adultsAssigned + childrenAssigned);

  if (adultDiff === 0 && childDiff === 0) {
    return {
      kind: 'complete',
      allocated,
      buffetCounts: {
        adultsNeeded,
        childrenNeeded,
        adultsAssigned,
        childrenAssigned,
      },
    };
  }
  if (adultDiff > 0 || childDiff > 0) {
    return {
      kind: 'buffet_short',
      adultsRemaining: Math.max(0, adultDiff),
      childrenRemaining: Math.max(0, childDiff),
      adultsNeeded,
      childrenNeeded,
      adultsAssigned,
      childrenAssigned,
      allocated,
    };
  }
  return {
    kind: 'buffet_over',
    adultsExcess: Math.max(0, -adultDiff),
    childrenExcess: Math.max(0, -childDiff),
    adultsNeeded,
    childrenNeeded,
    adultsAssigned,
    childrenAssigned,
    allocated,
  };
}

export function getBuffetLineStatusFromRows(
  rows: ByItemConsumerRow[],
  spec: { adults: number; children: number },
): ByItemLineStatus {
  for (const row of rows) {
    const { adults, children } = resolveBuffetRowCounts(row);
    if ((adults > 0 || children > 0) && !row.name.trim()) {
      return { kind: 'missing_names', allocated: rationalFromInt(adults + children) };
    }
  }

  const namedRows = rows.filter((row) => row.name.trim());
  const partyKeys = namedRows.map((row) => splitPartyKey(row.partyId, row.name));
  if (partyKeys.length > 0 && new Set(partyKeys).size !== partyKeys.length) {
    const partial = parseBuffetConsumerRows(rows);
    const heads = partial.reduce((sum, row) => sum + row.adults + row.children, 0);
    return { kind: 'duplicate_names', allocated: rationalFromInt(heads) };
  }

  return evaluateBuffetLineShares(spec.adults, spec.children, parseBuffetConsumerRows(rows));
}

export function getBuffetLineStatusFromShares(
  spec: { adults: number; children: number },
  shares: ByItemConsumerShare[],
): ByItemLineStatus {
  const byName = new Map<string, BuffetConsumerAllocation>();
  for (const share of shares) {
    if (share.guestType !== 'adult' && share.guestType !== 'child') continue;
    const qty = share.qty.num / share.qty.den;
    if (qty <= 0) continue;
    const existing = byName.get(share.name) ?? { name: share.name, adults: 0, children: 0 };
    if (share.guestType === 'child') existing.children += qty;
    else existing.adults += qty;
    byName.set(share.name, existing);
  }
  return evaluateBuffetLineShares(spec.adults, spec.children, Array.from(byName.values()));
}

export type ByItemLineStatus =
  | { kind: 'empty'; target: Rational }
  | { kind: 'buffet_empty' } & BuffetCountFields
  | { kind: 'missing_names'; allocated: Rational }
  | { kind: 'duplicate_names'; allocated: Rational }
  | { kind: 'invalid_qty'; issue: QtyPartsIssue; allocated: Rational }
  | { kind: 'short'; remaining: Rational; allocated: Rational }
  | { kind: 'over'; excess: Rational; allocated: Rational }
  | { kind: 'buffet_short'; adultsRemaining: number; childrenRemaining: number; allocated: Rational } & BuffetCountFields
  | { kind: 'buffet_over'; adultsExcess: number; childrenExcess: number; allocated: Rational } & BuffetCountFields
  | { kind: 'complete'; allocated: Rational; buffetCounts?: BuffetCountFields };

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
  shares: Array<{ name: string; qty: Rational; partyId?: string }>,
): ByItemLineStatus {
  const target = lineQtyRational(lineQty);
  if (shares.length === 0) {
    return { kind: 'empty', target };
  }

  const partyKeys = shares.map((share) => splitPartyKey(share.partyId, share.name));
  const allocated = allocatedSum(shares);
  if (partyKeys.some((key) => !key)) {
    return { kind: 'missing_names', allocated };
  }
  if (new Set(partyKeys).size !== partyKeys.length) {
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

  const namedRows = rows.filter((row) => row.name.trim());
  const partyKeys = namedRows.map((row) => splitPartyKey(row.partyId, row.name));
  if (partyKeys.length > 0 && new Set(partyKeys).size !== partyKeys.length) {
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
  buffetAdultProgress: string;
  buffetChildProgress: string;
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
        text: opts?.buffet && status.buffetCounts
          ? `${labels.buffetComplete} · ${buffetCountSummary(labels, status.buffetCounts)}`
          : opts?.buffet
            ? labels.buffetComplete
            : labels.complete.replace('{qty}', formatRational(status.allocated)),
        tone: 'success',
      };
    case 'buffet_empty': {
      const remain = buffetStatusParts(labels, 'short', status.adultsNeeded, status.childrenNeeded).join(' · ');
      const counts = buffetCountSummary(labels, status);
      return {
        text: [remain, counts].filter(Boolean).join(' · '),
        tone: 'alert',
      };
    }
    case 'buffet_short': {
      const remain = buffetStatusParts(
        labels,
        'short',
        status.adultsRemaining,
        status.childrenRemaining,
      ).join(' · ');
      const counts = buffetCountSummary(labels, status);
      return {
        text: [remain, counts].filter(Boolean).join(' · '),
        tone: 'alert',
      };
    }
    case 'buffet_over': {
      const over = buffetStatusParts(
        labels,
        'over',
        status.adultsExcess,
        status.childrenExcess,
      ).join(' · ');
      const counts = buffetCountSummary(labels, status);
      return {
        text: [over, counts].filter(Boolean).join(' · '),
        tone: 'alert',
      };
    }
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
  const allocated = allocateLineTotalByShares(lineTotal, shares);
  const personKey = splitPersonKey(personName);
  const index = shares.findIndex((share) => splitPersonKey(share.name) === personKey);
  if (index < 0) return 0;
  return allocated[index] ?? 0;
}

/**
 * Integer qty weights for menu cent allocation.
 * LCM of denominators — never drop den (1 vs 1/2), never float 1.5 weights.
 */
function menuShareQtyWeightInts(shares: readonly ByItemConsumerShare[]): number[] {
  let lcmDen = 1;
  for (const share of shares) {
    const den = share.qty.den > 0 ? Math.trunc(share.qty.den) : 1;
    const g = (() => {
      let x = Math.abs(lcmDen);
      let y = Math.abs(den);
      while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x || 1;
    })();
    lcmDen = (lcmDen / g) * den;
  }
  return shares.map((share) => {
    if (share.qty.den <= 0 || share.qty.num <= 0) return 0;
    return share.qty.num * (lcmDen / share.qty.den);
  });
}

/**
 * Menu line from a known euro total: qty weights (num/den kept), remainder by name.
 * Prefer {@link allocateByItemShareAmounts} when the line + shares are available.
 */
export function allocateLineTotalByShares(
  lineTotal: number,
  shares: ByItemConsumerShare[],
): number[] {
  const totalCents = eurosToCents(lineTotal);
  if (totalCents <= 0 || shares.length === 0) return shares.map(() => 0);

  const weightInts = menuShareQtyWeightInts(shares);
  const cents = allocateProportionalCents(totalCents, weightInts, (i) => shares[i]?.name ?? '');
  return cents.map(centsToEuros);
}

/**
 * Sole by-item share money for a split line.
 * Basis = qty × unit; money = integer-cent largest-remainder so Σ(shares) equals the
 * allocated total (never per-share `round(unit×qty)` — that can overshoot the line by 1¢).
 * Incomplete lines use only allocated qty/heads (not the full catalog line).
 * Paid shares with `frozenAmount` keep that stamp; open shares split the remainder.
 */
export function allocateByItemShareAmounts(
  line: ByItemSplitLine,
  shares: readonly ByItemConsumerShare[],
): number[] {
  if (shares.length === 0) return [];

  const frozenFlags = shares.map(
    (share) =>
      share.frozenAmount != null &&
      Number.isFinite(share.frozenAmount) &&
      share.frozenAmount >= 0,
  );
  const anyFrozen = frozenFlags.some(Boolean);

  if (line.mode === 'buffet') {
    let adultHeads = 0;
    let childHeads = 0;
    const weightInts = shares.map((share, index) => {
      if (frozenFlags[index]) return 0;
      const qty = share.qty.den > 0 ? share.qty.num / share.qty.den : 0;
      if (qty <= 0) return 0;
      if (share.guestType === 'child') {
        childHeads += qty;
        return eurosToCents(line.childUnitPrice * qty);
      }
      adultHeads += qty;
      return eurosToCents(line.adultUnitPrice * qty);
    });
    // Heads on frozen shares still count toward line total basis.
    for (let i = 0; i < shares.length; i++) {
      if (!frozenFlags[i]) continue;
      const share = shares[i]!;
      const qty = share.qty.den > 0 ? share.qty.num / share.qty.den : 0;
      if (qty <= 0) continue;
      if (share.guestType === 'child') childHeads += qty;
      else adultHeads += qty;
    }
    const totalCents = eurosToCents(
      adultHeads * line.adultUnitPrice + childHeads * line.childUnitPrice,
    );
    if (totalCents <= 0) return shares.map(() => 0);
    return allocateLineCentsWithFrozen(totalCents, shares, frozenFlags, weightInts);
  }

  const allocatedQty = sumRationals(shares.map((share) => share.qty));
  if (allocatedQty.num <= 0) return shares.map(() => 0);
  const totalCents = eurosToCents(line.unitPrice * (allocatedQty.num / allocatedQty.den));
  if (totalCents <= 0) return shares.map(() => 0);
  const weightInts = anyFrozen
    ? shares.map((share, index) =>
        frozenFlags[index] ? 0 : menuShareQtyWeightInts([share])[0] ?? 0,
      )
    : menuShareQtyWeightInts(shares);
  return allocateLineCentsWithFrozen(totalCents, shares, frozenFlags, weightInts);
}

function allocateLineCentsWithFrozen(
  totalCents: number,
  shares: readonly ByItemConsumerShare[],
  frozenFlags: readonly boolean[],
  openWeightInts: readonly number[],
): number[] {
  const out = new Array<number>(shares.length).fill(0);
  let frozenCents = 0;
  for (let i = 0; i < shares.length; i++) {
    if (!frozenFlags[i]) continue;
    const cents = eurosToCents(shares[i]!.frozenAmount ?? 0);
    out[i] = cents;
    frozenCents += cents;
  }
  const openCents = Math.max(0, totalCents - frozenCents);
  const openIndexes: number[] = [];
  const openWeights: number[] = [];
  for (let i = 0; i < shares.length; i++) {
    if (frozenFlags[i]) continue;
    openIndexes.push(i);
    openWeights.push(openWeightInts[i] ?? 0);
  }
  if (openIndexes.length === 0) {
    // All frozen — keep stamps even if they disagree with totalCents.
    return out.map(centsToEuros);
  }
  const allocated = allocateProportionalCents(
    openCents,
    openWeights,
    (j) => shares[openIndexes[j]!]?.name ?? '',
  );
  for (let j = 0; j < openIndexes.length; j++) {
    out[openIndexes[j]!] = allocated[j] ?? 0;
  }
  return out.map(centsToEuros);
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
      const shares = buffetSharesFromAllocations(parseBuffetConsumerRows(rowsByKey[spec.key] ?? []));
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
          qty: normalizeRational({ num: share.qty_num, den: share.qty_den }),
          ...(guestType ? { guestType } : {}),
          ...(person.party_id?.trim()
            ? { partyId: person.party_id.trim() }
            : share.party_id?.trim()
              ? { partyId: share.party_id.trim() }
              : {}),
          ...(share.locked_amount != null && Number.isFinite(share.locked_amount)
            ? { frozenAmount: share.locked_amount }
            : {}),
        });
        allocations[share.key] = rows;
      }
      continue;
    }

    for (const key of person.items || []) {
      const rows = allocations[key] ?? [];
      rows.push({
        name: person.name,
        qty: { num: 0, den: 1 },
        ...(person.party_id?.trim() ? { partyId: person.party_id.trim() } : {}),
      });
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

/**
 * Sole by-item person obligation from allocations.
 * Share money sole path: {@link allocateByItemShareAmounts} (qty×unit weights + cent remainder).
 * Output order: `personOrder` when provided (ledger roster); else first-seen
 * allocation order — never localeCompare-sort (that breaks person_index).
 * Identity: {@link splitPartyKey} (party_id when present, else name).
 */
export function calcByItemSplitResults(params: {
  lines: ByItemSplitLine[];
  allocations: ByItemLineAllocation;
  /** Stable roster names (`bill_splits.result` order). */
  personOrder?: readonly string[];
  /** Optional parallel party ids aligned with personOrder (same length). */
  personPartyIds?: readonly (string | undefined)[];
}): ByItemSplitRow[] {
  const { lines, allocations, personOrder, personPartyIds } = params;
  const people = new Map<string, ByItemSplitRow>();
  const seenOrder: string[] = [];

  const addShare = (
    shareName: string,
    partyId: string | undefined,
    item: ByItemSplitRow['items'][number],
    price: number,
  ) => {
    const key = splitPartyKey(partyId, shareName);
    if (!key) return;
    const existing = people.get(key) ?? {
      name: displaySplitPersonName(shareName),
      amount: 0,
      items: [],
      ...(partyId?.trim() ? { partyId: partyId.trim() } : {}),
    };
    if (!people.has(key)) seenOrder.push(key);
    existing.items.push(item);
    existing.amount = Math.round((existing.amount + price) * 100) / 100;
    people.set(key, existing);
  };

  for (const line of lines) {
    const shares = (allocations[line.key] || []).filter((share) => share.qty.num > 0);
    if (shares.length === 0) continue;
    const amounts = allocateByItemShareAmounts(line, shares);

    if (line.mode === 'buffet') {
      for (let i = 0; i < shares.length; i++) {
        const share = shares[i]!;
        const qty = share.qty.num / share.qty.den;
        const unitPrice =
          share.guestType === 'child' ? line.childUnitPrice : line.adultUnitPrice;
        addShare(
          share.name,
          share.partyId,
          { name: line.name.trim(), qty, price: unitPrice },
          amounts[i] ?? 0,
        );
      }
      continue;
    }

    for (let i = 0; i < shares.length; i++) {
      const share = shares[i]!;
      const qty = share.qty.num / share.qty.den;
      addShare(
        share.name,
        share.partyId,
        { name: line.name.trim(), qty, price: line.unitPrice },
        amounts[i] ?? 0,
      );
    }
  }

  if (personOrder && personOrder.length > 0) {
    const used = new Set<string>();
    const ordered: ByItemSplitRow[] = [];
    for (let i = 0; i < personOrder.length; i++) {
      const name = personOrder[i]!;
      const partyId = personPartyIds?.[i];
      const key = splitPartyKey(partyId, name);
      if (!key || used.has(key)) continue;
      const row = people.get(key);
      if (!row) continue;
      used.add(key);
      ordered.push(row);
    }
    for (const key of seenOrder) {
      if (used.has(key)) continue;
      const row = people.get(key);
      if (!row) continue;
      used.add(key);
      ordered.push(row);
    }
    return ordered;
  }

  return seenOrder.map((key) => people.get(key)!).filter(Boolean);
}

/** Locate person row in {@link calcByItemSplitResults} output (sole collect index/amount source). */
export function locateByItemSplitResult(
  results: ReadonlyArray<{ name: string; amount: number; partyId?: string }>,
  personName: string,
  partyId?: string,
): { index: number; row: { name: string; amount: number; partyId?: string } } | null {
  const key = splitPartyKey(partyId, personName);
  if (!key) return null;
  let index = results.findIndex((row) => splitPartyKey(row.partyId, row.name) === key);
  if (index < 0 && !partyId?.trim()) {
    // Compat: name-only lookup when caller omits party_id.
    const nameKey = splitPartyKey(undefined, personName);
    index = results.findIndex(
      (row) => splitPartyKey(undefined, row.name) === nameKey,
    );
  }
  if (index < 0) return null;
  return { index, row: results[index]! };
}

export function buildSplitPersonsFromAllocations(
  allocations: ByItemLineAllocation,
): SplitPerson[] {
  const byKey = new Map<
    string,
    { name: string; partyId?: string; item_shares: SplitPersonItemShare[] }
  >();

  for (const [key, shares] of Object.entries(allocations)) {
    for (const share of shares) {
      const partyKey = splitPartyKey(share.partyId, share.name);
      if (!partyKey) continue;
      const normalized = normalizeRational(share.qty);
      const party_id = parseOptionalPartyId(share.partyId);
      const entry = byKey.get(partyKey) ?? {
        name: displaySplitPersonName(share.name),
        ...(party_id ? { partyId: party_id } : {}),
        item_shares: [],
      };
      entry.item_shares.push({
        key,
        qty_num: normalized.num,
        qty_den: normalized.den,
        ...(share.guestType ? { guest_type: share.guestType } : {}),
        ...(party_id ? { party_id } : {}),
        ...(share.frozenAmount != null && Number.isFinite(share.frozenAmount)
          ? { locked_amount: share.frozenAmount }
          : {}),
      });
      byKey.set(partyKey, entry);
    }
  }

  return Array.from(byKey.values()).map(({ name, partyId, item_shares }) => {
    const party_id = parseOptionalPartyId(partyId);
    return {
      name,
      item_shares,
      ...(party_id ? { party_id } : {}),
    };
  });
}

export function consumersForLineFromPersons(
  persons: SplitPerson[],
  lineKey: string,
  spec: ByItemLineSpec,
): ByItemConsumerShare[] {
  const explicit: ByItemConsumerShare[] = [];
  const legacyNames: string[] = [];

  for (const person of persons) {
    const shares = person.item_shares?.filter((row) => row.key === lineKey) ?? [];
    if (shares.length > 0) {
      for (const share of shares) {
        const guestType =
          share.guest_type === 'adult' || share.guest_type === 'child'
            ? share.guest_type
            : undefined;
        explicit.push({
          name: person.name,
          qty: normalizeRational({ num: share.qty_num, den: share.qty_den }),
          ...(guestType ? { guestType } : {}),
        });
      }
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
