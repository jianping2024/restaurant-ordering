/**
 * Sole helpers for staff checkout by-item workbench (Fatura-like pool + current person).
 * Guest dish-card UI stays in ByItemSplitSection; do not duplicate this layout there.
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

/** Last-committed menu qty fields while the row draft may be mid-edit / incomplete. */
export type StaffMenuQtyHold = Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>;

/**
 * Sole qty for pool remaining + share meta: live parse when valid, else hold.
 * Mid-edit empty/incomplete digits must not free the pool or paint `—` meta.
 */
export function resolveStaffMenuShareQtyForPool(
  row: ByItemConsumerRow,
  hold: StaffMenuQtyHold | undefined,
): Rational | null {
  const live = parseConsumerRowQty(row);
  if (live) return live;
  if (!hold) return null;
  return parseConsumerRowQty({
    ...row,
    qtyWhole: hold.qtyWhole,
    qtyNum: hold.qtyNum,
    qtyDen: hold.qtyDen,
  });
}

function staffMenuQtyHoldFields(row: ByItemConsumerRow): StaffMenuQtyHold {
  return {
    qtyWhole: row.qtyWhole,
    qtyNum: row.qtyNum,
    qtyDen: row.qtyDen,
  };
}

/**
 * Qty already taken from the staff pool — named shares only.
 * Optional hold: incomplete draft rows still occupy their last-committed qty.
 * Anonymous seed qtyWhole=1 must not occupy the pool (same as parseConsumerRows).
 */
function allocatedMenuQty(
  rows: ByItemConsumerRow[],
  holdByRowId?: ReadonlyMap<string, StaffMenuQtyHold>,
): Rational {
  if (!holdByRowId || holdByRowId.size === 0) {
    const shares = parseConsumerRows(rows);
    if (shares.length === 0) return rationalFromInt(0);
    return sumRationals(shares.map((share) => share.qty));
  }
  const qtys: Rational[] = [];
  for (const row of rows) {
    if (!row.name.trim()) continue;
    const qty = resolveStaffMenuShareQtyForPool(row, holdByRowId.get(row.id));
    if (qty) qtys.push(qty);
  }
  if (qtys.length === 0) return rationalFromInt(0);
  return sumRationals(qtys);
}

/**
 * Derived allocations for pool / share meta / chip money while qty inputs bind draft.
 * Incomplete named menu rows use hold fields; buffet / paid / valid live rows unchanged.
 */
export function applyStaffMenuQtyHoldToAllocations(
  allocations: Record<string, ByItemConsumerRow[]>,
  holdByRowId: ReadonlyMap<string, StaffMenuQtyHold>,
): Record<string, ByItemConsumerRow[]> {
  if (holdByRowId.size === 0) return allocations;
  let changed = false;
  const next: Record<string, ByItemConsumerRow[]> = {};
  for (const [lineKey, rows] of Object.entries(allocations)) {
    next[lineKey] = rows.map((row) => {
      if (!row.name.trim() || row.paidLocked) return row;
      if (parseConsumerRowQty(row)) return row;
      const hold = holdByRowId.get(row.id);
      if (!hold) return row;
      if (
        row.qtyWhole === hold.qtyWhole &&
        row.qtyNum === hold.qtyNum &&
        row.qtyDen === hold.qtyDen
      ) {
        return row;
      }
      changed = true;
      return { ...row, ...hold };
    });
  }
  return changed ? next : allocations;
}

/**
 * Sole blur/commit for staff menu share qty:
 * valid → keep row + return hold; invalid/empty → remove row (caller records omit).
 */
export function commitStaffMenuShareQtyEdit(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  rowId: string;
}): {
  allocations: Record<string, ByItemConsumerRow[]>;
  removed: boolean;
  hold: StaffMenuQtyHold | null;
  ticketKey: string | null;
} | null {
  const { allocations, lineSpecs, lineKey, rowId } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;
  const rows = allocations[lineKey] ?? [];
  const target = rows.find((row) => row.id === rowId);
  if (!target || !target.name.trim() || target.paidLocked) return null;

  const ticketKey = splitPartyKey(target.partyId, target.name);
  const live = parseConsumerRowQty(target);
  if (live) {
    return {
      allocations,
      removed: false,
      hold: staffMenuQtyHoldFields(target),
      ticketKey,
    };
  }

  return {
    allocations: removePersonShareOnLine({
      allocations,
      lineKey,
      rowId,
      buffet: false,
    }),
    removed: true,
    hold: null,
    ticketKey,
  };
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
   * Sole menu pool `1/N` denominator: remaining's den when ≥2, else 2.
   * Buffet lines keep 2 (button unused).
   */
  fractionDenominator: number;
  /** Remaining covers at least {@link menuFractionTake} of {@link fractionDenominator}. */
  canAddFraction: boolean;
  canAddAdult: boolean;
  canAddChild: boolean;
};

