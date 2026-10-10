'use client';

import type { StaffTicketUnlock } from '@/components/dashboard/checkout/staff-ticket-unlock';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildByItemAllocationsFromRows,
  calcByItemSplitResults,
  locateByItemSplitResult,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { byItemSplitLineFromOrderLine } from '@/lib/bill-split-by-item-lines';
import type { UILanguage } from '@/lib/i18n';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { RowRemoveIconButton } from '@/components/menu/RowRemoveIconButton';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import { Button } from '@/components/ui/Button';
import { buttonPressReliefCompactClass } from '@/components/ui/button-press-relief';
import {
  CHECKOUT_ACTION_AMOUNT_CLASS,
  CHECKOUT_COLLECT_BUTTON_CLASS,
} from '@/lib/checkout-amount-type';
import {
  STAFF_BY_ITEM_POOL_ACTION_GHOST_CLASS,
  STAFF_BY_ITEM_POOL_ACTION_PRIMARY_CLASS,
} from '@/lib/staff-by-item-pool-action';
import {
  allocateDiscountedSplitObligations,
  resolveCheckoutDiscountedShareDisplay,
} from '@/lib/checkout-split-math';
import { splitPartyKey, splitResultTicketKey } from '@/lib/split-party-id';
import {
  type StaffByItemPersonShare,
  addBuffetSeatToPerson,
  addMenuFractionShareToPerson,
  addWholeShareToPerson,
  assignAllRemainingPoolToPerson,
  removePersonShareOnLine,
  returnBuffetSeatToPool,
  returnMenuShareToPool,
  staffByItemBuffetShareLineMetaParts,
  staffByItemPeopleFromAllocations,
  staffByItemPersonShares,
  staffByItemPoolLines,
  staffByItemShareLineMetaParts,
} from '@/lib/staff-by-item-workbench';
import {
  mintStaffByItemRailPerson,
  resolveStaffByItemRailPeople,
  staffByItemLockedLedgerPeople,
  staffByItemRailPersonKey,
  syncStaffByItemRailPeople,
  type StaffByItemRailPerson,
} from '@/lib/staff-by-item-people';

export type StaffByItemWorkbenchLabels = {
  poolTitle: string;
  currentShareTitle: string;
  markerPlaceholder: string;
  remainingPrefix: string;
  shareEmpty: string;
  /** Meta only — amount rendered beside with {@link CHECKOUT_ACTION_AMOUNT_CLASS}. */
  estimateMeta: (n: number) => string;
  needName: string;
  poolEmpty: string;
  /** Sole pool-header bulk: drain remaining dishes + buffet seats to current person. */
  assignAll: string;
  /** Sole pool CTAs, mirrored on the share rows (fixed D chrome + chevron). */
  poolAddAdult: string;
  poolAddChild: string;
  poolAddWhole: string;
  poolAddFraction: (denominator: number) => string;
  /** Strip title under a free menu line: pick the cut (fixed once paid). */
  poolPickUnit: string;
  poolCancelPick: string;
  /** Hint under the remaining qty once the line's cut is fixed. */
  unitLocked: (denominator: number) => string;
  remove: string;
  collect: string;
  paidShareBadge: string;
};

/**
 * Sole name+unit adjacent row (pool + buffet share). Unit is gold tabular; not right-pinned.
 */
