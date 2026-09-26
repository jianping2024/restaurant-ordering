'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  buildByItemAllocationsFromRows,
  calcByItemSplitResults,
  locateByItemSplitResult,
} from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { byItemSplitLineFromOrderLine } from '@/lib/bill-split-by-item-lines';
import type { UILanguage } from '@/lib/i18n';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { splitPersonKey } from '@/lib/split-person-identity';
import { ByItemQtyInput } from '@/components/menu/ByItemQtyInput';
import { ByItemConsumerRowRemoveButton } from '@/components/menu/ByItemConsumerRowRemoveButton';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import type { QtyPartsLabels } from '@/lib/bill-split-by-item';
import {
  addBuffetSeatToPerson,
  addMenuFractionShareToPerson,
  addWholeShareToPerson,
  canAddMenuFractionShare,
  menuFractionDenominatorForPerson,
  isStaffMenuShareOverAllocated,
  removePersonShareOnLine,
  setPersonBuffetShareCounts,
  setPersonMenuShareQtyFields,
  staffByItemPeopleFromAllocations,
  staffByItemPersonShares,
  staffByItemPoolLines,
  staffByItemShareLineMetaParts,
} from '@/lib/staff-by-item-workbench';
import {
  appendStaffByItemRailPeople,
  staffByItemLockedLedgerNames,
  staffByItemRailSeedNames,
} from '@/lib/staff-by-item-people';

export type StaffByItemWorkbenchLabels = {
  poolTitle: string;
  currentShareTitle: string;
  markerName: string;
  markerHint: string;
  markerPlaceholder: string;
  remainingPrefix: string;
  shareEmpty: string;
  estimate: (n: number, amount: string) => string;
  needName: string;
  poolEmpty: string;
  addAdult: string;
  addChild: string;
  remove: string;
  collect: string;
  paidLocked: string;
  paidShareBadge: string;
  qtyParts: QtyPartsLabels;
};

/** Sole pool-row meta: remaining qty · unit price (not a payable equation). */
function StaffByItemPoolLineMeta({
  remainingText,
  unitPriceLabel,
}: {
  remainingText: string;
  unitPriceLabel: string;
}) {
  return (
    <div className="mt-0.5 text-sm text-brand-text-muted">
      <span className="tabular-nums">{remainingText}</span>
      <span className="mx-1 text-brand-border">·</span>
      <span className="font-medium tabular-nums text-brand-gold">{unitPriceLabel}</span>
    </div>
  );
}

/**
 * Sole share-row meta: muted qty × unit + gold line total (`staffByItemShareLineMetaParts`).
 * Do not reuse pool `·` here; do not invent a second amount beside share.amount.
 */
function StaffByItemShareLineMeta({
  qtyLabel,
  unitPriceLabel,
  amount,
}: {
  qtyLabel: string;
  unitPriceLabel: string;
  amount: number;
}) {
  const { factorText, amountText } = staffByItemShareLineMetaParts({
    qtyLabel,
    unitPriceLabel,
    amount,
  });
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm">
      <span className="tabular-nums text-brand-text-muted">{factorText}</span>
      {amountText ? (
        <>
          <span className="text-brand-border" aria-hidden>
            =
          </span>
          <span className="font-semibold tabular-nums text-brand-gold">{amountText}</span>
        </>
      ) : null}
    </div>
  );
}

type Props = {
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  /**
   * Confirmed by-item ledger names only (already filtered — never whole-table).
   * Initial seed + locked merge; unlocked names are not continuously re-injected.
   */
  ledgerPersonNames?: readonly string[];
  /** Settled only (ledger covers obligation) — chip ✓ and hide 收款. */
  settledPersonNames: ReadonlySet<string>;
  /** Has collection history — rename/edit locked even if obligation rose again. */
  lockedPersonNames?: ReadonlySet<string>;
  itemCodeByMenuId?: Record<string, string>;
  /** Catalog photo urls keyed by menu_item.id — pool rows use MenuItemListThumb. */
  imageUrlByMenuId?: Record<string, string>;
  guestName: (n: number) => string;
  labels: StaffByItemWorkbenchLabels;
  disabled?: boolean;
  onAllocationChange: (next: Record<string, ByItemConsumerRow[]>) => void;
  onRenamePerson: (oldName: string, newName: string) => void;
  onCollectCurrent?: (personName: string) => void;
};

