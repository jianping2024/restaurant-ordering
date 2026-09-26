/**
 * Sole helpers for staff checkout by-item workbench (Fatura-like pool + current person).
 * Guest dish-card UI stays in ByItemSplitSection; do not duplicate this layout there.
 */
import {
  allocateByItemShareAmounts,
  createByItemConsumerRow,
  isRowQtyOverAllocated,
  parseBuffetConsumerRows,
  parseBuffetHeadcountInput,
  parseConsumerRowQty,
  parseConsumerRows,
  rationalToRowQtyFields,
  resolveBuffetRowCounts,
  type ByItemConsumerRow,
  type ByItemConsumerShare,
} from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  addRationals,
  compareRationals,
  formatRational,
  normalizeRational,
  rationalFromInt,
  rationalFromNumber,
  sumRationals,
  type Rational,
} from '@/lib/rational-qty';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { splitPersonKey } from '@/lib/split-person-identity';
import type { UILanguage } from '@/lib/i18n';

function personMatches(rowName: string, personName: string): boolean {
  return splitPersonKey(rowName) === splitPersonKey(personName);
}

function qtyDiff(target: Rational, allocated: Rational): Rational {
  return normalizeRational({
    num: target.num * allocated.den - allocated.num * target.den,
    den: target.den * allocated.den,
  });
}

function minRational(a: Rational, b: Rational): Rational {
  return compareRationals(a, b) <= 0 ? normalizeRational(a) : normalizeRational(b);
}

/**
 * Qty already taken from the staff pool — sole source is {@link parseConsumerRows}
 * (named shares only). Anonymous seed qtyWhole=1 must not occupy the pool.
 */
function allocatedMenuQty(rows: ByItemConsumerRow[]): Rational {
  const shares = parseConsumerRows(rows);
  if (shares.length === 0) return rationalFromInt(0);
  return sumRationals(shares.map((share) => share.qty));
}

function formatEuroAmount(n: number): string {
  return `€${n.toFixed(2)}`;
}

/**
 * Sole share-row money meta for staff by-item「当前人份额」:
 * muted `qty × unit` + optional gold line total (`amount` already on the share).
 * Incomplete qty (`qtyLabel === '—'`) omits `= €0.00`. Pool rows do not use this.
 */
export type StaffByItemShareLineMetaParts = {
  factorText: string;
  amountText: string | null;
};

export function staffByItemShareLineMetaParts(share: {
  qtyLabel: string;
  unitPriceLabel: string;
  amount: number;
}): StaffByItemShareLineMetaParts {
  return {
    factorText: `${share.qtyLabel} × ${share.unitPriceLabel}`,
    amountText: share.qtyLabel === '—' ? null : formatEuroAmount(share.amount),
  };
}

function buffetUnitPriceLabel(spec: {
  adultUnitPrice: number;
  childUnitPrice: number;
  children: number;
}): string {
  const parts = [`${formatEuroAmount(spec.adultUnitPrice)}/A`];
  if (spec.children > 0) {
    parts.push(`${formatEuroAmount(spec.childUnitPrice)}/C`);
  }
  return parts.join(' · ');
}

export type StaffByItemPoolLine = {
  key: string;
  label: string;
  mode: 'menu' | 'buffet';
  remainingLabel: string;
  unitPriceLabel: string;
  remainingPositive: boolean;
  adultsRemaining: number;
  childrenRemaining: number;
  canAddWhole: boolean;
  canAddHalf: boolean;
  canAddAdult: boolean;
  canAddChild: boolean;
};

export type StaffByItemPersonShare = {
  lineKey: string;
  rowId: string;
  label: string;
  qtyLabel: string;
  unitPriceLabel: string;
  /** Share euro amount — estimate footer + sole share-row total via {@link staffByItemShareLineMetaParts}. */
  amount: number;
  mode: 'menu' | 'buffet';
  qtyWhole: string;
  qtyNum: string;
  qtyDen: string;
  adultQty: string;
  childQty: string;
};

