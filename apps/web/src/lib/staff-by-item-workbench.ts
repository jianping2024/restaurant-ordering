/**
 * Sole helpers for staff checkout by-item workbench (Fatura-like pool + current person).
 * Guest dish-card UI is GuestClaimDishCard (one ticket per phone); do not duplicate this layout there.
 */
import {
  allocateByItemShareAmounts,
  byItemConsumerRowTicketLocked,
  createByItemConsumerRow,
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
import {
  FRACTION_UNIT_DENS,
  fractionUnitOfLine,
  fractionUnitQty,
  unitDenForQty,
} from '@/lib/by-item-fraction-unit';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { mintSplitPartyId, splitPartyKey } from '@/lib/split-party-id';
import type { StaffByItemRailPerson } from '@/lib/staff-by-item-people';
import type { UILanguage } from '@/lib/i18n';

function ticketMatches(
  row: Pick<ByItemConsumerRow, 'name' | 'partyId'>,
  personName: string,
  partyId?: string,
): boolean {
  if (partyId?.trim()) {
    return splitPartyKey(row.partyId, row.name) === splitPartyKey(partyId, personName);
  }
  // Lookup without party_id: match display name (compat / tests).
  return splitPartyKey(undefined, row.name) === splitPartyKey(undefined, personName);
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
 * Qty already taken from the staff pool — named shares only.
 * Anonymous seed qtyWhole=1 must not occupy the pool (same as parseConsumerRows).
 */
function allocatedMenuQty(rows: ByItemConsumerRow[]): Rational {
  const shares = parseConsumerRows(rows);
  if (shares.length === 0) return rationalFromInt(0);
  return sumRationals(shares.map((share) => share.qty));
}

/** Sole staff cut of one menu line: explicit unit first, else the one its shares imply. */
function menuLineFractionUnit(rows: ByItemConsumerRow[]): number | null {
  return fractionUnitOfLine(parseConsumerRows(rows));
}

function formatEuroAmount(n: number): string {
  return `€${n.toFixed(2)}`;
}

/**
 * Sole share-row money meta for staff by-item「当前人份额」:
 * always three slots `qty × unit` + `=` + amount; incomplete qty uses muted `—`
 * (never fake `€0.00`); ready qty uses gold euro from share.amount.
 * Pool rows do not use this.
 */
export type StaffByItemShareLineMetaParts = {
  factorText: string;
  /** Always present — euro when ready, `—` placeholder when qty incomplete. */
  amountText: string;
  amountReady: boolean;
};

/** Menu share rows only — never buffet (buffet uses {@link staffByItemBuffetShareLineMetaParts}). */
export function staffByItemShareLineMetaParts(share: {
  qtyLabel: string;
  unitPriceLabel: string;
  amount: number;
}): StaffByItemShareLineMetaParts {
  const amountReady = share.qtyLabel !== '—';
  return {
    factorText: `${share.qtyLabel} × ${share.unitPriceLabel}`,
    amountText: amountReady ? formatEuroAmount(share.amount) : '—',
    amountReady,
  };
}

export type StaffByItemBuffetShareLineMetaParts = {
  amountText: string;
  amountReady: boolean;
};

/**
 * Sole buffet share amount slot. Unit text is the same {@link buffetUnitPriceLabel} as the
 * pool, painted adjacent to the dish name — never a second rate string, never `qty × unit`.
 */
export function staffByItemBuffetShareLineMetaParts(share: {
  amount: number;
  amountReady: boolean;
}): StaffByItemBuffetShareLineMetaParts {
  return {
    amountText: share.amountReady ? formatEuroAmount(share.amount) : '—',
    amountReady: share.amountReady,
  };
}

/** Sole buffet unit string for pool + share name row (`€x/A · €y/C`). */
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
  /**
   * Menu line cut already fixed by its shares (paid or not), else null while the line is free.
   * Sole source of the pool `1/N` button label and of the picker being skipped.
   */
  fractionUnit: number | null;
  /**
   * Units the pool can still take one of: the fixed unit, or every unit that fits while free.
   * Empty ⇒ the `1/N` button is disabled.
   */
  fractionUnitChoices: number[];
  canAddAdult: boolean;
  canAddChild: boolean;
};

export type StaffByItemPersonShare = {
  lineKey: string;
  rowId: string;
  label: string;
  /**
   * Menu: qty factor for {@link staffByItemShareLineMetaParts}.
   * Buffet: unused (`''`) — headcount is {@link headcountLabel}.
   */
  qtyLabel: string;
  /**
   * Menu: unit euro for `qty × unit`.
   * Buffet: same {@link buffetUnitPriceLabel} as the pool — sole unit string, name-adjacent in UI.
   */
  unitPriceLabel: string;
  /**
   * Share euro — menu via {@link staffByItemShareLineMetaParts};
   * buffet amount-only via {@link staffByItemBuffetShareLineMetaParts}.
   */
  amount: number;
  mode: 'menu' | 'buffet';
  /** Buffet: `1A · 1C` (assigned heads); menu: `''`. */
  headcountLabel: string;
  /** Menu line cut (see {@link StaffByItemPoolLine.fractionUnit}); drives the `‹ 1/N` button. */
  fractionUnit: number | null;
  /** Right-panel mirror of the pool buttons: this share still holds at least one such unit. */
  canReturnWhole: boolean;
  canReturnFraction: boolean;
  canReturnAdult: boolean;
  canReturnChild: boolean;
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
        fractionUnit: null,
        fractionUnitChoices: [],
        canAddAdult: adultsRemaining > 0,
        canAddChild: childrenRemaining > 0,
      });
      continue;
    }

    const target = rationalFromNumber(spec.lineQty);
    const remaining = qtyDiff(target, allocatedMenuQty(rows));
    const remainingPositive = remaining.num > 0;
    const fractionUnit = menuLineFractionUnit(rows);
    const fractionUnitChoices = menuFractionUnitChoices(remaining, fractionUnit);
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
      fractionUnit,
      fractionUnitChoices,
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
    priced.push({
      rowId: row.id,
      share: {
        name: row.name,
        qty,
        ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
        ...(row.paidLocked && row.lockedAmount != null && Number.isFinite(row.lockedAmount)
          ? { frozenAmount: row.lockedAmount }
          : {}),
      },
    });
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

