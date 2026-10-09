'use client';

import type { StaffTicketUnlock } from '@/components/dashboard/checkout/staff-ticket-unlock';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildByItemAllocationsFromRows,
  calcByItemSplitResults,
  isRowQtyOverAllocated,
  locateByItemSplitResult,
  parseConsumerRowQty,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { byItemSplitLineFromOrderLine } from '@/lib/bill-split-by-item-lines';
import type { UILanguage } from '@/lib/i18n';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { ByItemQtyInput } from '@/components/menu/ByItemQtyInput';
import { RowRemoveIconButton } from '@/components/menu/RowRemoveIconButton';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import type { QtyPartsLabels } from '@/lib/bill-split-by-item';
import { Button } from '@/components/ui/Button';
import {
  CHECKOUT_ACTION_AMOUNT_CLASS,
  CHECKOUT_COLLECT_BUTTON_CLASS,
} from '@/lib/checkout-amount-type';
import {
  allocateDiscountedSplitObligations,
  resolveCheckoutDiscountedShareDisplay,
} from '@/lib/checkout-split-math';
import { splitPartyKey, splitResultTicketKey } from '@/lib/split-party-id';
import {
  addBuffetSeatToPerson,
  addMenuFractionShareToPerson,
  addWholeShareToPerson,
  applyStaffMenuQtyHoldToAllocations,
  assignAllRemainingPoolToPerson,
  byItemMenuQtyDenReadOnly,
  commitStaffMenuShareQtyEdit,
  removePersonShareOnLine,
  setPersonBuffetShareCounts,
  setPersonMenuShareQtyFields,
  staffByItemBuffetShareLineMetaParts,
  staffByItemPeopleFromAllocations,
  staffByItemPersonShares,
  staffByItemPoolLines,
  staffByItemShareLineMetaParts,
  type StaffMenuQtyHold,
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
  addAdult: string;
  addChild: string;
  remove: string;
  collect: string;
  paidShareBadge: string;
  qtyParts: QtyPartsLabels;
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
 * - menu: `qty × unit = amount` via {@link staffByItemShareLineMetaParts}
 * - buffet: amount only (unit already on {@link StaffByItemNameUnitRow}, same as pool)
 */
function StaffByItemShareLineMeta({
  mode,
  qtyLabel,
  unitPriceLabel,
  amount,
  amountReady,
}: {
  mode: 'menu' | 'buffet';
  qtyLabel: string;
  unitPriceLabel: string;
  amount: number;
  /** Buffet: headcount assigned. Menu: ignored (derived from qtyLabel). */
  amountReady: boolean;
}) {
  if (mode === 'buffet') {
    const { amountText, amountReady: ready } = staffByItemBuffetShareLineMetaParts({
      amount,
      amountReady,
    });
    return (
      <div
        className={`mt-0.5 inline-block min-w-[4.5ch] text-sm tabular-nums ${
          ready ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
        }`}
      >
        {amountText}
      </div>
    );
  }

  const { factorText, amountText, amountReady: ready } = staffByItemShareLineMetaParts({
    qtyLabel,
    unitPriceLabel,
    amount,
  });
  return (
    <div className="mt-1 flex flex-nowrap items-baseline gap-x-1.5 text-sm">
      <span className="tabular-nums text-brand-text-muted">{factorText}</span>
      <span className="text-brand-border" aria-hidden>
        =
      </span>
      <span
        className={`inline-block min-w-[4.5ch] tabular-nums ${
          ready ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
        }`}
      >
        {amountText}
      </span>
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
  /** Clear omit when pool + / 1/N re-adds that ticket×line. */
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
  /** Last-committed menu qty per row — pool/meta hold while draft digits are mid-edit. */
  const [menuQtyHoldByRowId, setMenuQtyHoldByRowId] = useState<
    Map<string, StaffMenuQtyHold>
  >(() => new Map());
  const allocationsRef = useRef(byItemAllocations);
  allocationsRef.current = byItemAllocations;

  useEffect(() => {
    setMenuQtyHoldByRowId((prev) => {
      const liveIds = new Set<string>();
      let changed = false;
      const next = new Map(prev);
      for (const rows of Object.values(byItemAllocations)) {
        for (const row of rows) {
          liveIds.add(row.id);
          if (!row.name.trim() || row.paidLocked) continue;
          if (!parseConsumerRowQty(row)) continue;
          const hold: StaffMenuQtyHold = {
            qtyWhole: row.qtyWhole,
            qtyNum: row.qtyNum,
            qtyDen: row.qtyDen,
          };
          const prior = next.get(row.id);
          if (
            prior &&
            prior.qtyWhole === hold.qtyWhole &&
            prior.qtyNum === hold.qtyNum &&
            prior.qtyDen === hold.qtyDen
          ) {
            continue;
          }
          next.set(row.id, hold);
          changed = true;
        }
      }
      for (const id of Array.from(next.keys())) {
        if (liveIds.has(id)) continue;
        next.delete(id);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [byItemAllocations]);

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
  /** Footer actions use the same ticket key as unlockableKeys / onUnlock. */
  const currentUnlockKey = splitPartyKey(currentPartyId, currentName);
  const showResumeOrdering = Boolean(
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
        menuQtyHoldByRowId,
      }),
    [
      byItemAllocations,
      itemCodeByMenuId,
      lang,
      lineSpecs,
      menuQtyHoldByRowId,
      orderLines,
    ],
  );

  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );

  const visiblePool = poolLines.filter((line) => line.remainingPositive);

  /** Hold-aware rows for chip/estimate money while inputs bind draft qty. */
  const moneyAllocations = useMemo(
    () => applyStaffMenuQtyHoldToAllocations(byItemAllocations, menuQtyHoldByRowId),
    [byItemAllocations, menuQtyHoldByRowId],
  );

  /** Sole obligation source for chip amounts + current estimate / collect. */
  const splitResults = useMemo(() => {
    const allocations = buildByItemAllocationsFromRows(lineSpecs, moneyAllocations);
    const lines = orderLines.map((item) =>
      byItemSplitLineFromOrderLine(item, resolveMenuItemLocalizedName(item, lang)),
    );
    return calcByItemSplitResults({
      lines,
      allocations,
      personOrder: people.map((p) => p.name),
      personPartyIds: people.map((p) => p.partyId),
    });
  }, [lang, lineSpecs, moneyAllocations, orderLines, people]);

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
        menuQtyHoldByRowId,
      }),
    [
      byItemAllocations,
      currentName,
      currentPartyId,
      itemCodeByMenuId,
      lang,
      lineSpecs,
      menuQtyHoldByRowId,
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
    setMenuQtyHoldByRowId((prev) => {
      if (!prev.has(params.rowId)) return prev;
      const next = new Map(prev);
      next.delete(params.rowId);
      return next;
    });
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
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
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
                      menuQtyHoldByRowId,
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
                return (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-brand-border px-2.5 py-2"
                >
                  <MenuItemListThumb
                    item={{
                      image_url: catalog ? imageUrlByMenuId[catalog.id] ?? null : null,
                      emoji: catalog?.emoji ?? '',
                    }}
                  />
                  <StaffByItemPoolLineIdentity
                    label={line.label}
                    unitPriceLabel={line.unitPriceLabel}
                    remainingText={`${labels.remainingPrefix} ${line.remainingLabel}`}
                  />
                  <div className="flex shrink-0 gap-1">
                    {line.mode === 'menu' ? (
                      <>
                        <button
                          type="button"
                          disabled={poolAddDisabled || !line.canAddFraction}
                          className="h-7 min-w-7 rounded-lg border border-brand-border px-1 text-xs font-bold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            clearOmitForPersonLine(line.key, person);
                            applyAlloc(
                              addMenuFractionShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person.name,
                                partyId: person.partyId,
                                denominator: line.fractionDenominator,
                                menuQtyHoldByRowId,
                              }),
                            );
                          }}
                        >
                          {`1/${line.fractionDenominator}`}
                        </button>
                        <button
                          type="button"
                          disabled={poolAddDisabled || !line.canAddWhole}
                          className="h-7 w-7 rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-sm font-bold text-brand-gold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            clearOmitForPersonLine(line.key, person);
                            applyAlloc(
                              addWholeShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person.name,
                                partyId: person.partyId,
                                menuQtyHoldByRowId,
                              }),
                            );
                          }}
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={poolAddDisabled || !line.canAddAdult}
                          className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            clearOmitForPersonLine(line.key, person);
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person.name,
                                partyId: person.partyId,
                                guestType: 'adult',
                              }),
                            );
                          }}
                        >
                          {labels.addAdult}
                        </button>
                        <button
                          type="button"
                          disabled={poolAddDisabled || !line.canAddChild}
                          className="rounded-lg border border-brand-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            clearOmitForPersonLine(line.key, person);
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person.name,
                                partyId: person.partyId,
                                guestType: 'child',
                              }),
                            );
                          }}
                        >
                          {labels.addChild}
                        </button>
                      </>
                    )}
                  </div>
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
                  const menuSpec = lineSpecs.find((line) => line.key === share.lineKey);
                  const over =
                    share.mode === 'menu'
                    && menuSpec?.mode === 'menu'
                    && isRowQtyOverAllocated(
                      row,
                      byItemAllocations[share.lineKey] ?? [],
                      menuSpec.lineQty,
                    );
                  return (
                    <div
                      key={`${share.lineKey}-${share.rowId}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border-b border-brand-border/70 px-1.5 py-2 last:border-0 ${
                        shareLocked ? 'bg-brand-bg/80 opacity-80' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {share.mode === 'buffet' ? (
                          <StaffByItemNameUnitRow
                            label={share.label}
                            unitPriceLabel={share.unitPriceLabel}
                            lockedBadge={shareLocked ? labels.paidShareBadge : undefined}
                          />
                        ) : (
                          <div
                            className="truncate text-sm text-brand-text"
                            title={share.label}
                          >
                            {share.label}
                            {shareLocked ? (
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
                          amountReady={
                            share.mode === 'buffet'
                              ? Boolean(
                                  (row.adultQty ?? '').trim() || (row.childQty ?? '').trim(),
                                )
                              : share.qtyLabel !== '—'
                          }
                        />
                      </div>
                      <div className="flex shrink-0 flex-nowrap items-center gap-1">
                        {share.mode === 'menu' ? (
                          <ByItemQtyInput
                            row={row}
                            labels={labels.qtyParts}
                            overAllocated={over}
                            disabled={shareDisabled}
                            denDisabled={byItemMenuQtyDenReadOnly(
                              byItemAllocations[share.lineKey] ?? [],
                            )}
                            onChange={(patch) => {
                              applyAlloc(
                                setPersonMenuShareQtyFields({
                                  allocations: byItemAllocations,
                                  lineSpecs,
                                  lineKey: share.lineKey,
                                  rowId: share.rowId,
                                  patch,
                                }),
                              );
                            }}
                            onCommit={() => {
                              const committed = commitStaffMenuShareQtyEdit({
                                allocations: allocationsRef.current,
                                lineSpecs,
                                lineKey: share.lineKey,
                                rowId: share.rowId,
                              });
                              if (!committed) return;
                              if (committed.removed) {
                                if (committed.ticketKey && onRecordShareOmit) {
                                  onRecordShareOmit(share.lineKey, committed.ticketKey);
                                }
                                applyAlloc(committed.allocations);
                                setMenuQtyHoldByRowId((prev) => {
                                  if (!prev.has(share.rowId)) return prev;
                                  const next = new Map(prev);
                                  next.delete(share.rowId);
                                  return next;
                                });
                                return;
                              }
                              if (committed.hold) {
                                setMenuQtyHoldByRowId((prev) => {
                                  const prior = prev.get(share.rowId);
                                  if (
                                    prior &&
                                    prior.qtyWhole === committed.hold!.qtyWhole &&
                                    prior.qtyNum === committed.hold!.qtyNum &&
                                    prior.qtyDen === committed.hold!.qtyDen
                                  ) {
                                    return prev;
                                  }
                                  const next = new Map(prev);
                                  next.set(share.rowId, committed.hold!);
                                  return next;
                                });
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-nowrap items-center gap-1 text-[12px]">
                            <label className="flex flex-nowrap items-center gap-0.5">
                              <span className="shrink-0 text-brand-text-muted">
                                {labels.addAdult}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={shareDisabled}
                                value={row.adultQty ?? ''}
                                onChange={(e) => {
                                  applyAlloc(
                                    setPersonBuffetShareCounts({
                                      allocations: byItemAllocations,
                                      lineSpecs,
                                      lineKey: share.lineKey,
                                      rowId: share.rowId,
                                      adultQty: e.target.value.replace(/\D/g, '').slice(0, 3),
                                      childQty: row.childQty ?? '',
                                    }),
                                  );
                                }}
                                className="w-8 rounded border border-brand-border px-1 py-0.5 text-center"
                              />
                            </label>
                            <label className="flex flex-nowrap items-center gap-0.5">
                              <span className="shrink-0 text-brand-text-muted">
                                {labels.addChild}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={shareDisabled}
                                value={row.childQty ?? ''}
                                onChange={(e) => {
                                  applyAlloc(
                                    setPersonBuffetShareCounts({
                                      allocations: byItemAllocations,
                                      lineSpecs,
                                      lineKey: share.lineKey,
                                      rowId: share.rowId,
                                      adultQty: row.adultQty ?? '',
                                      childQty: e.target.value.replace(/\D/g, '').slice(0, 3),
                                    }),
                                  );
                                }}
                                className="w-8 rounded border border-brand-border px-1 py-0.5 text-center"
                              />
                            </label>
                          </div>
                        )}
                        <RowRemoveIconButton
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
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
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
                  {showResumeOrdering || showCollectCurrent ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {showResumeOrdering && ticketUnlock ? (
                        <button
                          type="button"
                          disabled={
                            disabled || ticketUnlock.unlockingKeys.has(currentUnlockKey)
                          }
                          onClick={() => ticketUnlock.onUnlock(currentUnlockKey)}
                          className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50"
                        >
                          {ticketUnlock.unlockingKeys.has(currentUnlockKey)
                            ? ticketUnlock.busyLabel
                            : ticketUnlock.label}
                        </button>
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