/** Remaining pool = source line qty − sum of all named allocations (all people). */
export function staffByItemPoolLines(params: {
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  allocations: Record<string, ByItemConsumerRow[]>;
  lang: UILanguage;
  itemCodeByMenuId?: Record<string, string>;
}): StaffByItemPoolLine[] {
  const { lineSpecs, orderLines, allocations, lang, itemCodeByMenuId = {} } = params;
  const orderByKey = Object.fromEntries(orderLines.map((line) => [line.key, line]));
  const out: StaffByItemPoolLine[] = [];

  for (const spec of lineSpecs) {
    const item = orderByKey[spec.key];
    if (!item) continue;
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    const label = formatLocalizedMenuItemLabel(item, lang, itemCode);
    const rows = allocations[spec.key] ?? [];

    if (spec.mode === 'buffet') {
      const assigned = parseBuffetConsumerRows(rows);
      const adultsAssigned = assigned.reduce((sum, row) => sum + row.adults, 0);
      const childrenAssigned = assigned.reduce((sum, row) => sum + row.children, 0);
      const adultsRemaining = Math.max(0, spec.adults - adultsAssigned);
      const childrenRemaining = Math.max(0, spec.children - childrenAssigned);
      const remainingPositive = adultsRemaining > 0 || childrenRemaining > 0;
      const parts: string[] = [];
      if (adultsRemaining > 0) parts.push(`${adultsRemaining}A`);
      if (childrenRemaining > 0) parts.push(`${childrenRemaining}C`);
      out.push({
        key: spec.key,
        label,
        mode: 'buffet',
        remainingLabel: remainingPositive ? parts.join(' · ') : '0',
        unitPriceLabel: buffetUnitPriceLabel(spec),
        remainingPositive,
        adultsRemaining,
        childrenRemaining,
        canAddWhole: false,
        canAddHalf: false,
        canAddAdult: adultsRemaining > 0,
        canAddChild: childrenRemaining > 0,
      });
      continue;
    }

    const target = rationalFromNumber(spec.lineQty);
    const remaining = qtyDiff(target, allocatedMenuQty(rows));
    const remainingPositive = remaining.num > 0;
    const half = { num: 1, den: 2 };
    out.push({
      key: spec.key,
      label,
      mode: 'menu',
      remainingLabel: formatRational(remaining),
      unitPriceLabel: formatEuroAmount(spec.unitPrice),
      remainingPositive,
      adultsRemaining: 0,
      childrenRemaining: 0,
      canAddWhole: remainingPositive,
      canAddHalf: remainingPositive && compareRationals(remaining, half) >= 0,
      canAddAdult: false,
      canAddChild: false,
    });
  }

  return out;
}

/**
 * Money for each consumer row on a line — sole path {@link allocateByItemShareAmounts}
 * (same cents as {@link calcByItemSplitResults}). Incomplete qty → 0 for that row.
 */