/** Shares belonging to one ticket across all lines. */
export function staffByItemPersonShares(params: {
  personName: string;
  partyId?: string;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  allocations: Record<string, ByItemConsumerRow[]>;
  lang: UILanguage;
  itemCodeByMenuId?: Record<string, string>;
}): StaffByItemPersonShare[] {
  const { personName, partyId, lineSpecs, orderLines, allocations, lang, itemCodeByMenuId = {} } =
    params;
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
    const fractionUnit = spec.mode === 'menu' ? menuLineFractionUnit(rows) : null;

    for (const row of rows) {
      if (!ticketMatches(row, personName, partyId)) continue;

      if (spec.mode === 'buffet') {
        const { adults, children } = resolveBuffetRowCounts(row);
        if (adults <= 0 && children <= 0) continue;
        out.push({
          lineKey: spec.key,
          rowId: row.id,
          label,
          qtyLabel: '',
          unitPriceLabel: buffetUnitPriceLabel(spec),
          amount: amountsByRowId.get(row.id) ?? 0,
          mode: 'buffet',
          headcountLabel: [
            adults > 0 ? `${adults}A` : '',
            children > 0 ? `${children}C` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          fractionUnit: null,
          canReturnWhole: false,
          canReturnFraction: false,
          canReturnAdult: adults > 0,
          canReturnChild: children > 0,
        });
        continue;
      }

      const qty = parseConsumerRowQty(row);
      if (!qty) continue;
      out.push({
        lineKey: spec.key,
        rowId: row.id,
        label,
        qtyLabel: formatRational(qty),
        unitPriceLabel: formatEuroAmount(spec.unitPrice),
        amount: amountsByRowId.get(row.id) ?? 0,
        mode: 'menu',
        headcountLabel: '',
        fractionUnit,
        canReturnWhole: !row.paidLocked && compareRationals(qty, rationalFromInt(1)) >= 0,
        canReturnFraction:
          !row.paidLocked &&
          fractionUnit != null &&
          compareRationals(qty, fractionUnitQty(fractionUnit)) >= 0,
        canReturnAdult: false,
        canReturnChild: false,
      });
    }
  }

  return out;
}

