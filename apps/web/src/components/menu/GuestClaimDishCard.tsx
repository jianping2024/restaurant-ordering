'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  guestBuffetSeatCeil,
  guestClaimLeftToClaim,
  type LineAvailability,
} from '@/lib/guest-claim';
import {
  canStackGuestClaimUnit,
  canUnstackGuestClaimUnit,
  formatGuestClaimQtyLabel,
  guestClaimUnitPresets,
  rationalFromGuestClaimRow,
  stackGuestClaimUnit,
  unstackGuestClaimUnit,
} from '@/lib/guest-claim-qty-stack';
import { mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';

export type GuestClaimDishCardLabels = {
  left: string;
  over: string;
  buffetAdultQtyLabel: string;
  buffetChildQtyLabel: string;
  buffetGuestCounts: string;
  mineLabel: string;
  unitPickerLabel: string;
  stackLabel: string;
  paidLockedHint: string;
  othersLockedHint: string;
  expandLabel: string;
  collapseLabel: string;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function unitChipLabel(den: number): string {
  return den === 1 ? '1' : `1/${den}`;
}

type Props = {
  lineKey: string;
  title: ReactNode;
  mode: 'menu' | 'buffet';
  row: ByItemConsumerRow;
  availability: LineAvailability;
  over: boolean;
  disabled: boolean;
  /** No remaining and nothing mine — card stays read-only. */
  lineLocked: boolean;
  /** Already collected / called ticket share — emerald read-only chrome. */
  paidLocked?: boolean;
  /** Follow others' fraction method (Will: 分母跟死). */
  lockedUnitDen: number | null;
  labels: GuestClaimDishCardLabels;
  onChange: (patch: Partial<ByItemConsumerRow>) => void;
};

/** One dish: expand to pick unit + stack; buffet stays integer −/+. */
export function GuestClaimDishCard({
  lineKey,
  title,
  mode,
  row,
  availability,
  over,
  disabled,
  lineLocked,
  paidLocked = false,
  lockedUnitDen,
  labels,
  onChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const readOnly = disabled || lineLocked || paidLocked;

  const displayLeft = guestClaimLeftToClaim(availability, row);
  const leftText =
    displayLeft.mode === 'menu'
      ? fill(labels.left, { qty: formatGuestClaimQtyLabel(displayLeft.left) })
      : fill(labels.left, {
          qty: fill(labels.buffetGuestCounts, {
            adults: displayLeft.adultsLeft,
            children: displayLeft.childrenLeft,
          }),
        });

  const mineQty = mode === 'menu' ? rationalFromGuestClaimRow(row) : null;
  const hasMine =
    mode === 'menu'
      ? !!mineQty && mineQty.num > 0
      : (Number.parseInt(row.adultQty || '0', 10) || 0) +
          (Number.parseInt(row.childQty || '0', 10) || 0) >
        0;

  const mineLabel =
    mode === 'menu'
      ? `${labels.mineLabel} ${formatGuestClaimQtyLabel(mineQty!)}`
      : `${labels.mineLabel} ${row.adultQty || '0'}A / ${row.childQty || '0'}C`;

  const myDen = Number.parseInt(row.qtyDen.trim() || '0', 10);
  const effectiveLockedDen =
    lockedUnitDen ?? (Number.isFinite(myDen) && myDen > 1 ? myDen : null);

  const presets = useMemo(
    () => guestClaimUnitPresets(effectiveLockedDen),
    [effectiveLockedDen],
  );
  const [unitDen, setUnitDen] = useState<number>(() => effectiveLockedDen ?? 1);
  const activeUnit = presets.includes(unitDen) ? unitDen : presets[0] ?? 1;

  const remainingCap =
    availability.mode === 'menu' ? availability.remaining : { num: 0, den: 1 };
  const canPlus =
    !readOnly &&
    mode === 'menu' &&
    !!mineQty &&
    canStackGuestClaimUnit({
      current: mineQty,
      unitDen: activeUnit,
      remaining: remainingCap,
    });
  const canMinus =
    !readOnly &&
    mode === 'menu' &&
    !!mineQty &&
    canUnstackGuestClaimUnit({ current: mineQty, unitDen: activeUnit });

  const shellClass = paidLocked
    ? 'border-emerald-600/35 bg-emerald-500/5'
    : lineLocked
      ? 'border-brand-border bg-brand-border/25 opacity-90'
      : over
        ? 'border-red-500/40 ring-1 ring-red-500/20 bg-brand-card'
        : hasMine
          ? 'border-brand-gold/50 bg-brand-gold/5'
          : 'border-brand-border bg-brand-card';

  const metaLine = (
    <p className="mt-1 text-[12px] text-brand-text-muted">
      {paidLocked ? (
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
          {labels.paidLockedHint}
        </span>
      ) : lineLocked ? (
        <span>{labels.othersLockedHint}</span>
      ) : (
        <span className={over ? 'text-red-500 font-medium' : undefined}>
          {over ? labels.over : leftText}
        </span>
      )}
    </p>
  );

  return (
    <div
      data-guest-claim-line={lineKey}
      data-claim-state={
        paidLocked ? 'paid' : lineLocked ? 'locked' : hasMine ? 'mine' : 'open'
      }
      className={`rounded-xl p-3.5 border ${shellClass}`}
    >
      <button
        type="button"
        className="w-full text-left flex items-start justify-between gap-2"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-brand-text text-sm leading-snug">{title}</p>
          {metaLine}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className={`text-[12px] font-medium px-2 py-0.5 rounded-full border ${
              hasMine
                ? 'border-brand-gold/60 text-brand-gold'
                : 'border-brand-border text-brand-text-muted'
            }`}
          >
            {mineLabel}
          </span>
          <span className="text-[11px] text-brand-text-muted">
            {expanded ? labels.collapseLabel : labels.expandLabel}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-brand-border/60 pt-3">
          {mode === 'menu' ? (
            <>
              <div>
                <p className="text-[11px] text-brand-text-muted mb-1.5">{labels.unitPickerLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((den) => (
                    <button
                      key={den}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setUnitDen(den)}
                      className={`min-w-[2.5rem] px-2.5 py-1.5 rounded-lg text-sm ${mesaSelectionChipSoftClass(
                        activeUnit === den,
                      )} disabled:opacity-50`}
                    >
                      {unitChipLabel(den)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-brand-text-muted mb-1.5">{labels.stackLabel}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label="−"
                    disabled={!canMinus}
                    onClick={() => {
                      const next = unstackGuestClaimUnit({
                        current: mineQty!,
                        unitDen: activeUnit,
                      });
                      if (next) onChange(next);
                    }}
                    className="w-10 h-10 rounded-full bg-brand-border text-brand-text text-lg disabled:opacity-40"
                  >
                    −
                  </button>
                  <div className="min-w-[4.5rem] text-center">
                    <p className="text-lg font-semibold tabular-nums text-brand-gold">
                      {formatGuestClaimQtyLabel(mineQty!)}
                    </p>
                    <p className="text-[11px] text-brand-text-muted">
                      {activeUnit === 1 ? '×1' : `×1/${activeUnit}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="+"
                    disabled={!canPlus}
                    onClick={() => {
                      const next = stackGuestClaimUnit({
                        current: mineQty!,
                        unitDen: activeUnit,
                        remaining: remainingCap,
                      });
                      if (next) onChange(next);
                    }}
                    className="w-10 h-10 rounded-full bg-brand-gold text-brand-on-gold text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['adultQty', labels.buffetAdultQtyLabel] as const,
                  ['childQty', labels.buffetChildQtyLabel] as const,
                ] as const
              ).map(([field, label]) => {
                const value = Number.parseInt(String(row[field] || '0'), 10) || 0;
                const ceil =
                  availability.mode === 'buffet' ? guestBuffetSeatCeil(availability, field) : 0;
                return (
                  <div key={field} className="flex flex-col gap-1">
                    <span className="text-[11px] text-brand-text-muted">{label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={readOnly || value <= 0}
                        onClick={() =>
                          onChange({
                            [field]: value <= 1 ? '' : String(value - 1),
                          } as Partial<ByItemConsumerRow>)
                        }
                        className="w-9 h-9 rounded-full bg-brand-border text-brand-text disabled:opacity-40"
                      >
                        −
                      </button>
                      <span
                        className={`flex-1 text-center tabular-nums font-semibold ${
                          over ? 'text-red-500' : 'text-brand-gold'
                        }`}
                      >
                        {value}
                      </span>
                      <button
                        type="button"
                        disabled={readOnly || value >= ceil}
                        onClick={() =>
                          onChange({
                            [field]: String(value + 1),
                          } as Partial<ByItemConsumerRow>)
                        }
                        className="w-9 h-9 rounded-full bg-brand-gold text-brand-on-gold disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
