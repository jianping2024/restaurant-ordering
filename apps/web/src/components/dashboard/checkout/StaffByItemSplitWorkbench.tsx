'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { LockedPersonLineMins } from '@/lib/checkout-split-continuation';
import type { UILanguage } from '@/lib/i18n';
import { splitPersonKey } from '@/lib/split-person-identity';
import {
  addBuffetSeatToPerson,
  addHalfShareToPerson,
  addWholeShareToPerson,
  removePersonShareOnLine,
  staffByItemPeopleFromAllocations,
  staffByItemPersonEstimate,
  staffByItemPersonShares,
  staffByItemPoolLines,
} from '@/lib/staff-by-item-workbench';

export type StaffByItemWorkbenchLabels = {
  poolTitle: string;
  currentShareTitle: string;
  markerName: string;
  markerHint: string;
  markerPlaceholder: string;
  addPerson: string;
  remainingPrefix: string;
  estimate: (n: number, amount: string) => string;
  needName: string;
  poolEmpty: string;
  progress: string;
  addAdult: string;
  addChild: string;
  remove: string;
  paidLocked: string;
};

type Props = {
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  lockedPersonNames: ReadonlySet<string>;
  lockedPersonLineMins?: LockedPersonLineMins;
  itemCodeByMenuId?: Record<string, string>;
  guestName: (n: number) => string;
  labels: StaffByItemWorkbenchLabels;
  progress: { complete: number; total: number };
  disabled?: boolean;
  onAllocationChange: (next: Record<string, ByItemConsumerRow[]>) => void;
  onRenamePerson: (oldName: string, newName: string) => void;
};

/**
 * Sole staff checkout by-item layout (Fatura-like): person chips + remaining pool + current share.
 * Guest phone keeps ByItemSplitSection; do not render dish cards here.
 */
