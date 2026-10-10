'use client';

import { useState, type ReactNode } from 'react';
import type { SplitPersonSlot } from '@/lib/use-bill-split-draft';
import { localizeSplitPersonName } from '@/lib/split-person-label';
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
import { CHECKOUT_COLLECT_BUTTON_CLASS } from '@/lib/checkout-amount-type';
import { Button } from '@/components/ui/Button';

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
  /** Mode chips only — defaults to splitLocked when omitted (guest). */
  modeChipsLocked?: boolean;
  submitting: boolean;
  personCount: number;
  splitPeople: SplitPersonSlot[];
  results: SplitResult[];
  splitDisplayRows: CustomerSplitRowDisplay[];
  lockedPersonNames: ReadonlySet<string>;
  splitValidationMessage: string | null;
  guestName: (n: number) => string;
  editingSplitNameIndex: number | null;
  editingSplitNameValue: string;
  onSplitModeClick: (mode: SplitMode) => void;
  onDecrementPersonCount: () => void;
  onIncrementPersonCount: () => void;
  onStartInlineRename: (index: number) => void;
  onCommitInlineRename: (index: number) => void;
  onEditingSplitNameValueChange: (value: string) => void;
  onCancelInlineRename: () => void;
  /** Staff even row collect. */
  staffRowActions?: {
    collectLabel: string;
    busy: boolean;
    onCollect: (index: number) => void;
    /** Bill-level % — row € shows 折后; optional 折前 line when > 0. */
    discountRate?: number;
    /** Template `折前 €{amount}` when discount active. */
    discountPreLabel?: string;
  };
  /** Staff by-item workbench (Fatura-like) — the sole by-item editor in this panel. */
  byItemContent?: ReactNode;
  /**
   * Phone-only per-row detail (e.g. the person's allocated dishes) under「分单结果」.
   * Omitted → no toggle and the row renders exactly as before (guest, even, desktop).
   */
  rowDetail?: {
    expandLabel: string;
    collapseLabel: string;
    render: (row: SplitResult, index: number) => ReactNode;
  };
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
  modeChipsLocked,
  submitting,
  personCount,
  results,
  splitDisplayRows,
  lockedPersonNames,
  splitValidationMessage,
  guestName,
  editingSplitNameIndex,
  editingSplitNameValue,
  onSplitModeClick,
  onDecrementPersonCount,
  onIncrementPersonCount,
  onStartInlineRename,
  onCommitInlineRename,
  onEditingSplitNameValueChange,
  onCancelInlineRename,
  staffRowActions,
  byItemContent,
  rowDetail,
}: Props) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<ReadonlySet<string>>(new Set());
  const chipsLocked = modeChipsLocked ?? splitLocked;
  const selectedWhen =
      splitMode === 'even' || splitMode === 'by_item'
      ? splitGuidance.modes[splitMode].when
      : null;

  return (
    <>
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{copy.splitMode}</h2>
        <div className="grid gap-2 mb-4 grid-cols-3">
          {GUEST_SPLIT_MODE_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={submitting || chipsLocked}
              onClick={() => onSplitModeClick(mode)}
              className={`py-2.5 rounded-xl text-sm border transition-all ${
                splitMode === mode || (mode === 'whole_table' && splitMode == null)
                  ? `${mesaSelectionChipStrongClass(true)} font-semibold`
                  : mesaSelectionChipStrongClass(false)
              }`}
            >
              {splitGuidance.modes[mode].label}
            </button>
          ))}
        </div>
        {chipsLocked ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{copy.splitPlanLocked}</p>
        ) : null}
        {(splitMode === 'whole_table' || splitMode == null) && !splitLocked ? (
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

        {splitMode === 'by_item' ? byItemContent : null}
      </div>

      {results.length > 0 ? (
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
            const rowKey = r.party_id ?? r.name;
            const rowExpanded = rowDetail != null && expandedRowKeys.has(rowKey);
            return (
              <div key={i} className="border-b border-brand-border last:border-0">
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                {rowDetail ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRowKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(rowKey)) next.delete(rowKey);
                        else next.add(rowKey);
                        return next;
                      })
                    }
                    className="md:hidden -ml-1 flex h-6 w-6 shrink-0 items-center justify-center text-brand-text-muted transition-colors hover:text-brand-text"
                    aria-expanded={rowExpanded}
                    aria-label={rowExpanded ? rowDetail.collapseLabel : rowDetail.expandLabel}
                  >
                    <span aria-hidden>{rowExpanded ? '▾' : '▸'}</span>
                  </button>
                ) : null}
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
                  <Button
                    type="button"
                    size="action"
                    disabled={staffRowActions.busy}
                    onClick={() => staffRowActions.onCollect(i)}
                    className={`shrink-0 ${CHECKOUT_COLLECT_BUTTON_CLASS}`}
                  >
                    {staffRowActions.collectLabel}
                  </Button>
                ) : null}
              </div>
              {rowDetail && rowExpanded ? (
                <div className="md:hidden border-t border-brand-border/60 bg-brand-bg/40 px-4 py-1">
                  {rowDetail.render(r, i)}
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      </div>
      ) : null}

      {splitValidationMessage ? (
        <p className="px-4 pb-2 text-[13px] text-red-500">{splitValidationMessage}</p>
      ) : null}
    </>
  );
}
