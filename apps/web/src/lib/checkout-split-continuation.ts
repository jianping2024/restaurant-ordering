import {
  buildByItemAllocationsFromPersons,
  createByItemConsumerRow,
  parseBuffetHeadcountInput,
  parseConsumerRowQty,
  rationalToRowQtyFields,
  removeByItemConsumerRow,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  normalizeRational,
  rationalGte,
  compareRationals,
  type Rational,
} from '@/lib/rational-qty';
import { displaySplitPersonName, splitPersonKey } from '@/lib/split-person-identity';
import type { BillSplit, SplitPerson } from '@/types';
import type { CheckoutRequestPayload } from '@/lib/checkout-split-intent';
import {
  isShapeLockSplitMode,
  isWholeTableSplit,
  parseSplitMode,
} from '@/lib/checkout-split-intent';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectedPersonNames } from '@/lib/checkout-session-payments';
import { isWholeTablePayerName } from '@/lib/split-person-label';

export type CheckoutContinuationIssue =
  | 'split_mode_locked'
  | 'locked_allocation_changed'
  | 'split_shape_locked';

export type LockedPersonLineMins = {
  menu: Map<string, Rational>;
  buffet: Map<string, { adults: number; children: number }>;
};

export type ByItemRowEditLock = {
  nameReadOnly: boolean;
  minMenuQty: Rational | null;
  minBuffetAdults: number;
  minBuffetChildren: number;
  removable: boolean;
  /** Paid-frozen row: qty fields are exact read-only (no bump-merge). */
  qtyReadOnly: boolean;
};

/** Context for enforcing paid-allocation floors on one by-item catalog line. */
export type ByItemLineEditContext = {
  lineKey: string;
  spec: ByItemLineSpec;
  locks: LockedPersonLineMins;
};

/** Locked split row count from persisted persons or result snapshot. */
export function lockedSplitRowCount(split: BillSplit | null | undefined): number {
  if (!split) return 0;
  return Math.max(split.persons?.length ?? 0, split.result?.length ?? 0);
}

export type ContinuationSplitShape = {
  personCount: number;
  personNames: string[];
};

/**
 * Sole even/custom draft roster builder: pad/truncate to `count`, replace blank or
 * whole-table sentinel names with `guestName(i+1)`.
 */
export function ensureSplitPersonNames(
  names: readonly string[],
  count: number,
  guestName: (n: number) => string,
): string[] {
  const n = Math.min(20, Math.max(1, Math.round(count)));
  const next: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const raw = names[i]?.trim() ?? '';
    next.push(raw && !isWholeTablePayerName(raw) ? raw : guestName(i + 1));
  }
  return next;
}

/** Default even/custom draft roster (2 guests) when there is no continuation shape. */
export function defaultSplitPersonNames(guestName: (n: number) => string, count = 2): string[] {
  return ensureSplitPersonNames([], count, guestName);
}

/**
 * Hydrate even/custom draft shape from a paused continuation split.
 * Whole-table is not a multi-person draft — returns null so callers seed the default roster.
 */
export function resolveContinuationSplitShape(
  split: BillSplit | null | undefined,
  guestName: (n: number) => string,
): ContinuationSplitShape | null {
  if (!split) return null;
  if (isWholeTableSplit(split)) return null;
  const locked = lockedSplitRowCount(split);
  if (locked < 1) return null;

  const personCount = split.split_mode === 'even' ? Math.max(2, locked) : locked;
  const rawNames: string[] = [];
  for (let i = 0; i < locked; i += 1) {
    const fromResult = split.result?.[i]?.name?.trim();
    const fromPerson = split.persons?.[i]?.name?.trim();
    rawNames.push(fromResult || fromPerson || '');
  }

  return {
    personCount,
    personNames: ensureSplitPersonNames(rawNames, personCount, guestName),
  };
}

/** Session has at least one confirmed per-person payment on the active split. */
export function hasPaidSplitRow(split: BillSplit | null | undefined): boolean {
  return (split?.result ?? []).some((row) => !!row.paid);
}

/** Checkout was paused for more ordering while keeping split snapshot (resume after partial pay). */
export function isPausedCheckoutSplit(
  split: BillSplit | null | undefined,
  sessionStatus: string | null | undefined,
): boolean {
  return sessionStatus === 'open' && split?.status === 'confirmed';
}