function upsertEditableTicketRow(
  rows: ByItemConsumerRow[],
  personName: string,
  buffet: boolean,
  partyId?: string,
): { rows: ByItemConsumerRow[]; row: ByItemConsumerRow } {
  const wantedParty = partyId?.trim() || undefined;
  // Never merge into a paid-frozen row — new same dish gets a new editable row.
  const existing = rows.find((row) => {
    if (byItemConsumerRowTicketLocked(row)) return false;
    if (wantedParty) return ticketMatches(row, personName, wantedParty);
    // Compat: no party on the add → merge unpaid same display name.
    return splitPartyKey(undefined, row.name) === splitPartyKey(undefined, personName);
  });
  if (existing) return { rows, row: existing };

  const ticketId = wantedParty || mintSplitPartyId();
  const empty = rows.find((row) => !row.name.trim() && !byItemConsumerRowTicketLocked(row));
  if (empty) {
    const named = {
      ...empty,
      name: personName,
      partyId: ticketId,
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
    partyId: ticketId,
    qtyWhole: '',
    adultQty: buffet ? '' : undefined,
    childQty: buffet ? '' : undefined,
  };
  return { rows: [...rows, created], row: created };
}

/**
 * Sole menu pool→person qty write: upsert unpaid ticket row and add `take`
 * (clamped to pool remaining). Row "+" / 1/N and「全部分给当前人」all go through here.
 * A fractional result is stamped with the line's cut (`unitDen` picked, else the cut the
 * line already has) — see `by-item-fraction-unit`.
 */
function addMenuShareQtyToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  take: Rational;
  unitDen?: number;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId, take, unitDen } = params;
  const name = personName.trim();
  if (!name || take.num <= 0) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
  if (remaining.num <= 0) return null;

  const clamped = minRational(remaining, take);
  if (clamped.num <= 0) return null;

  const lineUnit = menuLineFractionUnit(rows);
  const { rows: nextRows, row } = upsertEditableTicketRow(rows, name, false, partyId);
  const current = parseConsumerRowQty(row) ?? rationalFromInt(0);
  const nextQty = addRationals(current, clamped);
  const patched = nextRows.map((candidate) =>
    candidate.id === row.id
      ? {
          ...candidate,
          name,
          partyId: row.partyId,
          ...rationalToRowQtyFields(nextQty),
          unitDen: unitDenForQty(nextQty, lineUnit ?? unitDen),
          paidLocked: undefined,
        }
      : candidate,
  );
  return { ...allocations, [lineKey]: patched };
}

/** Add whole unit (or remaining if &lt; 1) from pool to person — fatura pool "+" semantics. */
export function addWholeShareToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId } = params;
  const name = personName.trim();
  if (!name) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
  if (remaining.num <= 0) return null;

  return addMenuShareQtyToPerson({
    allocations,
    lineSpecs,
    lineKey,
    personName: name,
    partyId,
    take: minRational(remaining, rationalFromInt(1)),
  });
}

/**
 * Sole pool `1/N` units: the line's fixed cut (when the pool still holds one), else every
 * unit that fits the remaining while the line is free.
 */
function menuFractionUnitChoices(remaining: Rational, fixedUnit: number | null): number[] {
  if (remaining.num <= 0) return [];
  const candidates = fixedUnit != null ? [fixedUnit] : [...FRACTION_UNIT_DENS];
  return candidates.filter(
    (unit) => compareRationals(remaining, fractionUnitQty(unit)) >= 0,
  );
}

