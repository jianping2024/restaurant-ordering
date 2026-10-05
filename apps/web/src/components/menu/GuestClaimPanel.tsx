'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { formatByItemSplitQuantityLabel } from '@/lib/bill-split-by-item-lines';
import type { ByItemConsumerRow, ByItemLineAllocation } from '@/lib/bill-split-by-item';
import { claimRowFor, lineAvailability, type GuestClaim } from '@/lib/guest-claim';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';
import {
  guestClaimNameHidesCallCheckout,
  scrollElementIntoVisualViewport,
  softKeyboardOpen,
} from '@/lib/soft-keyboard-viewport';
import {
  GuestClaimDishCard,
  type GuestClaimDishCardLabels,
} from '@/components/menu/GuestClaimDishCard';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';

export type GuestClaimPanelLabels = GuestClaimDishCardLabels & {
  nameLabel: string;
  namePlaceholder: string;
  nameRequired: string;
  nameTaken: string;
  intro: string;
  claimAll: string;
};

type Props = {
  lang: UILanguage;
  labels: GuestClaimPanelLabels;
  claim: GuestClaim;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  others: ByItemLineAllocation;
  overClaimedKeys: ReadonlySet<string>;
  /** Show the "name already used" hint under the name field. */
  nameTaken: boolean;
  disabled: boolean;
  itemCodeByMenuId?: Record<string, string>;
  onNameChange: (name: string) => void;
  /**
   * Bill page yields the fixed call-checkout CTA when this is true.
   * Sole signal: {@link guestClaimNameHidesCallCheckout} (name focused ∧ soft keyboard open).
   */
  onHideCallCheckoutChange?: (hide: boolean) => void;
  onRowChange: (spec: ByItemLineSpec, patch: Partial<ByItemConsumerRow>) => void;
  onClaimAll: () => void;
};

/** Sole guest by-item editor: this phone's name once, then its share of every dish. */
export function GuestClaimPanel({
  lang,
  labels,
  claim,
  lineSpecs,
  orderLines,
  others,
  overClaimedKeys,
  nameTaken,
  disabled,
  itemCodeByMenuId = {},
  onNameChange,
  onHideCallCheckoutChange,
  onRowChange,
  onClaimAll,
}: Props) {
  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );
  const nameMissing = claim.name.trim().length === 0;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [softKeyboardIsOpen, setSoftKeyboardIsOpen] = useState(false);

  const hideCallCheckout = guestClaimNameHidesCallCheckout(
    nameFocused,
    softKeyboardIsOpen,
  );

  useEffect(() => {
    onHideCallCheckoutChange?.(hideCallCheckout);
    return () => {
      onHideCallCheckoutChange?.(false);
    };
  }, [hideCallCheckout, onHideCallCheckoutChange]);

  /**
   * Sole name-field visualViewport path while focused: sync soft-keyboard open
   * (so call-checkout returns when the keyboard closes even without blur) and
   * scroll the field into view. Never scroll on focus / during open animation.
   */
  useEffect(() => {
    if (!nameFocused) {
      setSoftKeyboardIsOpen(false);
      return;
    }
    const el = nameInputRef.current;
    const run = () => {
      const vv = window.visualViewport;
      const open = vv
        ? softKeyboardOpen(window.innerHeight, vv.height)
        : false;
      setSoftKeyboardIsOpen(open);
      if (el) scrollElementIntoVisualViewport(el, { behavior: 'instant' });
    };
    run();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', run);
    vv?.addEventListener('scroll', run);
    return () => {
      vv?.removeEventListener('resize', run);
      vv?.removeEventListener('scroll', run);
    };
  }, [nameFocused]);

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="bg-brand-card border border-brand-border rounded-xl p-3.5">
        <label htmlFor="guest-claim-name" className="text-brand-text font-medium text-sm block mb-1.5">
          {labels.nameLabel}
        </label>
        <input
          ref={nameInputRef}
          id="guest-claim-name"
          type="text"
          autoComplete="off"
          maxLength={40}
          value={claim.name}
          disabled={disabled}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={labels.namePlaceholder}
          aria-invalid={nameTaken || undefined}
          className={`${customerTextInputClass}${nameTaken ? ' !border-red-500' : ''}`}
        />
        <p className={`text-[12px] mt-1.5 ${nameTaken ? 'text-red-500' : 'text-brand-text-muted'}`}>
          {nameTaken ? labels.nameTaken : nameMissing ? labels.nameRequired : labels.intro}
        </p>
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
        const item = orderLineByKey[spec.key];
        if (!item) return null;
        const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
        return (
          <GuestClaimDishCard
            key={spec.key}
            lineKey={spec.key}
            title={`${formatLocalizedMenuItemLabel(item, lang, itemCode)} ${formatByItemSplitQuantityLabel(spec, item)}`}
            mode={spec.mode}
            row={claimRowFor(claim, spec)}
            availability={lineAvailability(spec, others)}
            over={overClaimedKeys.has(spec.key)}
            disabled={disabled}
            labels={labels}
            onChange={(patch) => onRowChange(spec, patch)}
          />
        );
      })}
    </div>
  );
}