/** Split plan must not change after partial collection has started. */
export function isCheckoutSplitLocked(
  split: BillSplit | null | undefined,
  hasCollectedLedger = false,
): boolean {
  if (!split) return false;
  if (hasPaidSplitRow(split)) return true;
  if (hasCollectedLedger) return true;
  return false;
}

/** Guests with collection history on this session (case-insensitive). */
export function allocationLockedPersonNames(
  split: BillSplit | null | undefined,
  collectedPayments: SessionCollectedPayment[] = [],
): ReadonlySet<string> {
  const names = new Set(collectedPersonNames(collectedPayments));
  for (const name of Array.from(paidSplitPersonNames(split))) {
    names.add(name);
  }
  return names;
}

/** Guests who already paid on the active split (case-insensitive). */
export function paidSplitPersonNames(split: BillSplit | null | undefined): ReadonlySet<string> {
  return new Set(
    (split?.result ?? [])
      .filter((row) => row.paid)
      .map((row) => row.name.trim().toLowerCase()),
  );
}

/** Bill page shows post-request success only while checkout is actively requested. */
export function shouldShowCheckoutSubmitted(
  split: BillSplit | null | undefined,
  sessionStatus: string | null | undefined,
): boolean {
  if (!split) return false;
  if (split.status === 'requested') return true;
  if (isPausedCheckoutSplit(split, sessionStatus)) return false;
  return split.status === 'pending';
}

export function lockedPersonLineKey(lineKey: string, personName: string): string {
  return `${lineKey}::${personName.trim().toLowerCase()}`;
}

/**
 * Minimum assigned qty per (line, person) after collection starts.
 * New qty on the same line may exceed these floors; lowering below floor is forbidden.
 */
export function buildLockedPersonLineMins(
  split: BillSplit | null | undefined,
  hasCollectedLedger = false,
  collectedPayments: SessionCollectedPayment[] = [],
): LockedPersonLineMins {
  const menu = new Map<string, Rational>();
  const buffet = new Map<string, { adults: number; children: number }>();
  if (!split || split.split_mode !== 'by_item') {
    return { menu, buffet };
  }

  const lockedNames = allocationLockedPersonNames(split, collectedPayments);
  const lockAllAssignedShares = hasCollectedLedger && lockedNames.size === 0;

  for (const person of split.persons ?? []) {
    const personLower = person.name.trim().toLowerCase();
    const isLockedPerson = lockedNames.has(personLower);
    if (!lockAllAssignedShares && !isLockedPerson) continue;

    for (const share of person.item_shares ?? []) {
      if (!share.key) continue;
      const mapKey = lockedPersonLineKey(share.key, person.name);
      const qty = normalizeRational({ num: share.qty_num, den: share.qty_den });
      if (share.guest_type === 'adult' || share.guest_type === 'child') {
        const entry = buffet.get(mapKey) ?? { adults: 0, children: 0 };
        const count = Math.max(0, Math.round(qty.num / qty.den));
        if (share.guest_type === 'child') entry.children += count;
        else entry.adults += count;
        buffet.set(mapKey, entry);
        continue;
      }
      menu.set(mapKey, qty);
    }

    for (const key of person.items ?? []) {
      const mapKey = lockedPersonLineKey(key, person.name);
      if (!menu.has(mapKey)) {
        menu.set(mapKey, { num: 1, den: 1 });
      }
    }
  }

  return { menu, buffet };
}

/** Per-row UI lock for one payer on a by-item dish line. */
export function byItemRowEditLock(params: {
  lineKey: string;
  row: ByItemConsumerRow;
  locks: LockedPersonLineMins;
  spec: ByItemLineSpec;
}): ByItemRowEditLock {
  const { lineKey, row, locks, spec } = params;
  const name = row.name.trim();
  if (!name) {
    return {
      nameReadOnly: false,
      minMenuQty: null,
      minBuffetAdults: 0,
      minBuffetChildren: 0,
      removable: true,
      qtyReadOnly: false,
    };
  }

  // Paid-frozen row: exact lock — no qty edit, no remove, no merge.
  if (row.paidLocked) {
    const parsed = parseConsumerRowQty(row);
    return {
      nameReadOnly: true,
      minMenuQty: spec.mode === 'menu' ? parsed : null,
      minBuffetAdults: spec.mode === 'buffet' ? parseBuffetHeadcountInput(row.adultQty) : 0,
      minBuffetChildren: spec.mode === 'buffet' ? parseBuffetHeadcountInput(row.childQty) : 0,
      removable: false,
      qtyReadOnly: true,
    };
  }

  const mapKey = lockedPersonLineKey(lineKey, name);
  if (spec.mode === 'buffet') {
    const mins = locks.buffet.get(mapKey) ?? { adults: 0, children: 0 };
    const hasLock = mins.adults > 0 || mins.children > 0;
    return {
      nameReadOnly: hasLock,
      minMenuQty: null,
      minBuffetAdults: mins.adults,
      minBuffetChildren: mins.children,
      removable: !hasLock,
      qtyReadOnly: false,
    };
  }

  const minMenuQty = locks.menu.get(mapKey) ?? null;
  const hasLock = !!minMenuQty && minMenuQty.num > 0;
  return {
    nameReadOnly: hasLock,
    minMenuQty: hasLock ? minMenuQty : null,
    minBuffetAdults: 0,
    minBuffetChildren: 0,
    removable: !hasLock,
    // Floor-only legacy path: still allow new qty above floor on non-paidLocked rows
    // only when row is not paidLocked (new dish row after resume).
    qtyReadOnly: false,
  };
}