/** Add one 1/unitDen when the pool can cover it and the line is free or already cut that way. */
export function addMenuFractionShareToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  unitDen: number;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId, unitDen } = params;
  const name = personName.trim();
  if (!name) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;
  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
  if (!menuFractionUnitChoices(remaining, menuLineFractionUnit(rows)).includes(unitDen)) {
    return null;
  }

  return addMenuShareQtyToPerson({
    allocations,
    lineSpecs,
    lineKey,
    personName: name,
    partyId,
    take: fractionUnitQty(unitDen),
    unitDen,
  });
}

/**
 * Sole buffet pool→person seat write: add adult/child deltas clamped to remaining.
 * Row「成人/儿童」uses delta 1;「全部分给当前人」uses all remaining seats in one write.
 */
function addBuffetSeatDeltaToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  adultDelta: number;
  childDelta: number;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId } = params;
  const name = personName.trim();
  if (!name) return null;
  const adultDelta = Math.max(0, Math.floor(params.adultDelta));
  const childDelta = Math.max(0, Math.floor(params.childDelta));
  if (adultDelta <= 0 && childDelta <= 0) return null;

  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'buffet') return null;

  const rows = allocations[lineKey] ?? [];
  const assigned = parseBuffetConsumerRows(rows);
  const adultsAssigned = assigned.reduce((sum, row) => sum + row.adults, 0);
  const childrenAssigned = assigned.reduce((sum, row) => sum + row.children, 0);
  const takeAdults = Math.min(adultDelta, Math.max(0, spec.adults - adultsAssigned));
  const takeChildren = Math.min(childDelta, Math.max(0, spec.children - childrenAssigned));
  if (takeAdults <= 0 && takeChildren <= 0) return null;

  const { rows: nextRows, row } = upsertEditableTicketRow(rows, name, true, partyId);
  // Do not use resolveBuffetRowCounts here — empty named rows default to 1 adult,
  // which would double-count when we then apply the pool delta.
  const adults = parseBuffetHeadcountInput(row.adultQty);
  const children = parseBuffetHeadcountInput(row.childQty);
  const nextAdults = adults + takeAdults;
  const nextChildren = children + takeChildren;
  const patched = nextRows.map((candidate) =>
    candidate.id === row.id
      ? {
          ...candidate,
          name,
          partyId: row.partyId,
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

export function addBuffetSeatToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  guestType: 'adult' | 'child';
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId, guestType } = params;
  return addBuffetSeatDeltaToPerson({
    allocations,
    lineSpecs,
    lineKey,
    personName,
    partyId,
    adultDelta: guestType === 'adult' ? 1 : 0,
    childDelta: guestType === 'child' ? 1 : 0,
  });
}

/**
 * Sole pool-level assign-all (「全部分给当前人」): one write per line — menu take=all remaining,
 * buffet take=all remaining adult+child seats — via the same qty/seat writers
 * as row "+" /「成人」「儿童」. Returns null when nothing changed.
 */
export function assignAllRemainingPoolToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  personName: string;
  partyId?: string;
}): Record<string, ByItemConsumerRow[]> | null {
  const name = params.personName.trim();
  if (!name) return null;

  let next = params.allocations;
  let changed = false;

  for (const spec of params.lineSpecs) {
    if (spec.mode === 'menu') {
      const rows = next[spec.key] ?? [];
      const remaining = qtyDiff(rationalFromNumber(spec.lineQty), allocatedMenuQty(rows));
      if (remaining.num <= 0) continue;
      const step = addMenuShareQtyToPerson({
        allocations: next,
        lineSpecs: params.lineSpecs,
        lineKey: spec.key,
        personName: name,
        partyId: params.partyId,
        take: remaining,
      });
      if (step) {
        next = step;
        changed = true;
      }
      continue;
    }

    const rows = next[spec.key] ?? [];
    const assigned = parseBuffetConsumerRows(rows);
    const adultsAssigned = assigned.reduce((sum, row) => sum + row.adults, 0);
    const childrenAssigned = assigned.reduce((sum, row) => sum + row.children, 0);
    const step = addBuffetSeatDeltaToPerson({
      allocations: next,
      lineSpecs: params.lineSpecs,
      lineKey: spec.key,
      personName: name,
      partyId: params.partyId,
      adultDelta: Math.max(0, spec.adults - adultsAssigned),
      childDelta: Math.max(0, spec.children - childrenAssigned),
    });
    if (step) {
      next = step;
      changed = true;
    }
  }

  return changed ? next : null;
}

