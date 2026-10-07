'use client';

import { useMemo } from 'react';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { formatByItemSplitQuantityLabel } from '@/lib/bill-split-by-item-lines';
import type { ByItemConsumerRow, ByItemLineAllocation } from '@/lib/bill-split-by-item';
import {
  claimRowFor,
  guestClaimLineEditableVisible,
  guestOthersClaimBlockShellClass,
  lineAvailability,
  type GuestClaim,
  type GuestOthersClaimBlock,
} from '@/lib/guest-claim';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';
import {
  GuestClaimDishCard,
  type GuestClaimDishCardLabels,
} from '@/components/menu/GuestClaimDishCard';
import {
  formatGuestClaimQtyLabel,
  lockedGuestClaimUnitDen,
  rationalFromGuestClaimRow,
} from '@/lib/guest-claim-qty-stack';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';

export type GuestClaimPanelLabels = GuestClaimDishCardLabels & {
  nameLabel: string;
  namePlaceholder: string;
  nameTaken: string;
  claimAll: string;
  /** Section title above read-only others' person blocks. */
  othersSection: string;
};

type Props = {
  lang: UILanguage;
  labels: GuestClaimPanelLabels;
  claim: GuestClaim;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  others: ByItemLineAllocation;
  /** Sole read-only "who claimed what" — one block per other ticket. */
  othersBlocks: GuestOthersClaimBlock[];
  overClaimedKeys: ReadonlySet<string>;
  /** Show the "name already used" hint under the name field. */
  nameTaken: boolean;
  disabled: boolean;
  itemCodeByMenuId?: Record<string, string>;
  onNameChange: (name: string) => void;
  onRowChange: (spec: ByItemLineSpec, patch: Partial<ByItemConsumerRow>) => void;
  onClaimAll: () => void;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

/** Sole guest by-item editor: this phone's name once, then its share of every dish. */
export function GuestClaimPanel({
  lang,
  labels,
  claim,
  lineSpecs,
  orderLines,
  others,
  othersBlocks,
  overClaimedKeys,
  nameTaken,
  disabled,
  itemCodeByMenuId = {},
  onNameChange,
  onRowChange,
  onClaimAll,
}: Props) {
  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );
  const nameHint = nameTaken ? labels.nameTaken : null;

  const lineTitle = (lineKey: string) => {
    const spec = lineSpecs.find((row) => row.key === lineKey);
    const item = orderLineByKey[lineKey];
    if (!spec || !item) return lineKey;
    const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
    return `${formatLocalizedMenuItemLabel(item, lang, itemCode)} ${formatByItemSplitQuantityLabel(spec, item)}`;
  };

  const qtyLabelForBlockLine = (blockLine: GuestOthersClaimBlock['lines'][number]) => {
    if (blockLine.mode === 'menu') return formatGuestClaimQtyLabel(blockLine.qty);
    return fill(labels.buffetGuestCounts, {
      adults: blockLine.adults,
      children: blockLine.children,
    });
  };

  return (
    <div className="space-y-3">
      <div className="bg-brand-card border border-brand-border rounded-xl p-3.5">
        <label htmlFor="guest-claim-name" className="text-brand-text font-medium text-sm block mb-1.5">
          {labels.nameLabel}
        </label>
        <input
          id="guest-claim-name"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={40}
          value={claim.name}
          disabled={disabled}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            // Return/Done closes the keyboard so the call-checkout dock comes back.
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder={labels.namePlaceholder}
          aria-invalid={nameTaken || undefined}
          className={`${customerTextInputClass}${nameTaken ? ' !border-red-500' : ''}`}
        />
        {nameHint ? (
          <p
            className={`text-[12px] mt-1.5 ${nameTaken ? 'text-red-500' : 'text-brand-text-muted'}`}
          >
            {nameHint}
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={onClaimAll}
          className="mt-3 w-full text-[13px] py-2 border border-dashed border-brand-border rounded-lg text-brand-text-muted hover:border-brand-gold/50 hover:text-brand-gold transition-colors disabled:opacity-50"
        >
          {labels.claimAll}
        </button>
      </div>

      {lineSpecs.map((spec) => {
        if (!guestClaimLineEditableVisible(spec, claim, others)) return null;
        const item = orderLineByKey[spec.key];
        if (!item) return null;
        const availability = lineAvailability(spec, others);
        const row = claimRowFor(claim, spec);
        const lockedUnitDen = lockedGuestClaimUnitDen(
          (others[spec.key] ?? []).map((share) => share.qty),
        );
        const mineEmpty =
          spec.mode === 'menu'
            ? rationalFromGuestClaimRow(row).num <= 0
            : !(Number.parseInt(row.adultQty || '0', 10) || 0) &&
              !(Number.parseInt(row.childQty || '0', 10) || 0);
        const noRemaining =
          availability.mode === 'menu'
            ? availability.remaining.num <= 0
            : availability.adultsRemaining <= 0 && availability.childrenRemaining <= 0;
        const lineLocked = noRemaining && mineEmpty;
        return (
          <GuestClaimDishCard
            key={spec.key}
            lineKey={spec.key}
            title={lineTitle(spec.key)}
            mode={spec.mode}
            row={row}
            availability={availability}
            over={overClaimedKeys.has(spec.key)}
            disabled={disabled}
            lineLocked={lineLocked}
            lockedUnitDen={lockedUnitDen}
            labels={labels}
            onChange={(patch) => onRowChange(spec, patch)}
          />
        );
      })}

      {othersBlocks.length > 0 ? (
        <section className="space-y-2.5 pt-1" data-guest-others-claims>
          <h3 className="text-sm font-medium text-brand-text-muted px-0.5">
            {labels.othersSection}
          </h3>
          {othersBlocks.map((block) => (
            <div
              key={block.ticketKey}
              data-guest-others-ticket={block.ticketKey}
              className={`rounded-xl p-3.5 border ${guestOthersClaimBlockShellClass(
                block.styleSlot,
                block.paidLocked,
              )}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-brand-ink truncate">{block.name}</h4>
                <div className="shrink-0 flex items-baseline gap-2">
                  <span className="mesa-money tabular-nums text-sm font-semibold text-brand-gold">
                    €{block.amount.toFixed(2)}
                  </span>
                  {block.paidLocked ? (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      {labels.paidLockedHint}
                    </span>
                  ) : null}
                </div>
              </div>
              <ul className="space-y-1.5">
                {block.lines.map((line) => (
                  <li
                    key={`${block.ticketKey}:${line.lineKey}`}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-brand-text">
                      {lineTitle(line.lineKey)}
                    </span>
                    <span className="shrink-0 tabular-nums text-brand-text-muted">
                      {qtyLabelForBlockLine(line)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