function buffetRowsFromShares(
  shares: Array<{ name: string; qty: Rational; guestType?: 'adult' | 'child' }>,
): ByItemConsumerRow[] {
  const byKey = new Map<string, { name: string; adults: number; children: number }>();
  for (const share of shares) {
    const key = splitPersonKey(share.name);
    if (!key) continue;
    const entry = byKey.get(key) ?? {
      name: displaySplitPersonName(share.name),
      adults: 0,
      children: 0,
    };
    const count = Math.round(share.qty.num / share.qty.den);
    if (share.guestType === 'child') entry.children += count;
    else entry.adults += count;
    byKey.set(key, entry);
  }
  return Array.from(byKey.values()).map(({ name, adults, children }) => ({
    ...createByItemConsumerRow({ buffet: true }),
    name,
    adultQty: adults > 0 ? String(adults) : '',
    childQty: children > 0 ? String(children) : '',
    qtyWhole: '',
    qtyNum: '',
    qtyDen: '',
  }));
}

/** Hydrate ByItem UI rows from persisted split persons. */
export function buildByItemConsumerRowsFromPersons(
  persons: SplitPerson[],
  lineSpecs: ByItemLineSpec[],
  /** Paid floors: qty up to these mins → paidLocked rows; surplus → separate editable rows. */
  locks: LockedPersonLineMins = { menu: new Map(), buffet: new Map() },
): Record<string, ByItemConsumerRow[]> {
  const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
  const rows: Record<string, ByItemConsumerRow[]> = {};

  for (const spec of lineSpecs) {
    const shares = allocations[spec.key];
    if (!shares?.length) continue;

    if (spec.mode === 'buffet') {
      const expanded: ByItemConsumerRow[] = [];
      for (const row of buffetRowsFromShares(shares)) {
        const mapKey = lockedPersonLineKey(spec.key, row.name);
        const mins = locks.buffet.get(mapKey);
        const adults = parseBuffetHeadcountInput(row.adultQty);
        const children = parseBuffetHeadcountInput(row.childQty);
        if (!mins || (mins.adults <= 0 && mins.children <= 0)) {
          expanded.push(row);
          continue;
        }
        if (adults <= mins.adults && children <= mins.children) {
          expanded.push({ ...row, paidLocked: true });
          continue;
        }
        expanded.push({
          ...createByItemConsumerRow({ buffet: true }),
          name: row.name,
          adultQty: mins.adults > 0 ? String(mins.adults) : '',
          childQty: mins.children > 0 ? String(mins.children) : '',
          paidLocked: true,
        });
        const extraA = adults - mins.adults;
        const extraC = children - mins.children;
        if (extraA > 0 || extraC > 0) {
          expanded.push({
            ...createByItemConsumerRow({ buffet: true }),
            name: row.name,
            adultQty: extraA > 0 ? String(extraA) : '',
            childQty: extraC > 0 ? String(extraC) : '',
          });
        }
      }
      rows[spec.key] = expanded;
      continue;
    }

    const byPerson = new Map<string, typeof shares>();
    for (const share of shares) {
      const key = share.name.trim().toLowerCase();
      const list = byPerson.get(key) ?? [];
      list.push(share);
      byPerson.set(key, list);
    }

    const lineRows: ByItemConsumerRow[] = [];
    for (const personShares of Array.from(byPerson.values())) {
      const name = personShares[0]!.name;
      const mapKey = lockedPersonLineKey(spec.key, name);
      const minQty = locks.menu.get(mapKey);
      let lockLeft =
        minQty && minQty.num > 0 ? normalizeRational(minQty) : null;

      for (const share of personShares) {
        let qty = normalizeRational(share.qty);
        if (lockLeft && lockLeft.num > 0) {
          const cmp = compareRationals(qty, lockLeft);
          if (cmp <= 0) {
            lineRows.push({
              ...createByItemConsumerRow(),
              name,
              ...rationalToRowQtyFields(qty),
              paidLocked: true,
            });
            lockLeft = normalizeRational({
              num: lockLeft.num * qty.den - qty.num * lockLeft.den,
              den: lockLeft.den * qty.den,
            });
            continue;
          }
          lineRows.push({
            ...createByItemConsumerRow(),
            name,
            ...rationalToRowQtyFields(lockLeft),
            paidLocked: true,
          });
          qty = normalizeRational({
            num: qty.num * lockLeft.den - lockLeft.num * qty.den,
            den: qty.den * lockLeft.den,
          });
          lockLeft = { num: 0, den: 1 };
        }
        if (qty.num > 0) {
          lineRows.push({
            ...createByItemConsumerRow(),
            name,
            ...rationalToRowQtyFields(qty),
          });
        }
      }
    }
    rows[spec.key] = lineRows;
  }
  return rows;
}

