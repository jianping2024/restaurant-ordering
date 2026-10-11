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
  rationalFromGuestClaimRow,
} from '@/lib/guest-claim-qty-stack';
import { fractionUnitOfLine } from '@/lib/by-item-fraction-unit';
import type { GuestClaimMoney } from '@/lib/guest-claim';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';

export type GuestClaimPanelLabels = GuestClaimDishCardLabels & {
  nameLabel: string;
  namePlaceholder: string;
  nameTaken: string;
  /** Inline under the name field once the call CTA asked for it. */
  nameRequired: string;
  nameRequiredTag: string;
  nameHint: string;
  stepMineTitle: string;
  stepMineHint: string;
  progressTitle: string;
  tableTotal: string;
  moneyMine: string;
  moneyOthers: string;
  moneyLeft: string;
  /** Carries `{amount}`. */
  restAmount: string;
  restDone: string;
  /** Section title above read-only others' person blocks. */
  othersSection: string;
  othersCalled: string;
  paidLockedHint: string;
};

/** Sole DOM id of the claim name field (the call CTA scrolls to and focuses it). */
export const GUEST_CLAIM_NAME_INPUT_ID = 'guest-claim-name';

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
  /** Dishes whose fraction unit differs from the cut already fixed by others. */
  unitMismatchKeys: ReadonlySet<string>;
  /** Show the "name already used" hint under the name field. */
  nameTaken: boolean;
  /** The call CTA asked for a name and the field is still empty. */
  nameMissing: boolean;
  /** Sole money split (me / others / unclaimed) and per-dish euro of this phone. */
  money: GuestClaimMoney;
  lineAmounts: Record<string, number>;
  hasClaim: boolean;
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

function euro(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return done ? (
    <span
      aria-hidden="true"
      className="w-[26px] h-[26px] shrink-0 rounded-full bg-brand-gold text-brand-on-gold flex items-center justify-center text-[14px]"
    >
      ✓
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="w-[26px] h-[26px] shrink-0 rounded-full border-[1.5px] border-brand-gold text-brand-gold flex items-center justify-center text-[14px] font-semibold"
    >
      {n}
    </span>
  );
}

function MoneyCell({
  label,
  amount,
  dot,
  strong = false,
}: {
  label: string;
  amount: number;
  dot: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12px] text-brand-text-muted">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={`mt-0.5 text-[17px] font-semibold tabular-nums ${
          strong ? 'text-brand-gold' : 'text-brand-text'
        }`}
      >
        {euro(amount)}
      </p>
    </div>
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
  unitMismatchKeys,
  nameTaken,
  nameMissing,
  money,
  lineAmounts,
  hasClaim,
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
  const nameDone = claim.name.trim().length > 0;
  const nameHint = nameTaken
    ? labels.nameTaken
    : nameMissing && !nameDone
      ? labels.nameRequired
      : labels.nameHint;
  const nameInvalid = nameTaken || (nameMissing && !nameDone);
  const leftAll = money.left <= 0;
  const share = (amount: number) =>
    money.table > 0 ? `${Math.min(100, Math.max(0, (amount / money.table) * 100)).toFixed(2)}%` : '0%';

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
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          <StepBadge n={1} done={nameDone} />
          <label htmlFor={GUEST_CLAIM_NAME_INPUT_ID} className="flex-1 text-brand-text font-semibold text-base">
            {labels.nameLabel}
          </label>
          {!nameDone ? (
            <span className="text-[12px] text-red-500 border border-red-500/35 rounded-full px-2.5 py-0.5">
              {labels.nameRequiredTag}
            </span>
          ) : null}
        </div>
        <input
          id={GUEST_CLAIM_NAME_INPUT_ID}
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={40}
          value={claim.name}
          disabled={disabled}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            // Cancel Return before the key ends. Blurring here makes the phone
            // write the current text a second time.
            if (e.key === 'Enter') e.preventDefault();
          }}
          onKeyUp={(e) => {
            // After the key finishes, leave the field so the call-checkout dock returns.
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder={labels.namePlaceholder}
          aria-invalid={nameInvalid || undefined}
          className={`mt-3 ${customerTextInputClass}${nameInvalid ? ' !border-red-500' : ''}`}
        />
        <p
          className={`text-[13px] mt-2 ${nameInvalid ? 'text-red-500 font-medium' : 'text-brand-text-muted'}`}
        >
          {nameHint}
        </p>
      </div>

      <div className="flex items-start gap-2.5 pt-3">
        <StepBadge n={2} done={hasClaim} />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-brand-text leading-[26px]">{labels.stepMineTitle}</h3>
          <p className="text-[13px] text-brand-text-muted mt-0.5">{labels.stepMineHint}</p>
        </div>
      </div>

      <div data-guest-claim-money="" className="bg-brand-card border border-brand-border rounded-2xl p-4">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <span className="text-[13px] text-brand-text-muted">{labels.progressTitle}</span>
          <span className="text-[13px] text-brand-text-muted">
            {labels.tableTotal}
            <span className="ml-1.5 text-[15px] font-semibold text-brand-text tabular-nums">
              {euro(money.table)}
            </span>
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-brand-border/60" aria-hidden="true">
          <div className="bg-brand-gold transition-[width] duration-200" style={{ width: share(money.mine) }} />
          <div className="bg-brand-text-muted/60" style={{ width: share(money.others) }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MoneyCell label={labels.moneyMine} amount={money.mine} dot="bg-brand-gold" strong />
          <MoneyCell label={labels.moneyOthers} amount={money.others} dot="bg-brand-text-muted/60" />
          <MoneyCell
            label={labels.moneyLeft}
            amount={money.left}
            dot="border border-brand-text-muted/60"
          />
        </div>
        <button
          type="button"
          disabled={disabled || leftAll}
          onClick={onClaimAll}
          className="mt-3.5 w-full min-h-[44px] text-[14px] border border-dashed border-brand-border rounded-xl text-brand-text hover:border-brand-gold/50 hover:text-brand-gold transition-colors disabled:text-brand-text-muted/60"
        >
          {leftAll ? labels.restDone : fill(labels.restAmount, { amount: money.left.toFixed(2) })}
        </button>
      </div>

      {lineSpecs.map((spec) => {
        if (!guestClaimLineEditableVisible(spec, claim, others)) return null;
        const item = orderLineByKey[spec.key];
        if (!item) return null;
        const availability = lineAvailability(spec, others);
        const row = claimRowFor(claim, spec);
        const lockedUnitDen = fractionUnitOfLine(others[spec.key] ?? []);
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
            spec={spec}
            title={lineTitle(spec.key)}
            row={row}
            availability={availability}
            over={overClaimedKeys.has(spec.key)}
            unitMismatch={unitMismatchKeys.has(spec.key)}
            disabled={disabled}
            lineLocked={lineLocked}
            lockedUnitDen={lockedUnitDen}
            mineAmount={lineAmounts[spec.key] ?? 0}
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
                  <span
                    className={`text-[11px] font-medium ${
                      block.paidLocked
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-brand-text-muted'
                    }`}
                  >
                    {block.paidLocked ? labels.paidLockedHint : labels.othersCalled}
                  </span>
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