function StaffByItemNameUnitRow({
  label,
  unitPriceLabel,
  lockedBadge,
}: {
  label: string;
  unitPriceLabel: string;
  lockedBadge?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="min-w-0 truncate text-sm font-semibold text-brand-text" title={label}>
        {label}
        {lockedBadge ? (
          <span className="ml-1.5 text-[11px] font-normal text-brand-text-muted">
            · {lockedBadge}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-medium tabular-nums text-brand-gold">
        {unitPriceLabel}
      </span>
    </div>
  );
}

/** I2 thin chevron — `in` sends a share to the person (›), `out` returns it to the pool (‹). */
function StaffByItemPoolActionChevron({ direction }: { direction: 'in' | 'out' }) {
  return (
    <svg
      className="h-3 w-3 shrink-0 opacity-70"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d={direction === 'in' ? 'M4.2 2.2 8 6l-3.8 3.8' : 'M7.8 2.2 4 6l3.8 3.8'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Sole by-item qty action button (1A / 1C / 1/{den}份 / 1份) — fixed D size + chevron.
 * Pool rows use `in` (›); the current person's share rows mirror it with `out` (‹).
 */
function StaffByItemPoolActionButton({
  variant,
  direction = 'in',
  disabled,
  expanded,
  onClick,
  children,
}: {
  variant: 'primary' | 'ghost';
  direction?: 'in' | 'out';
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={expanded}
      className={
        variant === 'primary'
          ? STAFF_BY_ITEM_POOL_ACTION_PRIMARY_CLASS
          : STAFF_BY_ITEM_POOL_ACTION_GHOST_CLASS
      }
      onClick={onClick}
    >
      {direction === 'out' ? <StaffByItemPoolActionChevron direction="out" /> : null}
      <span>{children}</span>
      {direction === 'in' ? <StaffByItemPoolActionChevron direction="in" /> : null}
    </button>
  );
}

/**
 * Sole pool identity: {@link StaffByItemNameUnitRow} + remaining meta.
 */
function StaffByItemPoolLineIdentity({
  label,
  unitPriceLabel,
  remainingText,
}: {
  label: string;
  unitPriceLabel: string;
  remainingText: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <StaffByItemNameUnitRow label={label} unitPriceLabel={unitPriceLabel} />
      <div className="mt-0.5 text-sm tabular-nums text-brand-text-muted">{remainingText}</div>
    </div>
  );
}

/**
 * Share-row meta — one path per mode:
 * - menu: `qty × unit = amount` via {@link staffByItemShareLineMetaParts} (+ the line's cut once fixed)
 * - buffet: assigned heads + amount (unit already on {@link StaffByItemNameUnitRow}, same as pool)
 */
function StaffByItemShareLineMeta({
  mode,
  qtyLabel,
  unitPriceLabel,
  amount,
  headcountLabel,
  unitHint,
}: {
  mode: 'menu' | 'buffet';
  qtyLabel: string;
  unitPriceLabel: string;
  amount: number;
  /** Buffet only: `1A · 1C`. */
  headcountLabel: string;
  /** Menu only: `按 1/N 分` once the line's cut is fixed. */
  unitHint?: string;
}) {
  if (mode === 'buffet') {
    const { amountText, amountReady } = staffByItemBuffetShareLineMetaParts({
      amount,
      amountReady: headcountLabel !== '',
    });
    return (
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm tabular-nums">
        <span className="whitespace-nowrap text-brand-text-muted">{headcountLabel}</span>
        <span
          className={`inline-block min-w-[4.5ch] ${
            amountReady ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
          }`}
        >
          {amountText}
        </span>
      </div>
    );
  }

  const { factorText, amountText, amountReady } = staffByItemShareLineMetaParts({
    qtyLabel,
    unitPriceLabel,
    amount,
  });
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm">
      <span className="whitespace-nowrap tabular-nums text-brand-text-muted">{factorText}</span>
      <span className="text-brand-border" aria-hidden>
        =
      </span>
      <span
        className={`inline-block min-w-[4.5ch] tabular-nums ${
          amountReady ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
        }`}
      >
        {amountText}
      </span>
      {unitHint ? (
        <span className="whitespace-nowrap text-[12px] text-brand-text-muted">· {unitHint}</span>
      ) : null}
    </div>
  );
}

/**
 * Sole share-row identity (name/unit + `qty × unit = amount` meta + paid badge) —
 * the editable share panel and the read-only {@link StaffByItemPersonShareSummary} both render this.
 */
function StaffByItemShareIdentity({
  share,
  locked,
  labels,
}: {
  share: StaffByItemPersonShare;
  locked: boolean;
  labels: Pick<StaffByItemWorkbenchLabels, 'paidShareBadge' | 'unitLocked'>;
}) {
  return (
    <>
      {share.mode === 'buffet' ? (
        <StaffByItemNameUnitRow
          label={share.label}
          unitPriceLabel={share.unitPriceLabel}
          lockedBadge={locked ? labels.paidShareBadge : undefined}
        />
      ) : (
        <div className="truncate text-sm text-brand-text" title={share.label}>
          {share.label}
          {locked ? (
            <span className="ml-1.5 text-[11px] font-normal text-brand-text-muted">
              · {labels.paidShareBadge}
            </span>
          ) : null}
        </div>
      )}
      <StaffByItemShareLineMeta
        mode={share.mode}
        qtyLabel={share.qtyLabel}
        unitPriceLabel={share.unitPriceLabel}
        amount={share.amount}
        headcountLabel={share.headcountLabel}
        unitHint={
          share.mode === 'menu' && share.fractionUnit != null
            ? labels.unitLocked(share.fractionUnit)
            : undefined
        }
      />
    </>
  );
}

/** Read-only list of one person's allocated dishes (phone「分单结果」row detail). */
export function StaffByItemPersonShareSummary({
  personName,
  partyId,
  lang,
  lineSpecs,
  orderLines,
  byItemAllocations,
  itemCodeByMenuId,
  labels,
}: {
  personName: string;
  partyId?: string;
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  itemCodeByMenuId?: Record<string, string>;
  labels: Pick<StaffByItemWorkbenchLabels, 'shareEmpty' | 'paidShareBadge' | 'unitLocked'>;
}) {
  const shares = useMemo(
    () =>
      staffByItemPersonShares({
        personName,
        partyId,
        lineSpecs,
        orderLines,
        allocations: byItemAllocations,
        lang,
        itemCodeByMenuId,
      }),
    [byItemAllocations, itemCodeByMenuId, lang, lineSpecs, orderLines, partyId, personName],
  );

  if (shares.length === 0) {
    return <p className="px-1 py-2 text-[13px] text-brand-text-muted">{labels.shareEmpty}</p>;
  }
  return (
    <div>
      {shares.map((share) => {
        const row = (byItemAllocations[share.lineKey] ?? []).find((r) => r.id === share.rowId);
        if (!row) return null;
        return (
          <div
            key={`${share.lineKey}-${share.rowId}`}
            className="border-b border-brand-border/70 px-1.5 py-2 last:border-0"
          >
            <StaffByItemShareIdentity share={share} locked={Boolean(row.paidLocked)} labels={labels} />
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  /**
   * Confirmed by-item ledger tickets only (already filtered — never whole-table).
   * Initial seed + locked merge; unlocked names are not continuously re-injected.
   */
  ledgerPeople?: readonly StaffByItemRailPerson[];
  /** Settled ticket keys (`splitPartyKey`) — chip ✓ and hide 收款. */
  settledTicketKeys: ReadonlySet<string>;
  /** Has collection history — rename/edit locked even if obligation rose again. */
  lockedTicketKeys?: ReadonlySet<string>;
  /**
   * Guest-submitted persons exist but draft allocations not ready yet.
   * Suppresses blank「客人 1」mint until hydrate lands (sole gate with resolveStaffByItemRailPeople).
   */
  awaitingRailHydrate?: boolean;
  itemCodeByMenuId?: Record<string, string>;
  /** Catalog photo urls keyed by menu_item.id — pool rows use MenuItemListThumb. */
  imageUrlByMenuId?: Record<string, string>;
  guestName: (n: number) => string;
  /** Bill-level % — chip / estimate show 折后; optional 折前 line. */
  discountRate?: number;
  /** Session bill total — payable basis for allocated 折后. */
  billTotalAmount?: number;
  discountPreLabel?: string;
  labels: StaffByItemWorkbenchLabels;
  disabled?: boolean;
  onAllocationChange: (next: Record<string, ByItemConsumerRow[]>) => void;
  onRenamePerson: (args: {
    oldName: string;
    newName: string;
    partyId?: string;
  }) => void;
  onCollectCurrent?: (args: { personName: string; partyId?: string }) => void;
  /** Individual checkout: send the current called ticket back to draft. */
  ticketUnlock?: StaffTicketUnlock;
  /** Sole staff delete memory — trash / empty-qty blur commit. */
  onRecordShareOmit?: (lineKey: string, ticketKey: string) => void;
  /** Clear omit when pool 1份 / 1/N份 re-adds that ticket×line. */
  onClearShareOmit?: (lineKey: string, ticketKey: string) => void;
};

/**
 * Sole staff checkout by-item layout: horizontal person rail (name + amount + ✓ settled)
 * + remaining pool + current share. Bill totals live only on sticky SettlementBar.
 * People: draft rail owns unpaid rename; next unpaid minted only after current is settled.
 * Qty truth: pool remaining and share editors share {@link parseConsumerRows} / buffet parsers.
 * The guest phone has its own single-ticket claim UI (GuestClaimPanel); do not render its dish cards here.
 */
export function StaffByItemSplitWorkbench({
  lang,
  lineSpecs,
  orderLines,
  byItemAllocations,
  ledgerPeople = [],
  settledTicketKeys,
  lockedTicketKeys = new Set(),
  awaitingRailHydrate = false,
  itemCodeByMenuId = {},
  imageUrlByMenuId = {},
  guestName,
  discountRate = 0,
  billTotalAmount,
  discountPreLabel,
  labels,
  disabled = false,
  onAllocationChange,
  onRenamePerson,
  onCollectCurrent,
  ticketUnlock,
  onRecordShareOmit,
  onClearShareOmit,
}: Props) {
  /** Pool line whose cut picker strip is open (only while the line is free). */
  const [unitPickLineKey, setUnitPickLineKey] = useState<string | null>(null);

  const peopleFromAlloc = useMemo(
    () => staffByItemPeopleFromAllocations(byItemAllocations),
    [byItemAllocations],
  );
  const lockedLedgerPeople = useMemo(
    () => staffByItemLockedLedgerPeople(ledgerPeople, lockedTicketKeys),
    [ledgerPeople, lockedTicketKeys],
  );
  /** Sole authoritative tickets — no blank mint while awaiting guest hydrate. */
  const authoritativePeople = useMemo(
    () =>
      resolveStaffByItemRailPeople({
        lockedLedgerPeople,
        allocationPeople: peopleFromAlloc,
        awaitingHydrate: awaitingRailHydrate,
      }),
    [awaitingRailHydrate, lockedLedgerPeople, peopleFromAlloc],
  );

  /** True after a genuine blank staff mint; false until then / after hydrate replace. */
  const blankMintRef = useRef(false);
  const [people, setPeople] = useState<StaffByItemRailPerson[]>(() => {
    if (authoritativePeople.length > 0) return authoritativePeople;
    if (awaitingRailHydrate) return [];
    blankMintRef.current = true;
    return [mintStaffByItemRailPerson(guestName(1))];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nameDraft, setNameDraft] = useState(() => people[0]?.name ?? '');
  const [needNameHint, setNeedNameHint] = useState(false);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  /** When true, stay on the chip the cashier clicked (incl. settled) — do not steal focus. */
  const userPickedChipRef = useRef(false);

  useEffect(() => {
    setPeople((prev) => {
      if (authoritativePeople.length > 0) {
        blankMintRef.current = false;
        return syncStaffByItemRailPeople(prev, authoritativePeople);
      }
      if (awaitingRailHydrate) return prev;
      if (prev.length > 0 || blankMintRef.current) return prev;
      blankMintRef.current = true;
      return [mintStaffByItemRailPerson(guestName(1))];
    });
  }, [authoritativePeople, awaitingRailHydrate, guestName]);

  const safeIndex = Math.min(currentIndex, Math.max(0, people.length - 1));
  const currentPerson = people[safeIndex] ?? { name: '' };
  const currentName = currentPerson.name;
  const currentPartyId = currentPerson.partyId;
  const currentKey = staffByItemRailPersonKey(currentPerson);
  const currentSettled = Boolean(currentKey && settledTicketKeys.has(currentKey));
  const currentLocked = Boolean(currentKey && lockedTicketKeys.has(currentKey));
  /** Share-panel unlock uses the same ticket key as unlockableKeys / onUnlock. */
  const currentUnlockKey = splitPartyKey(currentPartyId, currentName);
  const showUnlockTicket = Boolean(
    ticketUnlock &&
      !currentSettled &&
      ticketUnlock.unlockableKeys.has(currentUnlockKey),
  );
  const showCollectCurrent = Boolean(onCollectCurrent && !currentSettled);
  /** Rename locked when settled or has collection history; shares lock per paidLocked row. */
  const nameEditDisabled = disabled || currentSettled || currentLocked;
  const poolAddDisabled = disabled || currentSettled || currentLocked;

  useEffect(() => {
    setNameDraft(currentName);
    setNeedNameHint(false);
  }, [currentName, safeIndex]);

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [safeIndex, people.length]);

  const poolLines = useMemo(
    () =>
      staffByItemPoolLines({
        lineSpecs,
        orderLines,
        allocations: byItemAllocations,
        lang,
        itemCodeByMenuId,
      }),
    [byItemAllocations, itemCodeByMenuId, lang, lineSpecs, orderLines],
  );

  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );

  const visiblePool = poolLines.filter((line) => line.remainingPositive);

  /** Sole obligation source for chip amounts + current estimate / collect. */
  const splitResults = useMemo(() => {
    const allocations = buildByItemAllocationsFromRows(lineSpecs, byItemAllocations);
    const lines = orderLines.map((item) =>
      byItemSplitLineFromOrderLine(item, resolveMenuItemLocalizedName(item, lang)),
    );
    return calcByItemSplitResults({
      lines,
      allocations,
      personOrder: people.map((p) => p.name),
      personPartyIds: people.map((p) => p.partyId),
    });
  }, [lang, lineSpecs, byItemAllocations, orderLines, people]);

  /**
   * Serial collect handoff only when cashier did not pick a chip to inspect.
   * Clicking a settled guest must show that guest — not jump to the unpaid one.
   */
  useEffect(() => {
    if (userPickedChipRef.current) return;
    if (awaitingRailHydrate) return;
    if (!currentKey || !settledTicketKeys.has(currentKey)) return;

    const unpaidIdx = people.findIndex((person) => {
      const key = staffByItemRailPersonKey(person);
      return key && !settledTicketKeys.has(key);
    });
    if (unpaidIdx >= 0) {
      if (unpaidIdx !== safeIndex) setCurrentIndex(unpaidIdx);
      return;
    }
    if (visiblePool.length === 0) return;

    const next = mintStaffByItemRailPerson(guestName(people.length + 1));
    setPeople((prevPeople) => {
      const exists = prevPeople.some(
        (person) => staffByItemRailPersonKey(person) === staffByItemRailPersonKey(next),
      );
      return exists ? prevPeople : [...prevPeople, next];
    });
    setCurrentIndex(people.length);
    setNameDraft(next.name);
    setNeedNameHint(false);
  }, [
    awaitingRailHydrate,
    currentKey,
    guestName,
    settledTicketKeys,
    people,
    safeIndex,
    visiblePool.length,
  ]);

  const shares = useMemo(
    () =>
      staffByItemPersonShares({
        personName: currentName,
        partyId: currentPartyId,
        lineSpecs,
        orderLines,
        allocations: byItemAllocations,
        lang,
        itemCodeByMenuId,
      }),
    [
      byItemAllocations,
      currentName,
      currentPartyId,
      itemCodeByMenuId,
      lang,
      lineSpecs,
      orderLines,
    ],
  );

  const allocatedByTicketKey = useMemo(() => {
    const preAmounts = splitResults.map((row) => row.amount);
    const amounts = allocateDiscountedSplitObligations(preAmounts, discountRate, {
      billTotalAmount,
    });
    const map = new Map<string, number>();
    splitResults.forEach((row, index) => {
      const key = splitResultTicketKey(row);
      if (key) map.set(key, amounts[index] ?? 0);
    });
    return map;
  }, [billTotalAmount, discountRate, splitResults]);

  const estimate = useMemo(() => {
    const located = locateByItemSplitResult(splitResults, currentName, currentPartyId);
    const pre = located?.row.amount ?? 0;
    const key = splitResultTicketKey({
      name: currentName,
      ...(currentPartyId ? { party_id: currentPartyId } : {}),
    });
    const allocated = key ? allocatedByTicketKey.get(key) : undefined;
    const share = resolveCheckoutDiscountedShareDisplay(pre, discountRate, allocated);
    return { rows: shares.length, amount: share.displayAmount, preAmount: share.preAmount, showPre: share.showPreLine };
  }, [
    allocatedByTicketKey,
    currentName,
    currentPartyId,
    discountRate,
    shares.length,
    splitResults,
  ]);

  const personAmount = (person: StaffByItemRailPerson) =>
    locateByItemSplitResult(splitResults, person.name, person.partyId)?.row.amount ?? 0;

  const personShareDisplay = (person: StaffByItemRailPerson) => {
    const pre = personAmount(person);
    const key = staffByItemRailPersonKey(person);
    const allocated = key ? allocatedByTicketKey.get(key) : undefined;
    return resolveCheckoutDiscountedShareDisplay(pre, discountRate, allocated);
  };

  const commitName = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === currentName) {
      setNameDraft(currentName);
      return;
    }
    // Duplicate display names are allowed across tickets; only block empty.
    if (currentName.trim()) {
      onRenamePerson({
        oldName: currentName,
        newName: trimmed,
        partyId: currentPartyId,
      });
    }
    setPeople((prev) =>
      prev.map((person, idx) => {
        if (idx !== safeIndex) return person;
        if (person.partyId) return { name: trimmed, partyId: person.partyId };
        return mintStaffByItemRailPerson(trimmed);
      }),
    );
    setNameDraft(trimmed);
  };

  const ensureNamed = (): StaffByItemRailPerson | null => {
    const trimmed = nameDraft.trim() || currentName.trim();
    if (!trimmed) {
      setNeedNameHint(true);
      return null;
    }
    if (trimmed !== currentName) {
      commitName(trimmed);
    }
    setNeedNameHint(false);
    if (currentPartyId) return { name: trimmed, partyId: currentPartyId };
    const minted = mintStaffByItemRailPerson(trimmed);
    setPeople((prev) =>
      prev.map((person, idx) => (idx === safeIndex ? minted : person)),
    );
    return minted;
  };

  const applyAlloc = (next: Record<string, ByItemConsumerRow[]> | null) => {
    if (!next) return;
    onAllocationChange(next);
  };

  const clearOmitForPersonLine = (lineKey: string, person: StaffByItemRailPerson) => {
    const ticketKey = staffByItemRailPersonKey(person);
    if (!ticketKey || !onClearShareOmit) return;
    onClearShareOmit(lineKey, ticketKey);
  };

  const removeShareWithOmit = (params: {
    lineKey: string;
    rowId: string;
    buffet: boolean;
    ticketKey: string | null;
  }) => {
    // Omit first — same tick must not let mergeMissing resurrect before tombstone lands.
    if (params.ticketKey && onRecordShareOmit) {
      onRecordShareOmit(params.lineKey, params.ticketKey);
    }
    applyAlloc(
      removePersonShareOnLine({
        allocations: byItemAllocations,
        lineKey: params.lineKey,
        rowId: params.rowId,
        buffet: params.buffet,
      }),
    );
  };

  /** Pool-return (mirror of the pool buttons): a row left empty is removed and omitted. */
  const applyShareReturn = (
    lineKey: string,
    result: { allocations: Record<string, ByItemConsumerRow[]>; removed: boolean; ticketKey: string | null } | null,
  ) => {
    if (!result) return;
    if (result.removed && result.ticketKey && onRecordShareOmit) {
      onRecordShareOmit(lineKey, result.ticketKey);
    }
    applyAlloc(result.allocations);
  };

  const rowForShare = (share: (typeof shares)[number]): ByItemConsumerRow | null => {
    const rows = byItemAllocations[share.lineKey] ?? [];
    return rows.find((row) => row.id === share.rowId) ?? null;
  };

  return (
    <div className="space-y-3">
      <div
        className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5"
        role="list"
        aria-label={labels.currentShareTitle}
      >
        {people.map((person, idx) => {
          const key = staffByItemRailPersonKey(person);
          const settled = Boolean(key && settledTicketKeys.has(key));
          const active = idx === safeIndex;
          const share = personShareDisplay(person);
          const label = person.name || guestName(idx + 1);
          return (
            <button
              key={key || `${label}-${idx}`}
              ref={active ? activeChipRef : undefined}
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => {
                userPickedChipRef.current = true;
                setCurrentIndex(idx);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${buttonPressReliefCompactClass} ${
                active
                  ? 'border-brand-gold bg-brand-gold text-white'
                  : 'border-brand-border bg-brand-card text-brand-text hover:border-brand-gold/50'
              } ${settled ? 'opacity-80' : ''}`}
            >
              <span>{label}</span>
              <span className={`ml-1.5 tabular-nums ${active ? 'text-white/90' : 'text-brand-text-muted'}`}>
                €{share.displayAmount.toFixed(2)}
              </span>
              {share.showPreLine && discountPreLabel ? (
                <span
                  className={`ml-1 text-[10px] font-normal tabular-nums ${
                    active ? 'text-white/70' : 'text-brand-text-muted'
                  }`}
                >
                  ({discountPreLabel.replace('{amount}', share.preAmount.toFixed(2))})
                </span>
              ) : null}
              {settled ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-card">
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-brand-border px-3">
            <span className="text-[12px] font-semibold tracking-wide text-brand-text-muted">
              {labels.poolTitle}
            </span>
            {visiblePool.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={poolAddDisabled}
                className="h-8 shrink-0 gap-1.5 border-brand-ink/45 bg-brand-bg px-2.5 py-0 text-[12px] text-brand-ink hover:bg-brand-ink/5"
                onClick={() => {
                  const person = ensureNamed();
                  if (!person) return;
                  for (const line of visiblePool) {
                    clearOmitForPersonLine(line.key, person);
                  }
                  applyAlloc(
                    assignAllRemainingPoolToPerson({
                      allocations: byItemAllocations,
                      lineSpecs,
                      personName: person.name,
                      partyId: person.partyId,
                    }),
                  );
                }}
              >
                <span aria-hidden className="font-semibold tracking-tight">
                  {'>>'}
                </span>
                {labels.assignAll}
              </Button>
            ) : null}
          </header>
          <div className="flex-1 space-y-2 p-2.5">
            {visiblePool.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-brand-text-muted">{labels.poolEmpty}</p>
            ) : (
              visiblePool.map((line) => {
                const catalog = orderLineByKey[line.key];
                const pickingUnit = unitPickLineKey === line.key;
                /** Take one share from the pool for the current person (menu / buffet alike). */
                const give = (
                  write: (person: StaffByItemRailPerson) => Record<string, ByItemConsumerRow[]> | null,
                ) => {
                  const person = ensureNamed();
                  if (!person) return;
                  clearOmitForPersonLine(line.key, person);
                  applyAlloc(write(person));
                  setUnitPickLineKey(null);
                };
                return (
                <div
                  key={line.key}
                  className="rounded-lg border border-brand-border px-2.5 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
                    <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                      <MenuItemListThumb
                        item={{
                          image_url: catalog ? imageUrlByMenuId[catalog.id] ?? null : null,
                          emoji: catalog?.emoji ?? '',
                        }}
                      />
                      <StaffByItemPoolLineIdentity
                        label={line.label}
                        unitPriceLabel={line.unitPriceLabel}
                        remainingText={`${labels.remainingPrefix} ${line.remainingLabel}${
                          line.fractionUnit != null
                            ? ` · ${labels.unitLocked(line.fractionUnit)}`
                            : ''
                        }`}
                      />
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2.5">
                      {line.mode === 'menu' ? (
                        <>
                          <StaffByItemPoolActionButton
                            variant="primary"
                            disabled={poolAddDisabled || !line.canAddWhole}
                            onClick={() =>
                              give((person) =>
                                addWholeShareToPerson({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: line.key,
                                  personName: person.name,
                                  partyId: person.partyId,
                                }),
                              )
                            }
                          >
                            {labels.poolAddWhole}
                          </StaffByItemPoolActionButton>
                          <StaffByItemPoolActionButton
                            variant="ghost"
                            expanded={line.fractionUnit == null ? pickingUnit : undefined}
                            disabled={poolAddDisabled || line.fractionUnitChoices.length === 0}
                            onClick={() => {
                              if (line.fractionUnit == null) {
                                setUnitPickLineKey(pickingUnit ? null : line.key);
                                return;
                              }
                              give((person) =>
                                addMenuFractionShareToPerson({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: line.key,
                                  personName: person.name,
                                  partyId: person.partyId,
                                  unitDen: line.fractionUnit!,
                                }),
                              );
                            }}
                          >
                            {labels.poolAddFraction(line.fractionUnit ?? 2)}
                          </StaffByItemPoolActionButton>
                        </>
                      ) : (
                        <>
                          <StaffByItemPoolActionButton
                            variant="primary"
                            disabled={poolAddDisabled || !line.canAddAdult}
                            onClick={() =>
                              give((person) =>
                                addBuffetSeatToPerson({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: line.key,
                                  personName: person.name,
                                  partyId: person.partyId,
                                  guestType: 'adult',
                                }),
                              )
                            }
                          >
                            {labels.poolAddAdult}
                          </StaffByItemPoolActionButton>
                          <StaffByItemPoolActionButton
                            variant="ghost"
                            disabled={poolAddDisabled || !line.canAddChild}
                            onClick={() =>
                              give((person) =>
                                addBuffetSeatToPerson({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: line.key,
                                  personName: person.name,
                                  partyId: person.partyId,
                                  guestType: 'child',
                                }),
                              )
                            }
                          >
                            {labels.poolAddChild}
                          </StaffByItemPoolActionButton>
                        </>
                      )}
                    </div>
                  </div>
                  {pickingUnit && line.fractionUnit == null ? (
                    <div
                      className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-dashed border-brand-border pt-2"
                      data-staff-by-item-unit-strip={line.key}
                    >
                      <span className="text-[12px] text-brand-text-muted">{labels.poolPickUnit}</span>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        {line.fractionUnitChoices.map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            className={`h-8 min-w-12 rounded-full border border-brand-border bg-brand-card px-3 text-sm font-semibold text-brand-text hover:border-brand-gold/60 ${buttonPressReliefCompactClass}`}
                            onClick={() =>
                              give((person) =>
                                addMenuFractionShareToPerson({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: line.key,
                                  personName: person.name,
                                  partyId: person.partyId,
                                  unitDen: unit,
                                }),
                              )
                            }
                          >
                            1/{unit}
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label={labels.poolCancelPick}
                          className={`h-8 w-8 rounded-full border border-brand-border text-brand-text-muted ${buttonPressReliefCompactClass}`}
                          onClick={() => setUnitPickLineKey(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                );
              })
            )}
          </div>
        </section>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-card">
          <header className="flex h-12 shrink-0 items-center border-b border-brand-border px-3">
            <span className="text-[12px] font-semibold tracking-wide text-brand-text-muted">
              {labels.currentShareTitle}
            </span>
          </header>
          <div className="flex-1 space-y-2 p-2.5">
            <input
              type="text"
              value={nameDraft}
              disabled={nameEditDisabled}
              aria-label={labels.markerPlaceholder}
              placeholder={labels.markerPlaceholder}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => commitName(nameDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName(nameDraft);
                }
              }}
              className="w-full rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-sm text-brand-text outline-none focus:border-brand-gold"
            />
            {needNameHint ? (
              <p className="text-[11px] text-red-500">{labels.needName}</p>
            ) : null}

            {shares.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-brand-text-muted">{labels.shareEmpty}</p>
            ) : (
              <>
                {shares.map((share) => {
                  const row = rowForShare(share);
                  if (!row) return null;
                  const shareLocked = Boolean(row.paidLocked);
                  const shareDisabled = disabled || shareLocked;
                  return (
                    <div
                      key={`${share.lineKey}-${share.rowId}`}
                      className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-2 rounded-lg border-b border-brand-border/70 px-1.5 py-2 last:border-0 ${
                        shareLocked ? 'bg-brand-bg/80 opacity-80' : ''
                      }`}
                    >
                      <div className="min-w-[9rem] flex-1">
                        <StaffByItemShareIdentity
                          share={share}
                          locked={shareLocked}
                          labels={labels}
                        />
                      </div>
                      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2.5">
                        {share.mode === 'menu' ? (
                          <>
                            <StaffByItemPoolActionButton
                              variant="primary"
                              direction="out"
                              disabled={shareDisabled || !share.canReturnWhole}
                              onClick={() =>
                                applyShareReturn(
                                  share.lineKey,
                                  returnMenuShareToPool({
                                    allocations: byItemAllocations,
                                    lineSpecs,
                                    lineKey: share.lineKey,
                                    rowId: share.rowId,
                                    kind: 'whole',
                                  }),
                                )
                              }
                            >
                              {labels.poolAddWhole}
                            </StaffByItemPoolActionButton>
                            <StaffByItemPoolActionButton
                              variant="ghost"
                              direction="out"
                              disabled={shareDisabled || !share.canReturnFraction}
                              onClick={() =>
                                applyShareReturn(
                                  share.lineKey,
                                  returnMenuShareToPool({
                                    allocations: byItemAllocations,
                                    lineSpecs,
                                    lineKey: share.lineKey,
                                    rowId: share.rowId,
                                    kind: 'fraction',
                                  }),
                                )
                              }
                            >
                              {labels.poolAddFraction(share.fractionUnit ?? 2)}
                            </StaffByItemPoolActionButton>
                          </>
                        ) : (
                          <>
                            <StaffByItemPoolActionButton
                              variant="primary"
                              direction="out"
                              disabled={shareDisabled || !share.canReturnAdult}
                              onClick={() =>
                                applyShareReturn(
                                  share.lineKey,
                                  returnBuffetSeatToPool({
                                    allocations: byItemAllocations,
                                    lineSpecs,
                                    lineKey: share.lineKey,
                                    rowId: share.rowId,
                                    guestType: 'adult',
                                  }),
                                )
                              }
                            >
                              {labels.poolAddAdult}
                            </StaffByItemPoolActionButton>
                            <StaffByItemPoolActionButton
                              variant="ghost"
                              direction="out"
                              disabled={shareDisabled || !share.canReturnChild}
                              onClick={() =>
                                applyShareReturn(
                                  share.lineKey,
                                  returnBuffetSeatToPool({
                                    allocations: byItemAllocations,
                                    lineSpecs,
                                    lineKey: share.lineKey,
                                    rowId: share.rowId,
                                    guestType: 'child',
                                  }),
                                )
                              }
                            >
                              {labels.poolAddChild}
                            </StaffByItemPoolActionButton>
                          </>
                        )}
                        <RowRemoveIconButton
                          large
                          removable={!shareDisabled}
                          ariaLabel={labels.remove}
                          onRemove={() => {
                            removeShareWithOmit({
                              lineKey: share.lineKey,
                              rowId: share.rowId,
                              buffet: share.mode === 'buffet',
                              ticketKey: splitPartyKey(row.partyId, row.name),
                            });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
                  <div className="flex min-w-min flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm text-brand-text-muted">
                      {labels.estimateMeta(estimate.rows)}
                    </p>
                    <p className={CHECKOUT_ACTION_AMOUNT_CLASS}>
                      €{estimate.amount.toFixed(2)}
                    </p>
                    {estimate.showPre && discountPreLabel ? (
                      <p className="text-[12px] text-brand-text-muted tabular-nums">
                        {discountPreLabel.replace('{amount}', estimate.preAmount.toFixed(2))}
                      </p>
                    ) : null}
                  </div>
                  {showUnlockTicket || showCollectCurrent ? (
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      {showUnlockTicket && ticketUnlock ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            disabled || ticketUnlock.unlockingKeys.has(currentUnlockKey)
                          }
                          onClick={() => ticketUnlock.onUnlock(currentUnlockKey)}
                        >
                          {ticketUnlock.unlockingKeys.has(currentUnlockKey)
                            ? ticketUnlock.busyLabel
                            : ticketUnlock.label}
                        </Button>
                      ) : null}
                      {showCollectCurrent && onCollectCurrent ? (
                        <Button
                          type="button"
                          size="action"
                          disabled={disabled || estimate.amount <= 0 || !currentName.trim()}
                          onClick={() => {
                            userPickedChipRef.current = false;
                            onCollectCurrent({
                              personName: currentName,
                              partyId: currentPartyId,
                            });
                          }}
                          className={CHECKOUT_COLLECT_BUTTON_CLASS}
                        >
                          {labels.collect}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