function lockedSharesPreserved(params: {
  locked: LockedPersonLineMins;
  incomingPersons: SplitPerson[];
  lineSpecs: ByItemLineSpec[];
}): boolean {
  const { locked, incomingPersons, lineSpecs } = params;
  if (locked.menu.size === 0 && locked.buffet.size === 0) return true;

  const incomingAlloc = buildByItemAllocationsFromPersons(incomingPersons, lineSpecs);

  for (const [mapKey, minQty] of Array.from(locked.menu.entries())) {
    const sep = mapKey.lastIndexOf('::');
    if (sep < 0) return false;
    const lineKey = mapKey.slice(0, sep);
    const personLower = mapKey.slice(sep + 2);
    const share = (incomingAlloc[lineKey] ?? []).find(
      (row) => row.name.trim().toLowerCase() === personLower,
    );
    if (!share || !rationalGte(share.qty, minQty)) return false;
  }

  for (const [mapKey, minCounts] of Array.from(locked.buffet.entries())) {
    const sep = mapKey.lastIndexOf('::');
    if (sep < 0) return false;
    const lineKey = mapKey.slice(0, sep);
    const personLower = mapKey.slice(sep + 2);
    const shares = incomingAlloc[lineKey] ?? [];
    let adults = 0;
    let children = 0;
    for (const share of shares) {
      if (share.name.trim().toLowerCase() !== personLower) continue;
      const count = Math.max(0, Math.round(share.qty.num / share.qty.den));
      if (share.guestType === 'child') children += count;
      else adults += count;
    }
    if (adults < minCounts.adults || children < minCounts.children) return false;
  }

  return true;
}

export function validateCheckoutContinuation(params: {
  existing: BillSplit;
  payload: CheckoutRequestPayload;
  lineSpecs: ByItemLineSpec[];
  hasCollectedLedger: boolean;
  collectedPayments?: SessionCollectedPayment[];
}): { ok: true } | { ok: false; issue: CheckoutContinuationIssue } {
  const { existing, payload, lineSpecs, hasCollectedLedger, collectedPayments = [] } = params;
  if (!isCheckoutSplitLocked(existing, hasCollectedLedger)) {
    return { ok: true };
  }

  const existingMode = parseSplitMode(existing.split_mode);
  const incomingMode = payload.splitMode;
  if (existingMode && incomingMode !== existingMode) {
    return { ok: false, issue: 'split_mode_locked' };
  }

  if (existing.split_mode === 'by_item' && incomingMode === 'by_item') {
    const locked = buildLockedPersonLineMins(existing, hasCollectedLedger, collectedPayments);
    if (!lockedSharesPreserved({
      locked,
      incomingPersons: payload.persons,
      lineSpecs,
    })) {
      return { ok: false, issue: 'locked_allocation_changed' };
    }
    return { ok: true };
  }

  if (hasCollectedLedger && isShapeLockSplitMode(existing.split_mode)) {
    const existingCount = lockedSplitRowCount(existing);
    if (existingCount > 0 && payload.result.length !== existingCount) {
      return { ok: false, issue: 'split_shape_locked' };
    }
  }

  return { ok: true };
}