/** Result of a staff share edit that may empty a row (caller records the omit). */
export type StaffShareReturn = {
  allocations: Record<string, ByItemConsumerRow[]>;
  /** The row held nothing after the edit and was removed. */
  removed: boolean;
  ticketKey: string | null;
};

/**
 * Sole pool-return write (mirror of the pool buttons): give one whole / one 1/unit back from
 * a person's menu share. Paid rows never change; a row left at 0 is removed.
 */
export function returnMenuShareToPool(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
  kind: 'whole' | 'fraction';
}): StaffShareReturn | null {
  const { allocations, lineSpecs, lineKey, rowId, kind } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;
  const rows = allocations[lineKey] ?? [];
  const target = rows.find((row) => row.id === rowId);
  if (!target || !target.name.trim() || target.paidLocked) return null;
  const current = parseConsumerRowQty(target);
  if (!current) return null;
  const unit = menuLineFractionUnit(rows);
  const take = kind === 'whole' ? rationalFromInt(1) : unit != null ? fractionUnitQty(unit) : null;
  if (!take || compareRationals(current, take) < 0) return null;

  const next = qtyDiff(current, take);
  const ticketKey = splitPartyKey(target.partyId, target.name);
  if (next.num <= 0) {
    return {
      allocations: removePersonShareOnLine({ allocations, lineKey, rowId, buffet: false }),
      removed: true,
      ticketKey,
    };
  }
  return {
    allocations: {
      ...allocations,
      [lineKey]: rows.map((row) =>
        row.id === rowId
          ? { ...row, ...rationalToRowQtyFields(next), unitDen: unitDenForQty(next, row.unitDen ?? unit) }
          : row,
      ),
    },
    removed: false,
    ticketKey,
  };
}

/** Pool-return for buffet seats: give one adult / child head back. */
export function returnBuffetSeatToPool(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
  guestType: 'adult' | 'child';
}): StaffShareReturn | null {
  const { allocations, lineSpecs, lineKey, rowId, guestType } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'buffet') return null;
  const rows = allocations[lineKey] ?? [];
  const target = rows.find((row) => row.id === rowId);
  if (!target || !target.name.trim() || target.paidLocked) return null;
  const { adults, children } = resolveBuffetRowCounts(target);
  const nextAdults = guestType === 'adult' ? adults - 1 : adults;
  const nextChildren = guestType === 'child' ? children - 1 : children;
  if (nextAdults < 0 || nextChildren < 0) return null;

  const ticketKey = splitPartyKey(target.partyId, target.name);
  if (nextAdults === 0 && nextChildren === 0) {
    return {
      allocations: removePersonShareOnLine({ allocations, lineKey, rowId, buffet: true }),
      removed: true,
      ticketKey,
    };
  }
  return {
    allocations: {
      ...allocations,
      [lineKey]: rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              adultQty: nextAdults > 0 ? String(nextAdults) : '',
              childQty: nextChildren > 0 ? String(nextChildren) : '',
            }
          : row,
      ),
    },
    removed: false,
    ticketKey,
  };
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

/** Ordered unique tickets currently present in allocations (non-empty). */
export function staffByItemPeopleFromAllocations(
  allocations: Record<string, ByItemConsumerRow[]>,
): StaffByItemRailPerson[] {
  const seen = new Set<string>();
  const people: StaffByItemRailPerson[] = [];
  for (const rows of Object.values(allocations)) {
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) continue;
      const partyId = row.partyId?.trim() || undefined;
      const key = splitPartyKey(partyId, name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      people.push(partyId ? { name, partyId } : { name });
    }
  }
  return people;
}
