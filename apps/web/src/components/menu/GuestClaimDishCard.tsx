'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
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
import { unitDenForQty } from '@/lib/by-item-fraction-unit';

export type GuestClaimDishCardLabels = {
  left: string;
  over: string;
  /** Carries `{unit}`: the cut already fixed on this dish. */
  unitMismatch: string;
  /** Same, when the fixed cut is not known on this phone yet. */
  unitMismatchNoUnit: string;
  buffetAdultQtyLabel: string;
  buffetChildQtyLabel: string;
  buffetGuestCounts: string;
  /** Carries `{qty}`: this phone's portions of the dish. */
  mineQty: string;
  chipWhole: string;
  /** Carries `{n}`. */
  chipShare: string;
  minusAria: string;
  /** Carries `{price}`. */
  pricePortion: string;
  priceAdult: string;
  /** Carries `{adult}` and `{child}`. */
  priceBuffet: string;
  /** Carries `{n}`: the cut fixed on this dish. */
  cutHint: string;
  othersLockedHint: string;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function euro(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

const CHIP_CLASS =
  'min-h-[56px] rounded-xl border border-brand-border bg-brand-bg/60 px-1 flex flex-col items-center justify-center text-brand-gold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-brand-text-muted/50';
const MINUS_CLASS =
  'w-10 h-10 shrink-0 rounded-full border border-brand-border bg-brand-card text-brand-text flex items-center justify-center text-xl leading-none disabled:opacity-40';

type Props = {
  spec: ByItemLineSpec;
  title: ReactNode;
  row: ByItemConsumerRow;
  availability: LineAvailability;
  over: boolean;
  /** Server/local rule: this phone's fraction unit differs from the cut others fixed. */
  unitMismatch?: boolean;
  disabled: boolean;
  /** No remaining and nothing mine — card stays read-only. */
  lineLocked: boolean;
  /** Follow others' fraction method (Will: 分母跟死). */
  lockedUnitDen: number | null;
  /** This phone's euro on the dish — sole `guestClaimLineAmounts`, 0 when nothing claimed. */
  mineAmount: number;
  labels: GuestClaimDishCardLabels;
  onChange: (patch: Partial<ByItemConsumerRow>) => void;
};

/**
 * One dish: the portion buttons ARE the add action (one tap adds that size to this phone),
 * − takes one back, the footer states this phone's portions and euro.
 */
export function GuestClaimDishCard({
  spec,
  title,
  row,
  availability,
  over,
  unitMismatch = false,
  disabled,
  lineLocked,
  lockedUnitDen,
  mineAmount,
  labels,
  onChange,
}: Props) {
  const mode = spec.mode;
  const readOnly = disabled || lineLocked;

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
  const adultQty = Number.parseInt(row.adultQty || '0', 10) || 0;
  const childQty = Number.parseInt(row.childQty || '0', 10) || 0;
  const hasMine = mode === 'menu' ? !!mineQty && mineQty.num > 0 : adultQty + childQty > 0;

  const myDen = Number.parseInt(row.qtyDen.trim() || '0', 10);
  const effectiveLockedDen =
    lockedUnitDen ?? row.unitDen ?? (Number.isFinite(myDen) && myDen > 1 ? myDen : null);
  const presets = useMemo(
    () => guestClaimUnitPresets(effectiveLockedDen),
    [effectiveLockedDen],
  );

  /** The size last added: − takes the same size back first. */
  const [lastDen, setLastDen] = useState<number | null>(null);

  /** Stack result carries the unit it was picked in (whole portions carry none). */
  const withUnit = (
    fields: Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>,
    den: number,
  ): Partial<ByItemConsumerRow> => ({
    ...fields,
    unitDen: unitDenForQty(
      rationalFromGuestClaimRow({ ...row, ...fields }),
      den > 1 ? den : effectiveLockedDen,
    ),
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!unitMismatch) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [unitMismatch]);

  const remainingCap =
    availability.mode === 'menu' ? availability.remaining : { num: 0, den: 1 };

  const addMenuUnit = (den: number) => {
    if (!mineQty) return;
    const next = stackGuestClaimUnit({ current: mineQty, unitDen: den, remaining: remainingCap });
    if (!next) return;
    setLastDen(den);
    onChange(withUnit(next, den));
  };

  const minusCandidates = [lastDen, effectiveLockedDen, 1].filter(
    (den, index, all): den is number => den != null && all.indexOf(den) === index,
  );
  const minusMenuDen =
    mineQty && !readOnly
      ? minusCandidates.find((den) => canUnstackGuestClaimUnit({ current: mineQty, unitDen: den }))
      : undefined;
  const minusMenuUnit = () => {
    if (!mineQty || minusMenuDen == null) return;
    const next = unstackGuestClaimUnit({ current: mineQty, unitDen: minusMenuDen });
    if (next) onChange(withUnit(next, minusMenuDen));
  };

  const setBuffetField = (field: 'adultQty' | 'childQty', value: number) =>
    onChange({ [field]: value <= 0 ? '' : String(value) } as Partial<ByItemConsumerRow>);

  const shellClass = lineLocked
    ? 'border-brand-border bg-brand-border/25 opacity-90'
    : over || unitMismatch
      ? 'border-red-500/40 ring-1 ring-red-500/20 bg-brand-card'
      : hasMine
        ? 'border-brand-gold/50 bg-brand-gold/5'
        : 'border-brand-border bg-brand-card';

  const priceText =
    spec.mode === 'menu'
      ? fill(labels.pricePortion, { price: spec.unitPrice.toFixed(2) })
      : spec.children > 0
        ? fill(labels.priceBuffet, {
            adult: spec.adultUnitPrice.toFixed(2),
            child: spec.childUnitPrice.toFixed(2),
          })
        : fill(labels.priceAdult, { price: spec.adultUnitPrice.toFixed(2) });

  const metaLine = (
    <p className="mt-1 text-[13px] text-brand-text-muted">
      {lineLocked ? (
        <span>{labels.othersLockedHint}</span>
      ) : (
        <span className={over || unitMismatch ? 'text-red-500 font-medium' : undefined}>
          {unitMismatch
            ? effectiveLockedDen
              ? fill(labels.unitMismatch, { unit: effectiveLockedDen })
              : labels.unitMismatchNoUnit
            : over
              ? labels.over
              : leftText}
        </span>
      )}
    </p>
  );

  const buffetChips: Array<{
    field: 'adultQty' | 'childQty';
    label: string;
    value: number;
  }> = [
    { field: 'adultQty', label: labels.buffetAdultQtyLabel, value: adultQty },
    ...(spec.mode === 'buffet' && spec.children > 0
      ? [{ field: 'childQty' as const, label: labels.buffetChildQtyLabel, value: childQty }]
      : []),
  ];

  return (
    <div
      ref={rootRef}
      data-guest-claim-line={spec.key}
      data-claim-state={lineLocked ? 'locked' : hasMine ? 'mine' : 'open'}
      className={`rounded-2xl p-4 border ${shellClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-brand-text text-base leading-snug">{title}</p>
          {metaLine}
        </div>
        <p className="shrink-0 text-[13px] text-brand-text-muted tabular-nums whitespace-nowrap leading-snug">
          {priceText}
        </p>
      </div>

      {mode === 'menu' && effectiveLockedDen ? (
        <p className="mt-2 inline-block rounded-full bg-brand-ink/10 px-2.5 py-0.5 text-[12px] text-brand-ink">
          {fill(labels.cutHint, { n: effectiveLockedDen })}
        </p>
      ) : null}

      {!lineLocked ? (
        <div
          className="mt-3 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${
              mode === 'menu' ? presets.length : buffetChips.length
            }, minmax(0, 1fr))`,
          }}
        >
          {mode === 'menu'
            ? presets.map((den) => {
                const canAdd =
                  !readOnly &&
                  !!mineQty &&
                  canStackGuestClaimUnit({
                    current: mineQty,
                    unitDen: den,
                    remaining: remainingCap,
                  });
                return (
                  <button
                    key={den}
                    type="button"
                    disabled={!canAdd}
                    onClick={() => addMenuUnit(den)}
                    className={CHIP_CLASS}
                  >
                    <span className="text-lg font-semibold leading-5">
                      {den === 1 ? '+1' : `+1/${den}`}
                    </span>
                    <span className="mt-0.5 text-[11px] leading-[14px] text-brand-text-muted">
                      {den === 1 ? labels.chipWhole : fill(labels.chipShare, { n: den })}
                    </span>
                  </button>
                );
              })
            : buffetChips.map(({ field, label, value }) => {
                const ceil =
                  availability.mode === 'buffet' ? guestBuffetSeatCeil(availability, field) : 0;
                return (
                  <button
                    key={field}
                    type="button"
                    disabled={readOnly || value >= ceil}
                    onClick={() => setBuffetField(field, value + 1)}
                    className={CHIP_CLASS}
                  >
                    <span className="text-lg font-semibold leading-5">+1</span>
                    <span className="mt-0.5 text-[11px] leading-[14px] text-brand-text-muted">
                      {label}
                    </span>
                  </button>
                );
              })}
        </div>
      ) : null}

      {hasMine ? (
        <div className="mt-3 flex items-center gap-3 border-t border-brand-gold/25 pt-3">
          {mode === 'menu' ? (
            <>
              <button
                type="button"
                aria-label={labels.minusAria}
                disabled={minusMenuDen == null}
                onClick={minusMenuUnit}
                className={MINUS_CLASS}
              >
                −
              </button>
              <p className="min-w-0 flex-1 text-[15px] font-semibold text-brand-gold tabular-nums">
                {fill(labels.mineQty, { qty: formatGuestClaimQtyLabel(mineQty!) })}
              </p>
            </>
          ) : (
            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              {buffetChips
                .filter(({ value }) => value > 0)
                .map(({ field, label, value }) => (
                  <div key={field} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={labels.minusAria}
                      disabled={readOnly}
                      onClick={() => setBuffetField(field, value - 1)}
                      className={MINUS_CLASS}
                    >
                      −
                    </button>
                    <span className="text-[15px] font-semibold text-brand-gold tabular-nums">
                      {label} {value}
                    </span>
                  </div>
                ))}
            </div>
          )}
          <p className="shrink-0 text-lg font-semibold text-brand-gold tabular-nums">
            {euro(mineAmount)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