function shareAmountsByRowId(
  spec: ByItemLineSpec,
  rows: ByItemConsumerRow[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (spec.mode === 'buffet') {
    const priced: { rowId: string; share: ByItemConsumerShare }[] = [];
    for (const row of rows) {
      if (!row.name.trim()) continue;
      const { adults, children } = resolveBuffetRowCounts(row);
      if (adults > 0) {
        priced.push({
          rowId: row.id,
          share: { name: row.name, qty: rationalFromInt(adults), guestType: 'adult' },
        });
      }
      if (children > 0) {
        priced.push({
          rowId: row.id,
          share: { name: row.name, qty: rationalFromInt(children), guestType: 'child' },
        });
      }
    }
    if (priced.length === 0) return out;
    const amounts = allocateByItemShareAmounts(
      {
        key: spec.key,
        name: '',
        mode: 'buffet',
        adults: spec.adults,
        children: spec.children,
        adultUnitPrice: spec.adultUnitPrice,
        childUnitPrice: spec.childUnitPrice,
      },
      priced.map((entry) => entry.share),
    );
    for (let i = 0; i < priced.length; i++) {
      const entry = priced[i]!;
      out.set(entry.rowId, Math.round(((out.get(entry.rowId) ?? 0) + (amounts[i] ?? 0)) * 100) / 100);
    }
    return out;
  }

  const priced: { rowId: string; share: ByItemConsumerShare }[] = [];
  for (const row of rows) {
    if (!row.name.trim()) continue;
    const qty = parseConsumerRowQty(row);
    if (!qty) continue;
    priced.push({ rowId: row.id, share: { name: row.name, qty } });
  }
  if (priced.length === 0) return out;
  const amounts = allocateByItemShareAmounts(
    {
      key: spec.key,
      name: '',
      mode: 'menu',
      qty: spec.lineQty,
      unitPrice: spec.unitPrice,
    },
    priced.map((entry) => entry.share),
  );
  for (let i = 0; i < priced.length; i++) {
    out.set(priced[i]!.rowId, amounts[i] ?? 0);
  }
  return out;
}

/** Shares belonging to one marker name across all lines. */
export function staffByItemPersonShares(params: {
  personName: string;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  allocations: Record<string, ByItemConsumerRow[]>;
  lang: UILanguage;
  itemCodeByMenuId?: Record<string, string>;
}): StaffByItemPersonShare[] {
  const {
    personName,
    lineSpecs,
    orderLines,
    allocations,
    lang,
    itemCodeByMenuId = {},
  } = params;
  if (!personName.trim()) return [];

  const orderByKey = Object.fromEntries(orderLines.map((line) => [line.key, line]));
  const out: StaffByItemPersonShare[] = [];

  for (const spec of lineSpecs) {
    const item = orderByKey[spec.key];
    if (!item) continue;
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    const label = formatLocalizedMenuItemLabel(item, lang, itemCode);
    const rows = allocations[spec.key] ?? [];
    const amountsByRowId = shareAmountsByRowId(spec, rows);

    for (const row of rows) {
      if (!personMatches(row.name, personName)) continue;

      if (spec.mode === 'buffet') {
        const { adults, children } = resolveBuffetRowCounts(row);
        if (adults <= 0 && children <= 0) continue;
        const qtyParts: string[] = [];
        if (adults > 0) qtyParts.push(`${adults}A`);
        if (children > 0) qtyParts.push(`${children}C`);
        out.push({
          lineKey: spec.key,
          rowId: row.id,
          label,
          qtyLabel: qtyParts.join(' · '),
          unitPriceLabel: buffetUnitPriceLabel(spec),
          amount: amountsByRowId.get(row.id) ?? 0,
          mode: 'buffet',
          qtyWhole: '',
          qtyNum: '',
          qtyDen: '',
          adultQty: row.adultQty ?? '',
          childQty: row.childQty ?? '',
        });
        continue;
      }

      // Keep named rows while qty is incomplete/invalid so ByItemQtyInput stays mounted
      // (parseConsumerRowQty is for amount only — never a visibility gate).
      const qty = parseConsumerRowQty(row);
      out.push({
        lineKey: spec.key,
        rowId: row.id,
        label,
        qtyLabel: qty ? formatRational(qty) : '—',
        unitPriceLabel: formatEuroAmount(spec.unitPrice),
        amount: amountsByRowId.get(row.id) ?? 0,
        mode: 'menu',
        qtyWhole: row.qtyWhole,
        qtyNum: row.qtyNum,
        qtyDen: row.qtyDen,
        adultQty: '',
        childQty: '',
      });
    }
  }

  return out;
}

function upsertEditableNamedRow(
  rows: ByItemConsumerRow[],
  personName: string,
  buffet: boolean,
): { rows: ByItemConsumerRow[]; row: ByItemConsumerRow } {
  // Never merge into a paid-frozen row — new same dish gets a new editable row.
  const existing = rows.find(
    (row) => personMatches(row.name, personName) && !row.paidLocked,
  );
  if (existing) return { rows, row: existing };

  const empty = rows.find((row) => !row.name.trim() && !row.paidLocked);
  if (empty) {
    const named = {
      ...empty,
      name: personName,
      qtyWhole: '',
      qtyNum: '',
      qtyDen: '',
      ...(buffet ? { adultQty: '', childQty: '' } : {}),
    };
    return {
      rows: rows.map((row) => (row.id === empty.id ? named : row)),
      row: named,
    };
  }

  const created = {
    ...createByItemConsumerRow({ buffet }),
    name: personName,
    qtyWhole: '',
    adultQty: buffet ? '' : undefined,
    childQty: buffet ? '' : undefined,
  };
  return { rows: [...rows, created], row: created };
}

/** Add whole unit (or remaining if &lt; 1) from pool to person — fatura pool "+" semantics. */
export function addWholeShareToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName } = params;
  const name = personName.trim();
  if (!name) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
  if (remaining.num <= 0) return null;

  const take = minRational(remaining, rationalFromInt(1));
  const { rows: nextRows, row } = upsertEditableNamedRow(rows, name, false);
  const current = parseConsumerRowQty(row) ?? rationalFromInt(0);
  const nextQty = addRationals(current, take);
  const patched = nextRows.map((candidate) =>
    candidate.id === row.id
      ? { ...candidate, name, ...rationalToRowQtyFields(nextQty), paidLocked: undefined }
      : candidate,
  );
  return { ...allocations, [lineKey]: patched };
}

/** Denominator for the pool fraction button. Empty, below 2, or 0 stays 1/2. */
export function menuFractionDenominatorForPerson(
  rows: ByItemConsumerRow[],
  personName: string,
): number {
  const row = rows.find((candidate) => personMatches(candidate.name, personName) && candidate.name.trim());
  const den = Number(row?.qtyDen);
  if (!Number.isInteger(den) || den < 2) return 2;
  return den;
}

function menuFractionTake(denominator: number): Rational {
  const den = Number.isInteger(denominator) && denominator >= 2 ? denominator : 2;
  return { num: 1, den };
}

/** True when the pool still has at least 1/denominator of this menu line. */
export function canAddMenuFractionShare(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  denominator: number;
}): boolean {
  const { allocations, lineSpecs, lineKey, denominator } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return false;
  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
  return compareRationals(remaining, menuFractionTake(denominator)) >= 0;
}

