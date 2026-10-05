'use client';

import type { ReactNode } from 'react';
import type { ByItemDishAllocatorLabels } from '@/components/menu/ByItemDishAllocator';
import { ByItemSplitSection } from '@/components/menu/ByItemSplitSection';
import type { SplitPersonSlot } from '@/lib/use-bill-split-draft';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { LockedPersonLineMins } from '@/lib/checkout-split-continuation';
import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import {
  isSplitSettlementPending,
  splitSettlementCollectAmount,
} from '@/lib/checkout-split-settlement';
import { resolveCheckoutDiscountedShareDisplay } from '@/lib/checkout-split-math';
import type { UILanguage } from '@/lib/i18n';
import {
  GUEST_SPLIT_MODE_ORDER,
  type GuestSplitGuidanceCopy,
} from '@/lib/i18n/guest-split-mode-messages';
import type { SplitMode, SplitResult } from '@/types';
import {
  mesaSelectionChipStrongClass,
} from '@/lib/mesa-selection-chip';
import {
  SplitSettlementPartialBreakdown,
  SplitSettlementStatusBadges,
  splitRowShowsSettlement,
  type SplitSettlementCopy,
} from '@/components/menu/SplitSettlementStatusExtras';
import { customerInlineEditInputClass } from '@/components/menu/customer-form-input-styles';

type SplitModeCopy = SplitSettlementCopy & {
  splitMode: string;
  splitPlanLocked: string;
  people: string;
  splitResult: string;
};

