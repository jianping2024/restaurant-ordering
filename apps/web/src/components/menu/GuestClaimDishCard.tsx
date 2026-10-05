'use client';

import type { ReactNode } from 'react';
import {
  sanitizeQtyDigits,
  type ByItemConsumerRow,
  type QtyPartsLabels,
} from '@/lib/bill-split-by-item';
import type { LineAvailability } from '@/lib/guest-claim';
import { formatRational } from '@/lib/rational-qty';
import { ByItemQtyColumnHeader, ByItemQtyInput } from '@/components/menu/ByItemQtyInput';
import {
  customerQtyInputAlertClass,
  customerQtyInputClass,
} from '@/components/menu/customer-form-input-styles';

export type GuestClaimDishCardLabels = QtyPartsLabels & {
  claimedByOthers: string;
  left: string;
  over: string;
  buffetAdultQtyLabel: string;
  buffetChildQtyLabel: string;
  buffetGuestCounts: string;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

type Props = {
  lineKey: string;
  title: ReactNode;
  mode: 'menu' | 'buffet';
  row: ByItemConsumerRow;
  availability: LineAvailability;
  over: boolean;
  disabled: boolean;
  labels: GuestClaimDishCardLabels;
  onChange: (patch: Partial<ByItemConsumerRow>) => void;
};

/** One dish: what the others already hold, what is left, and this phone's own quantity. */
export function GuestClaimDishCard({
  lineKey,
  title,
  mode,
  row,
  availability,
  over,
  disabled,
  labels,
  onChange,
}: Props) {
  const othersText =
    availability.mode === 'menu'
      ? availability.claimedByOthers.num > 0
        ? fill(labels.claimedByOthers, { qty: formatRational(availability.claimedByOthers) })
        : null
      : availability.adultsClaimedByOthers + availability.childrenClaimedByOthers > 0
        ? fill(labels.claimedByOthers, {
            qty: fill(labels.buffetGuestCounts, {
              adults: availability.adultsClaimedByOthers,
              children: availability.childrenClaimedByOthers,
            }),
          })
        : null;
  const leftText =
    availability.mode === 'menu'
      ? fill(labels.left, { qty: formatRational(availability.remaining) })
      : fill(labels.left, {
          qty: fill(labels.buffetGuestCounts, {
            adults: availability.adultsRemaining,
            children: availability.childrenRemaining,
          }),
        });

  const buffetField = over ? customerQtyInputAlertClass : customerQtyInputClass;

  return (
    <div
      data-guest-claim-line={lineKey}
      className={`bg-brand-card border rounded-xl p-3.5 ${
        over ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-brand-border'
      }`}
    >
      <p className="text-brand-text text-sm leading-snug">{title}</p>
      <p className="mt-1 text-[12px] text-brand-text-muted">
        {othersText ? <span>{othersText} · </span> : null}
        <span className={over ? 'text-red-500 font-medium' : undefined}>
          {over ? labels.over : leftText}
        </span>
      </p>

      {mode === 'menu' ? (
        <div className="mt-3 flex flex-col items-end gap-1">
          <ByItemQtyColumnHeader labels={labels} />
          <ByItemQtyInput
            row={row}
            labels={labels}
            overAllocated={over}
            disabled={disabled}
            onChange={(patch) => onChange(patch)}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(
            [
              ['adultQty', labels.buffetAdultQtyLabel],
              ['childQty', labels.buffetChildQtyLabel],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              className="flex min-w-0 flex-col gap-1 text-[11px] leading-tight text-brand-text-muted"
            >
              <span>{label}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={row[field] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ [field]: sanitizeQtyDigits(e.target.value) })}
                aria-label={label}
                className={`${buffetField} w-full`}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