/** Add 1/denominator (default 1/2) when the pool can cover it. */
export function addMenuFractionShareToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  denominator?: number;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, denominator = 2 } = params;
  const name = personName.trim();
  if (!name) return null;
  if (!canAddMenuFractionShare({ allocations, lineSpecs, lineKey, denominator })) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const take = menuFractionTake(denominator);
  const { rows: nextRows, row } = upsertEditableNamedRow(rows, name, false);
  const current = parseConsumerRowQty(row) ?? rationalFromInt(0);
  const nextQty = addRationals(current, take);
  const patched = nextRows.map((candidate) =>
    candidate.id === row.id
      ? { ...candidate, name, ...rationalToRowQtyFields(nextQty), paidLocked: undefined }
      : candidate,
  );
  return { ...allocations, [lineKey]: patched };
}

export function addBuffetSeatToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  guestType: 'adult' | 'child';
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, guestType } = params;
  const name = personName.trim();
  if (!name) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'buffet') return null;

  const rows = allocations[lineKey] ?? [];
  const assigned = parseBuffetConsumerRows(rows);
  const adultsAssigned = assigned.reduce((sum, row) => sum + row.adults, 0);
  const childrenAssigned = assigned.reduce((sum, row) => sum + row.children, 0);
  if (guestType === 'adult' && adultsAssigned >= spec.adults) return null;
  if (guestType === 'child' && childrenAssigned >= spec.children) return null;

  const { rows: nextRows, row } = upsertEditableNamedRow(rows, name, true);
  // Do not use resolveBuffetRowCounts here — empty named rows default to 1 adult,
  // which would double-count when we then +1 for this pool action.
  const adults = parseBuffetHeadcountInput(row.adultQty);
  const children = parseBuffetHeadcountInput(row.childQty);
  const nextAdults = guestType === 'adult' ? adults + 1 : adults;
  const nextChildren = guestType === 'child' ? children + 1 : children;
  const patched = nextRows.map((candidate) =>
    candidate.id === row.id
      ? {
          ...candidate,
          name,
          adultQty: nextAdults > 0 ? String(nextAdults) : '',
          childQty: nextChildren > 0 ? String(nextChildren) : '',
          qtyWhole: '',
          qtyNum: '',
          qtyDen: '',
          paidLocked: undefined,
        }
      : candidate,
  );
  return { ...allocations, [lineKey]: patched };
}

/**
 * Patch menu qty fields on one named share row (whole + num/den).
 * Same remaining truth as the pool: {@link parseConsumerRows} / {@link allocatedMenuQty}.
 */
export function setPersonMenuShareQtyFields(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
  patch: Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, rowId, patch } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;
  const rows = allocations[lineKey] ?? [];
  const target = rows.find((row) => row.id === rowId);
  if (!target || !target.name.trim()) return null;

  const nextRow = { ...target, ...patch };
  const patched = rows.map((row) => (row.id === rowId ? nextRow : row));
  return { ...allocations, [lineKey]: patched };
}

export function isStaffMenuShareOverAllocated(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
}): boolean {
  const { allocations, lineSpecs, lineKey, rowId } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return false;
  const rows = allocations[lineKey] ?? [];
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) return false;
  return isRowQtyOverAllocated(row, rows, spec.lineQty);
}

/** Patch buffet adult/child headcounts on one named share row. */
export function setPersonBuffetShareCounts(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
  adultQty: string;
  childQty: string;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, rowId, adultQty, childQty } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'buffet') return null;
  const rows = allocations[lineKey] ?? [];
  const target = rows.find((row) => row.id === rowId);
  if (!target || !target.name.trim()) return null;

  const patched = rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          adultQty,
          childQty,
          qtyWhole: '',
          qtyNum: '',
          qtyDen: '',
        }
      : row,
  );
  return { ...allocations, [lineKey]: patched };
}

/** Remove one person's share row on a line (keeps at least one empty seed row). */
export function removePersonShareOnLine(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineKey: string;
  rowId: string;
  buffet: boolean;
}): Record<string, ByItemConsumerRow[]> {
  const { allocations, lineKey, rowId, buffet } = params;
  const rows = allocations[lineKey] ?? [];
  const next = rows.filter((row) => row.id !== rowId);
  return {
    ...allocations,
    [lineKey]:
      next.length > 0
        ? next
        : [createByItemConsumerRow({ buffet, seed: true })],
  };
}

/** Ordered unique marker names currently present in allocations (non-empty). */
export function staffByItemPeopleFromAllocations(
  allocations: Record<string, ByItemConsumerRow[]>,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const rows of Object.values(allocations)) {
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) continue;
      const key = splitPersonKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}