interface Props {
  lang: UILanguage;
  copy: SplitModeCopy;
  splitGuidance: GuestSplitGuidanceCopy;
  splitMode: SplitMode | null;
  splitLocked: boolean;
  submitting: boolean;
  personCount: number;
  splitPeople: SplitPersonSlot[];
  results: SplitResult[];
  splitDisplayRows: CustomerSplitRowDisplay[];
  lockedPersonNames: ReadonlySet<string>;
  lockedPersonLineMins: LockedPersonLineMins;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  consumerRoster: string[];
  byItemProgress: { complete: number; total: number };
  byItemAllocatorLabels: ByItemDishAllocatorLabels & { byItemProgress: string };
  itemCodeByMenuId?: Record<string, string>;
  splitValidationMessage: string | null;
  guestName: (n: number) => string;
  editingSplitNameIndex: number | null;
  editingSplitNameValue: string;
  onSplitModeClick: (mode: SplitMode) => void;
  /**
   * Individual-checkout session: one shared plan, so only「按菜分单」is offered and the
   * paid-lock notice does not apply.
   */
  individualMode?: boolean;
  onDecrementPersonCount: () => void;
  onIncrementPersonCount: () => void;
  onAllocationChange: (key: string, rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
  onStartInlineRename: (index: number) => void;
  onCommitInlineRename: (index: number) => void;
  onEditingSplitNameValueChange: (value: string) => void;
  onCancelInlineRename: () => void;
  /** Staff even row collect. Guest omits this. */
  staffRowActions?: {
    collectLabel: string;
    busy: boolean;
    onCollect: (index: number) => void;
    /** Bill-level % — row € shows 折后; optional 折前 line when > 0. */
    discountRate?: number;
    /** Template `折前 €{amount}` when discount active. */
    discountPreLabel?: string;
  };
  /**
   * Staff checkout injects Fatura-like by-item workbench here.
   * Guest BillPage omits this → sole guest UI remains ByItemSplitSection.
   */
  byItemContent?: ReactNode;
}

/**
 * Inline rename opens focused with the name selected, so typing replaces it.
 * Stable module ref → runs once on mount.
 */
function focusAndSelectOnMount(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  input.select();
}

export function BillSplitPanel({
  lang,
  copy,
  splitGuidance,
  splitMode,
  splitLocked,
  submitting,
  personCount,
  results,
  splitDisplayRows,
  lockedPersonNames,
  lockedPersonLineMins,
  lineSpecs,
  orderLines,
  byItemAllocations,
  consumerRoster,
  byItemProgress,
  byItemAllocatorLabels,
  itemCodeByMenuId = {},
  splitValidationMessage,
  guestName,
  editingSplitNameIndex,
  editingSplitNameValue,
  onSplitModeClick,
  individualMode = false,
  onDecrementPersonCount,
  onIncrementPersonCount,
  onAllocationChange,
  onRememberConsumerName,
  onStartInlineRename,
  onCommitInlineRename,
  onEditingSplitNameValueChange,
  onCancelInlineRename,
  staffRowActions,
  byItemContent,
}: Props) {
  const selectedWhen =
    splitMode === 'even' || splitMode === 'by_item'
      ? splitGuidance.modes[splitMode].when
      : null;

  return (
    <>
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{copy.splitMode}</h2>
        <div className={`grid gap-2 mb-4 ${individualMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {GUEST_SPLIT_MODE_ORDER.filter((mode) => !individualMode || mode === 'by_item').map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={submitting || splitLocked}
              onClick={() => onSplitModeClick(mode)}
              className={`py-2.5 rounded-xl text-sm border transition-all ${
                splitMode === mode
                  ? `${mesaSelectionChipStrongClass(true)} font-semibold`
                  : mesaSelectionChipStrongClass(false)
              }`}
            >
              {splitGuidance.modes[mode].label}
            </button>
          ))}
        </div>
        {splitLocked && !individualMode ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{copy.splitPlanLocked}</p>
        ) : null}
        {!splitMode && !splitLocked ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{splitGuidance.optionalHint}</p>
        ) : null}
        {selectedWhen && !splitLocked ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{selectedWhen}</p>
        ) : null}

        {splitMode === 'even' ? (
          <div className="flex items-center gap-4 mb-4">
            <span className="text-brand-text-muted text-sm">{copy.people}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={splitLocked}
                onClick={onDecrementPersonCount}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >
                −
              </button>
              <span className="text-xl font-semibold tabular-nums text-brand-gold">{personCount}</span>
              <button
                type="button"
                disabled={splitLocked}
                onClick={onIncrementPersonCount}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        {splitMode === 'by_item' ? (
          byItemContent ?? (
            <ByItemSplitSection
              lang={lang}
              lineSpecs={lineSpecs}
              orderLines={orderLines}
              byItemAllocations={byItemAllocations}
              consumerRoster={consumerRoster}
              labels={byItemAllocatorLabels}
              itemCodeByMenuId={itemCodeByMenuId}
              progress={byItemProgress}
              lockedPersonLineMins={lockedPersonLineMins}
              onAllocationChange={onAllocationChange}
              onRememberConsumerName={onRememberConsumerName}
            />
          )
        ) : null}
      </div>

      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{copy.splitResult}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {results.map((r, i) => {
            const settlementRow = splitDisplayRows[i];
            /** Rename lock — collection history by name. Not collect gate. */
            const nameLocked =
              splitLocked && lockedPersonNames.has(r.name.trim().toLowerCase());
            /** Even 收款: sole gate is per-index settlement outstanding (not name lock). */
            const canCollectShare =
              settlementRow != null && isSplitSettlementPending(settlementRow);
            const showStaffCollect = Boolean(staffRowActions && canCollectShare);
            const showSettlement = settlementRow != null && splitRowShowsSettlement(settlementRow);
            const settledAmount = showSettlement && settlementRow
              ? splitSettlementCollectAmount(settlementRow)
              : null;
            const preAmount = r.amount;
            const discountRate = staffRowActions?.discountRate ?? 0;
            const allocated =
              settledAmount != null
                ? settledAmount
                : settlementRow?.obligationAmount;
            const shareDisplay = resolveCheckoutDiscountedShareDisplay(
              preAmount,
              settledAmount != null ? 0 : discountRate,
              settledAmount != null ? settledAmount : allocated,
            );
            const amountBlock = (
              <span className="shrink-0 text-right">
                <span className="text-brand-gold font-medium tabular-nums">
                  €{shareDisplay.displayAmount.toFixed(2)}
                </span>
                {shareDisplay.showPreLine && staffRowActions?.discountPreLabel ? (
                  <span className="block text-[11px] font-normal text-brand-text-muted tabular-nums">
                    {staffRowActions.discountPreLabel.replace(
                      '{amount}',
                      shareDisplay.preAmount.toFixed(2),
                    )}
                  </span>
                ) : null}
              </span>
            );
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-3"
              >
                <div className="min-w-0 flex-1">
                  {splitMode && (splitMode === 'even' || splitMode === 'by_item') ? (
                    editingSplitNameIndex === i ? (
                      <input
                        type="text"
                        ref={focusAndSelectOnMount}
                        value={editingSplitNameValue}
                        onChange={(e) => onEditingSplitNameValueChange(e.target.value)}
                        onBlur={() => onCommitInlineRename(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onCommitInlineRename(i);
                          }
                          if (e.key === 'Escape') {
                            onCancelInlineRename();
                          }
                        }}
                        className={customerInlineEditInputClass}
                        placeholder={guestName(i + 1)}
                      />
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {nameLocked ? (
                            <span className="text-brand-text text-sm">{localizeSplitPersonName(r.name, lang)}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onStartInlineRename(i)}
                              className="text-brand-text text-sm hover:text-brand-gold transition-colors"
                            >
                              {localizeSplitPersonName(r.name, lang)}
                            </button>
                          )}
                          {showSettlement && settlementRow ? (
                            <SplitSettlementStatusBadges row={settlementRow} copy={copy} />
                          ) : null}
                        </div>
                        {showSettlement && settlementRow ? (
                          <SplitSettlementPartialBreakdown row={settlementRow} copy={copy} />
                        ) : null}
                      </div>
                    )
                  ) : (
                    <span className="text-brand-text text-sm">{localizeSplitPersonName(r.name, lang)}</span>
                  )}
                </div>
                {amountBlock}
                {showStaffCollect && staffRowActions ? (
                  <button
                    type="button"
                    disabled={staffRowActions.busy}
                    onClick={() => staffRowActions.onCollect(i)}
                    className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg bg-brand-gold text-white disabled:opacity-50"
                  >
                    {staffRowActions.collectLabel}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {splitValidationMessage ? (
        <p className="px-4 pb-2 text-[13px] text-red-500">{splitValidationMessage}</p>
      ) : null}
    </>
  );
}