export function StaffByItemSplitWorkbench({
  lang,
  lineSpecs,
  orderLines,
  byItemAllocations,
  lockedPersonNames,
  itemCodeByMenuId = {},
  guestName,
  labels,
  progress,
  disabled = false,
  onAllocationChange,
  onRenamePerson,
}: Props) {
  const peopleFromAlloc = useMemo(
    () => staffByItemPeopleFromAllocations(byItemAllocations),
    [byItemAllocations],
  );

  const [people, setPeople] = useState<string[]>(() =>
    peopleFromAlloc.length > 0 ? peopleFromAlloc : [guestName(1)],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nameDraft, setNameDraft] = useState(() => people[0] ?? guestName(1));
  const [needNameHint, setNeedNameHint] = useState(false);

  useEffect(() => {
    if (peopleFromAlloc.length === 0) return;
    setPeople((prev) => {
      const keys = new Set(prev.map((name) => splitPersonKey(name)).filter(Boolean));
      let changed = false;
      const next = [...prev];
      for (const name of peopleFromAlloc) {
        const key = splitPersonKey(name);
        if (!key || keys.has(key)) continue;
        keys.add(key);
        next.push(name);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [peopleFromAlloc]);

  const safeIndex = Math.min(currentIndex, Math.max(0, people.length - 1));
  const currentName = people[safeIndex] ?? '';

  useEffect(() => {
    setNameDraft(currentName);
    setNeedNameHint(false);
  }, [currentName, safeIndex]);

  const currentLocked = lockedPersonNames.has(currentName.trim().toLowerCase());
  const editDisabled = disabled || currentLocked;

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

  const visiblePool = poolLines.filter((line) => line.remainingPositive);

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

  const estimate = staffByItemPersonEstimate(shares);

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

  const handleAddPerson = () => {
    const nextName = guestName(people.length + 1);
    setPeople((prev) => [...prev, nextName]);
    setCurrentIndex(people.length);
    setNameDraft(nextName);
    setNeedNameHint(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {people.map((name, idx) => {
            const locked = lockedPersonNames.has(name.trim().toLowerCase());
            const active = idx === safeIndex;
            return (
              <button
                key={`${splitPersonKey(name) || name}-${idx}`}
                type="button"
                disabled={disabled}
                onClick={() => setCurrentIndex(idx)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-brand-gold bg-brand-gold text-white'
                    : 'border-brand-border bg-brand-card text-brand-text hover:border-brand-gold/50'
                } ${locked ? 'opacity-80' : ''}`}
              >
                {name || guestName(idx + 1)}
                {locked ? ' ✓' : ''}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            onClick={handleAddPerson}
            className="rounded-full border border-dashed border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-text-muted hover:border-brand-gold/50"
          >
            + {labels.addPerson}
          </button>
        </div>
        <span className="text-[12px] text-brand-text-muted tabular-nums">
          {labels.progress}: {progress.complete}/{progress.total}
        </span>
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
              visiblePool.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-brand-border px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-brand-text">{line.label}</div>
                    <div className="text-[12px] text-brand-text-muted">
                      {labels.remainingPrefix} {line.remainingLabel}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {line.mode === 'menu' ? (
                      <>
                        <button
                          type="button"
                          disabled={editDisabled || !line.canAddHalf}
                          className="h-7 w-7 rounded-lg border border-brand-border text-xs font-bold disabled:opacity-40"
                          onClick={() => {
                            const name = ensureNamed();
                            if (!name) return;
                            applyAlloc(
                              addHalfShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: name,
                              }),
                            );
                          }}
                        >
                          ½
                        </button>
                        <button
                          type="button"
                          disabled={editDisabled || !line.canAddWhole}
                          className="h-7 w-7 rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-sm font-bold text-brand-gold disabled:opacity-40"
                          onClick={() => {
                            const name = ensureNamed();
                            if (!name) return;
                            applyAlloc(
                              addWholeShareToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: name,
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
                          disabled={editDisabled || !line.canAddAdult}
                          className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold disabled:opacity-40"
                          onClick={() => {
                            const name = ensureNamed();
                            if (!name) return;
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: name,
                                guestType: 'adult',
                              }),
                            );
                          }}
                        >
                          {labels.addAdult}
                        </button>
                        <button
                          type="button"
                          disabled={editDisabled || !line.canAddChild}
                          className="rounded-lg border border-brand-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          onClick={() => {
                            const name = ensureNamed();
                            if (!name) return;
                            applyAlloc(
                              addBuffetSeatToPerson({
                                allocations: byItemAllocations,
                                lineSpecs,
                                lineKey: line.key,
                                personName: name,
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
              ))
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
                disabled={editDisabled}
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
              {currentLocked ? (
                <p className="mt-1 text-[11px] text-brand-text-muted">{labels.paidLocked}</p>
              ) : null}
              {needNameHint ? (
                <p className="mt-1 text-[11px] text-red-500">{labels.needName}</p>
              ) : null}
            </div>

            {shares.length === 0 ? (
              <p className="px-1 py-2 text-[13px] text-brand-text-muted">—</p>
            ) : (
              shares.map((share) => (
                <div
                  key={`${share.lineKey}-${share.rowId}`}
                  className="flex items-center justify-between gap-2 border-b border-brand-border/70 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-brand-text">
                      {share.label}
                      <span className="text-brand-text-muted"> × {share.qtyLabel}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-brand-gold">
                      {share.amountLabel}
                    </span>
                    <button
                      type="button"
                      disabled={editDisabled}
                      className="text-[11px] text-brand-text-muted hover:text-red-600 disabled:opacity-40"
                      onClick={() => {
                        applyAlloc(
                          removePersonShareOnLine({
                            allocations: byItemAllocations,
                            lineKey: share.lineKey,
                            rowId: share.rowId,
                            buffet: share.mode === 'buffet',
                          }),
                        );
                      }}
                    >
                      {labels.remove}
                    </button>
                  </div>
                </div>
              ))
            )}

            <p className="pt-1 text-[12px] font-medium text-brand-text">
              {labels.estimate(estimate.rows, estimate.amount.toFixed(2))}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