export type StaffByItemPersonShare = {
  lineKey: string;
  rowId: string;
  label: string;
  /**
   * Menu: qty factor for {@link staffByItemShareLineMetaParts}.
   * Buffet: unused (`''`) — headcount is the editors, not a qty algebra string.
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
  /** Mid-edit hold — incomplete draft qty still counts as taken until blur commit. */
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): StaffByItemPoolLine[] {
  const {
    lineSpecs,
    orderLines,
    allocations,
    lang,
    itemCodeByMenuId = {},
    menuQtyHoldByRowId,
  } = params;
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
        fractionDenominator: 2,
        canAddFraction: false,
        canAddAdult: adultsRemaining > 0,
        canAddChild: childrenRemaining > 0,
      });
      continue;
    }

    const target = rationalFromNumber(spec.lineQty);
    const remaining = qtyDiff(target, allocatedMenuQty(rows, menuQtyHoldByRowId));
    const remainingPositive = remaining.num > 0;
    const fractionDenominator = menuFractionDenominatorFromRemaining(remaining);
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
      fractionDenominator,
      canAddFraction:
        remainingPositive &&
        compareRationals(remaining, menuFractionTake(fractionDenominator)) >= 0,
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
  /** Mid-edit hold — meta shows last-committed qty while inputs bind draft. */
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): StaffByItemPersonShare[] {
  const {
    personName,
    partyId,
    lineSpecs,
    orderLines,
    allocations,
    lang,
    itemCodeByMenuId = {},
    menuQtyHoldByRowId,
  } = params;
  if (!personName.trim()) return [];

  const orderByKey = Object.fromEntries(orderLines.map((line) => [line.key, line]));
  const out: StaffByItemPersonShare[] = [];
  const displayAllocations = menuQtyHoldByRowId
    ? applyStaffMenuQtyHoldToAllocations(allocations, menuQtyHoldByRowId)
    : allocations;

  for (const spec of lineSpecs) {
    const item = orderByKey[spec.key];
    if (!item) continue;
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    const label = formatLocalizedMenuItemLabel(item, lang, itemCode);
    const rows = allocations[spec.key] ?? [];
    const displayRows = displayAllocations[spec.key] ?? rows;
    const amountsByRowId = shareAmountsByRowId(spec, displayRows);

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
          qtyWhole: '',
          qtyNum: '',
          qtyDen: '',
          adultQty: row.adultQty ?? '',
          childQty: row.childQty ?? '',
        });
        continue;
      }

      // Keep named rows while qty is incomplete/invalid so ByItemQtyInput stays mounted.
      // Meta/amount use hold when draft parse fails (never paint empty `—` mid-edit).
      const qty = resolveStaffMenuShareQtyForPool(
        row,
        menuQtyHoldByRowId?.get(row.id),
      );
      out.push({
        lineKey: spec.key,
        rowId: row.id,
        label,
        qtyLabel: qty ? formatRational(qty) : '—',
        unitPriceLabel: formatEuroAmount(spec.unitPrice),
        amount: amountsByRowId.get(row.id) ?? 0,
        mode: 'menu',
        // Inputs bind draft fields; meta uses qtyLabel from hold-aware qty.
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
 */
function addMenuShareQtyToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  take: Rational;
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): Record<string, ByItemConsumerRow[]> | null {
  const {
    allocations,
    lineSpecs,
    lineKey,
    personName,
    partyId,
    take,
    menuQtyHoldByRowId,
  } = params;
  const name = personName.trim();
  if (!name || take.num <= 0) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(
    rationalFromNumber(spec.lineQty),
    allocatedMenuQty(rows, menuQtyHoldByRowId),
  );
  if (remaining.num <= 0) return null;

  const clamped = minRational(remaining, take);
  if (clamped.num <= 0) return null;

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
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): Record<string, ByItemConsumerRow[]> | null {
  const { allocations, lineSpecs, lineKey, personName, partyId, menuQtyHoldByRowId } =
    params;
  const name = personName.trim();
  if (!name) return null;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return null;

  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(
    rationalFromNumber(spec.lineQty),
    allocatedMenuQty(rows, menuQtyHoldByRowId),
  );
  if (remaining.num <= 0) return null;

  return addMenuShareQtyToPerson({
    allocations,
    lineSpecs,
    lineKey,
    personName: name,
    partyId,
    take: minRational(remaining, rationalFromInt(1)),
    menuQtyHoldByRowId,
  });
}

/** Sole pool `1/N` denominator: remaining's den when ≥2, else 2 (whole cups). */
export function menuFractionDenominatorFromRemaining(remaining: Rational): number {
  const { den } = normalizeRational(remaining);
  if (den >= 2) return den;
  return 2;
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
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): boolean {
  const { allocations, lineSpecs, lineKey, denominator, menuQtyHoldByRowId } = params;
  const spec = lineSpecs.find((line) => line.key === lineKey);
  if (!spec || spec.mode !== 'menu') return false;
  const rows = allocations[lineKey] ?? [];
  const remaining = qtyDiff(
    rationalFromNumber(spec.lineQty),
    allocatedMenuQty(rows, menuQtyHoldByRowId),
  );
  return compareRationals(remaining, menuFractionTake(denominator)) >= 0;
}

/** Add 1/denominator (default 1/2) when the pool can cover it. */
export function addMenuFractionShareToPerson(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  lineKey: string;
  personName: string;
  partyId?: string;
  denominator?: number;
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): Record<string, ByItemConsumerRow[]> | null {
  const {
    allocations,
    lineSpecs,
    lineKey,
    personName,
    partyId,
    denominator = 2,
    menuQtyHoldByRowId,
  } = params;
  const name = personName.trim();
  if (!name) return null;
  if (
    !canAddMenuFractionShare({
      allocations,
      lineSpecs,
      lineKey,
      denominator,
      menuQtyHoldByRowId,
    })
  ) {
    return null;
  }

  return addMenuShareQtyToPerson({
    allocations,
    lineSpecs,
    lineKey,
    personName: name,
    partyId,
    take: menuFractionTake(denominator),
    menuQtyHoldByRowId,
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
  menuQtyHoldByRowId?: ReadonlyMap<string, StaffMenuQtyHold>;
}): Record<string, ByItemConsumerRow[]> | null {
  const name = params.personName.trim();
  if (!name) return null;

  let next = params.allocations;
  let changed = false;

  for (const spec of params.lineSpecs) {
    if (spec.mode === 'menu') {
      const rows = next[spec.key] ?? [];
      const remaining = qtyDiff(
        rationalFromNumber(spec.lineQty),
        allocatedMenuQty(rows, params.menuQtyHoldByRowId),
      );
      if (remaining.num <= 0) continue;
      const step = addMenuShareQtyToPerson({
        allocations: next,
        lineSpecs: params.lineSpecs,
        lineKey: spec.key,
        personName: name,
        partyId: params.partyId,
        take: remaining,
        menuQtyHoldByRowId: params.menuQtyHoldByRowId,
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

/**
 * Sole menu-share denominator lock for staff by-item:
 * once any row on the line is `paidLocked`, every share on that line has
 * `qtyDen` read-only (stops unpaid peers from reshuffling cent remainder).
 */
export function byItemMenuQtyDenReadOnly(
  lineRows: ReadonlyArray<Pick<ByItemConsumerRow, 'paidLocked'>>,
): boolean {
  return lineRows.some((row) => Boolean(row.paidLocked));
}

/**
 * Patch menu qty fields on one named share row (whole + num/den).
 * Same remaining truth as the pool: {@link parseConsumerRows} / {@link allocatedMenuQty}.
 * Paid rows reject all qty edits; when the line has any paid share, `qtyDen` is frozen.
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
  if (target.paidLocked) return null;

  const denFrozen = byItemMenuQtyDenReadOnly(rows);
  const nextRow = {
    ...target,
    qtyWhole: patch.qtyWhole,
    qtyNum: patch.qtyNum,
    qtyDen: denFrozen ? target.qtyDen : patch.qtyDen,
  };
  const patched = rows.map((row) => (row.id === rowId ? nextRow : row));
  return { ...allocations, [lineKey]: patched };
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