/** Clamp menu row qty so it cannot drop below a locked floor (empty qty counts as 0). */
export function clampMenuRowToMinQty(
  row: ByItemConsumerRow,
  minQty: Rational | null,
): ByItemConsumerRow {
  if (!minQty || minQty.num <= 0) return row;
  const parsed = parseConsumerRowQty(row);
  if (parsed && rationalGte(parsed, minQty)) return row;
  return { ...row, ...rationalToRowQtyFields(minQty) };
}

/** Apply a draft patch while the guest is typing (no paid-qty floor yet). */
export function applyByItemConsumerRowEdit(params: {
  row: ByItemConsumerRow;
  patch: Partial<ByItemConsumerRow>;
  ctx: ByItemLineEditContext;
}): ByItemConsumerRow {
  const { row, patch, ctx } = params;
  const lockBefore = byItemRowEditLock({
    lineKey: ctx.lineKey,
    row,
    locks: ctx.locks,
    spec: ctx.spec,
  });

  let next: ByItemConsumerRow = { ...row, ...patch };
  if (
    lockBefore.nameReadOnly
    && patch.name !== undefined
    && patch.name.trim().toLowerCase() !== row.name.trim().toLowerCase()
  ) {
    next = { ...next, name: row.name };
  }

  return next;
}

/** Commit one row after edit (blur/submit): enforce paid-allocation floors. */
export function commitByItemConsumerRowEdit(params: {
  row: ByItemConsumerRow;
  ctx: ByItemLineEditContext;
}): ByItemConsumerRow {
  const { row, ctx } = params;
  const lock = byItemRowEditLock({
    lineKey: ctx.lineKey,
    row,
    locks: ctx.locks,
    spec: ctx.spec,
  });
  if (ctx.spec.mode === 'buffet') {
    return clampBuffetRowToMinCounts(row, lock.minBuffetAdults, lock.minBuffetChildren);
  }
  return clampMenuRowToMinQty(row, lock.minMenuQty);
}

/** Commit every payer row on one dish line (blur/submit). */
export function commitByItemLineRows(
  rows: ByItemConsumerRow[],
  ctx: ByItemLineEditContext,
): ByItemConsumerRow[] {
  return rows.map((row) => commitByItemConsumerRowEdit({ row, ctx }));
}

/** Commit all by-item draft rows before checkout submit. */
export function commitAllByItemAllocations(params: {
  allocations: Record<string, ByItemConsumerRow[]>;
  lineSpecs: ByItemLineSpec[];
  locks: LockedPersonLineMins;
}): Record<string, ByItemConsumerRow[]> {
  const { allocations, lineSpecs, locks } = params;
  const next: Record<string, ByItemConsumerRow[]> = { ...allocations };
  for (const spec of lineSpecs) {
    const rows = allocations[spec.key];
    if (!rows?.length) continue;
    const ctx: ByItemLineEditContext = { lineKey: spec.key, spec, locks };
    next[spec.key] = commitByItemLineRows(rows, ctx);
  }
  return next;
}

/** Remove a consumer row only when paid-allocation rules allow it. */
export function applyByItemConsumerRowRemove(params: {
  rows: ByItemConsumerRow[];
  rowId: string;
  ctx: ByItemLineEditContext;
}): ByItemConsumerRow[] {
  const { rows, rowId, ctx } = params;
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) return rows;

  const lock = byItemRowEditLock({
    lineKey: ctx.lineKey,
    row,
    locks: ctx.locks,
    spec: ctx.spec,
  });
  if (!lock.removable || rows.length <= 1) return rows;

  return removeByItemConsumerRow(rows, rowId, { buffet: ctx.spec.mode === 'buffet' });
}

/** Clamp buffet headcounts to locked floors. */
export function clampBuffetRowToMinCounts(
  row: ByItemConsumerRow,
  minAdults: number,
  minChildren: number,
): ByItemConsumerRow {
  const adultN = Number((row.adultQty ?? '').trim() || '0');
  const childN = Number((row.childQty ?? '').trim() || '0');
  const adults = Number.isFinite(adultN) ? Math.max(minAdults, adultN) : minAdults;
  const children = Number.isFinite(childN) ? Math.max(minChildren, childN) : minChildren;
  if (adults === adultN && children === childN) return row;
  return {
    ...row,
    adultQty: adults > 0 ? String(adults) : '',
    childQty: children > 0 ? String(children) : '',
  };
}