/**
 * Sole staff checkout by-item layout: horizontal person rail (name + amount + ✓ settled)
 * + remaining pool + current share. Bill totals live only on sticky SettlementBar.
 * People: draft rail owns unpaid rename; next unpaid minted only after current is settled.
 * Qty truth: pool remaining and share editors share {@link parseConsumerRows} / buffet parsers.
 * Guest phone keeps ByItemSplitSection; do not render dish cards here.
 */
export function StaffByItemSplitWorkbench({
  lang,
  lineSpecs,
  orderLines,
  byItemAllocations,
  ledgerPersonNames = [],
  settledPersonNames,
  lockedPersonNames = new Set(),
  itemCodeByMenuId = {},
  imageUrlByMenuId = {},
  guestName,
  labels,
  disabled = false,
  onAllocationChange,
  onRenamePerson,
  onCollectCurrent,
}: Props) {
  const peopleFromAlloc = useMemo(
    () => staffByItemPeopleFromAllocations(byItemAllocations),
    [byItemAllocations],
  );

  const seedPeople = useMemo(() => {
    const seeded = staffByItemRailSeedNames({
      ledgerNames: ledgerPersonNames,
      allocationNames: peopleFromAlloc,
    });
    return seeded.length > 0 ? seeded : [guestName(1)];
  }, [guestName, ledgerPersonNames, peopleFromAlloc]);

  const mergeIncoming = useMemo(() => {
    const lockedLedger = staffByItemLockedLedgerNames(
      ledgerPersonNames,
      lockedPersonNames,
    );
    return [...lockedLedger, ...peopleFromAlloc];
  }, [ledgerPersonNames, lockedPersonNames, peopleFromAlloc]);

  const [people, setPeople] = useState<string[]>(seedPeople);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nameDraft, setNameDraft] = useState(() => seedPeople[0] ?? guestName(1));
  const [needNameHint, setNeedNameHint] = useState(false);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  /** When true, stay on the chip the cashier clicked (incl. settled) — do not steal focus. */
  const userPickedChipRef = useRef(false);

  useEffect(() => {
    setPeople((prev) => appendStaffByItemRailPeople(prev, mergeIncoming));
  }, [mergeIncoming]);

  const safeIndex = Math.min(currentIndex, Math.max(0, people.length - 1));
  const currentName = people[safeIndex] ?? '';
  const currentKey = splitPersonKey(currentName);
  const currentSettled = Boolean(currentKey && settledPersonNames.has(currentKey));
  const currentLocked = Boolean(currentKey && lockedPersonNames.has(currentKey));
  /** Rename locked when settled or has collection history; shares lock per paidLocked row. */
  const nameEditDisabled = disabled || currentSettled || currentLocked;
  const poolAddDisabled = disabled;

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
      personOrder: people,
    });
  }, [byItemAllocations, lang, lineSpecs, orderLines, people]);

  /**
   * Serial collect handoff only when cashier did not pick a chip to inspect.
   * Clicking a settled guest must show that guest — not jump to the unpaid one.
   */
  useEffect(() => {
    if (userPickedChipRef.current) return;
    if (!currentKey || !settledPersonNames.has(currentKey)) return;

    const unpaidIdx = people.findIndex((person) => {
      const key = splitPersonKey(person);
      return key && !settledPersonNames.has(key);
    });
    if (unpaidIdx >= 0) {
      if (unpaidIdx !== safeIndex) setCurrentIndex(unpaidIdx);
      return;
    }
    if (visiblePool.length === 0) return;

    const nextName = guestName(people.length + 1);
    setPeople((prevPeople) => {
      const exists = prevPeople.some(
        (name) => splitPersonKey(name) === splitPersonKey(nextName),
      );
      return exists ? prevPeople : [...prevPeople, nextName];
    });
    setCurrentIndex(people.length);
    setNameDraft(nextName);
    setNeedNameHint(false);
  }, [currentKey, guestName, settledPersonNames, people, safeIndex, visiblePool.length]);

  const shares = useMemo(
    () =>
      staffByItemPersonShares({
        personName: currentName,
        lineSpecs,
        orderLines,
        allocations: byItemAllocations,
        lang,
        itemCodeByMenuId,
      }),
    [byItemAllocations, currentName, itemCodeByMenuId, lang, lineSpecs, orderLines],
  );

  const estimate = useMemo(() => {
    const located = locateByItemSplitResult(splitResults, currentName);
    return { rows: shares.length, amount: located?.row.amount ?? 0 };
  }, [currentName, shares.length, splitResults]);

  const commitName = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === currentName) {
      setNameDraft(currentName);
      return;
    }
    const dup = people.some(
      (name, idx) => idx !== safeIndex && splitPersonKey(name) === splitPersonKey(trimmed),
    );
    if (dup) {
      setNameDraft(currentName);
      return;
    }
    if (currentName.trim()) {
      onRenamePerson(currentName, trimmed);
    }
    setPeople((prev) => prev.map((name, idx) => (idx === safeIndex ? trimmed : name)));
    setNameDraft(trimmed);
  };

  const ensureNamed = (): string | null => {
    const trimmed = nameDraft.trim() || currentName.trim();
    if (!trimmed) {
      setNeedNameHint(true);
      return null;
    }
    if (trimmed !== currentName) {
      commitName(trimmed);
    }
    setNeedNameHint(false);
    return trimmed;
  };

  const applyAlloc = (next: Record<string, ByItemConsumerRow[]> | null) => {
    if (!next) return;
    onAllocationChange(next);
  };

  const rowForShare = (share: (typeof shares)[number]): ByItemConsumerRow | null => {
    const rows = byItemAllocations[share.lineKey] ?? [];
    return rows.find((row) => row.id === share.rowId) ?? null;
  };

  const personAmount = (name: string) =>
    locateByItemSplitResult(splitResults, name)?.row.amount ?? 0;

  return (
    <div className="space-y-3">
      <div
        className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5"
        role="list"
        aria-label={labels.currentShareTitle}
      >
        {people.map((name, idx) => {
          const settled = settledPersonNames.has(splitPersonKey(name));
          const active = idx === safeIndex;
          const amount = personAmount(name);
          const label = name || guestName(idx + 1);
          return (
            <button
              key={`${splitPersonKey(name) || name}-${idx}`}
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
                €{amount.toFixed(2)}
              </span>
              {settled ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-brand-border bg-brand-card">
          <header className="border-b border-brand-border px-3 py-2 text-[12px] font-semibold tracking-wide text-brand-text-muted">
            {labels.poolTitle}
          </header>
          <div className="space-y-2 p-2.5">
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
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-semibold text-brand-text"
                      title={line.label}
                    >
                      {line.label}
                    </div>
                    <StaffByItemPoolLineMeta
                      remainingText={`${labels.remainingPrefix} ${line.remainingLabel}`}
                      unitPriceLabel={line.unitPriceLabel}
                    />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {line.mode === 'menu' ? (
                      <>
                        <button
                          type="button"
                          disabled={
                            poolAddDisabled ||
                            !canAddMenuFractionShare({
                              allocations: byItemAllocations,
                              lineSpecs,
                              lineKey: line.key,
                              denominator: menuFractionDenominatorForPerson(
                                byItemAllocations[line.key] ?? [],
                                currentName,
                              ),
                            })
                          }
                          className="h-7 min-w-7 rounded-lg border border-brand-border px-1 text-xs font-bold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            const denominator = menuFractionDenominatorForPerson(
                              byItemAllocations[line.key] ?? [],
                              person,
                            );
                            applyAlloc(
                              addMenuFractionShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person,
                                denominator,
                              }),
                            );
                          }}
                        >
                          {`1/${menuFractionDenominatorForPerson(
                            byItemAllocations[line.key] ?? [],
                            currentName,
                          )}`}
                        </button>
                        <button
                          type="button"
                          disabled={poolAddDisabled || !line.canAddWhole}
                          className="h-7 w-7 rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-sm font-bold text-brand-gold disabled:opacity-40"
                          onClick={() => {
                            const person = ensureNamed();
                            if (!person) return;
                            applyAlloc(
                              addWholeShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person,
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
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person,
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
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: person,
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

        <section className="overflow-hidden rounded-xl border border-brand-border bg-brand-card">
          <header className="border-b border-brand-border px-3 py-2 text-[12px] font-semibold tracking-wide text-brand-text-muted">
            {labels.currentShareTitle}
          </header>
          <div className="space-y-2 p-2.5">
            <div className="rounded-lg border border-dashed border-brand-gold/35 bg-brand-gold/10 p-2.5">
              <label className="mb-1 block text-[11px] text-brand-text-muted">
                {labels.markerName}
                <span className="ml-1 font-normal opacity-80">({labels.markerHint})</span>
              </label>
              <input
                type="text"
                value={nameDraft}
                disabled={nameEditDisabled}
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
              {currentSettled || currentLocked ? (
                <p className="mt-1 text-[11px] text-brand-text-muted">{labels.paidLocked}</p>
              ) : null}
              {needNameHint ? (
                <p className="mt-1 text-[11px] text-red-500">{labels.needName}</p>
              ) : null}
            </div>

            {shares.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-brand-text-muted">{labels.shareEmpty}</p>
            ) : (
              <>
                {shares.map((share) => {
                  const row = rowForShare(share);
                  if (!row) return null;
                  const shareLocked = Boolean(row.paidLocked);
                  const shareDisabled = disabled || shareLocked;
                  const over =
                    share.mode === 'menu' &&
                    isStaffMenuShareOverAllocated({
                      allocations: byItemAllocations,
                      lineSpecs,
                      lineKey: share.lineKey,
                      rowId: share.rowId,
                    });
                  return (
                    <div
                      key={`${share.lineKey}-${share.rowId}`}
                      className={`flex items-center justify-between gap-2 border-b border-brand-border/70 py-2 last:border-0 ${
                        shareLocked ? 'rounded-lg bg-brand-bg/80 px-1.5 opacity-80' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
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
                        <StaffByItemShareLineMeta
                          qtyLabel={share.qtyLabel}
                          unitPriceLabel={share.unitPriceLabel}
                          amount={share.amount}
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {share.mode === 'menu' ? (
                          <ByItemQtyInput
                            row={row}
                            labels={labels.qtyParts}
                            overAllocated={over}
                            disabled={shareDisabled}
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
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-[12px]">
                            <label className="flex items-center gap-0.5">
                              <span className="text-brand-text-muted">{labels.addAdult}</span>
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
                            <label className="flex items-center gap-0.5">
                              <span className="text-brand-text-muted">{labels.addChild}</span>
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
                        <ByItemConsumerRowRemoveButton
                          removable={!shareDisabled}
                          ariaLabel={labels.remove}
                          onRemove={() => {
                            applyAlloc(
                              removePersonShareOnLine({
                                allocations: byItemAllocations,
                                lineKey: share.lineKey,
                                rowId: share.rowId,
                                buffet: share.mode === 'buffet',
                              }),
                            );
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-sm font-medium tabular-nums text-brand-text">
                    {labels.estimate(estimate.rows, estimate.amount.toFixed(2))}
                  </p>
                  {onCollectCurrent && !currentSettled ? (
                    <button
                      type="button"
                      disabled={disabled || estimate.amount <= 0 || !currentName.trim()}
                      onClick={() => {
                        userPickedChipRef.current = false;
                        onCollectCurrent(currentName);
                      }}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-brand-gold text-white disabled:opacity-50"
                    >
                      {labels.collect}
                    </button>
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
