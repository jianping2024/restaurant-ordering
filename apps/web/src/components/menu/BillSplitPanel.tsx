'use client';

import { useMemo } from 'react';
import type { ByItemDishAllocatorLabels } from '@/components/menu/ByItemDishAllocator';
import { ByItemSplitSection } from '@/components/menu/ByItemSplitSection';
import type { PersonAmount, SplitPersonSlot } from '@/lib/use-bill-split-draft';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import { normalizeDecimalInput as normalizeAmountInput } from '@/lib/number-input';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { LockedPersonLineMins } from '@/lib/checkout-split-continuation';
import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import { splitRowDisplayAmount } from '@/lib/customer-bill-split-display';
import type { UILanguage } from '@/lib/i18n';
import type { SplitMode, SplitResult } from '@/types';
import {
  SplitSettlementPartialBreakdown,
  SplitSettlementStatusBadges,
  splitRowShowsSettlement,
  type SplitSettlementCopy,
} from '@/components/menu/SplitSettlementStatusExtras';
import {
  customerInlineAmountInputClass,
  customerInlineEditInputClass,
} from '@/components/menu/customer-form-input-styles';

type SplitModeCopy = SplitSettlementCopy & {
  splitMode: string;
  even: string;
  byItem: string;
  custom: string;
  splitPlanLocked: string;
  splitOptionalHint: string;
  people: string;
  splitResult: string;
  addPerson: string;
};

interface Props {
  lang: UILanguage;
  copy: SplitModeCopy;
  splitMode: SplitMode | null;
  splitLocked: boolean;
  submitting: boolean;
  personCount: number;
  splitPeople: SplitPersonSlot[];
  customAmounts: PersonAmount[];
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
  editingCustomAmountIndex: number | null;
  editingCustomAmountValue: string;
  onSplitModeClick: (mode: SplitMode) => void;
  onDecrementPersonCount: () => void;
  onIncrementPersonCount: () => void;
  onAllocationChange: (key: string, rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
  onStartInlineRename: (index: number) => void;
  onCommitInlineRename: (index: number) => void;
  onEditingSplitNameValueChange: (value: string) => void;
  onCancelInlineRename: () => void;
  onStartInlineAmountEdit: (index: number) => void;
  onCommitInlineAmountEdit: (index: number) => void;
  onEditingCustomAmountValueChange: (value: string) => void;
  onCancelInlineAmountEdit: () => void;
  onAddCustomPerson: () => void;
}

export function BillSplitPanel({
  lang,
  copy,
  splitMode,
  splitLocked,
  submitting,
  personCount,
  customAmounts,
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
  editingCustomAmountIndex,
  editingCustomAmountValue,
  onSplitModeClick,
  onDecrementPersonCount,
  onIncrementPersonCount,
  onAllocationChange,
  onRememberConsumerName,
  onStartInlineRename,
  onCommitInlineRename,
  onEditingSplitNameValueChange,
  onCancelInlineRename,
  onStartInlineAmountEdit,
  onCommitInlineAmountEdit,
  onEditingCustomAmountValueChange,
  onCancelInlineAmountEdit,
  onAddCustomPerson,
}: Props) {
  const modeButtons = useMemo(
    () =>
      ([
        ['even', copy.even],
        ['by_item', copy.byItem],
        ['custom', copy.custom],
      ] as const),
    [copy.byItem, copy.custom, copy.even],
  );

  return (
    <>
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{copy.splitMode}</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {modeButtons.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={submitting || splitLocked}
              onClick={() => onSplitModeClick(mode)}
              className={`py-2.5 rounded-xl text-sm transition-all ${
                splitMode === mode
                  ? 'bg-brand-gold text-brand-on-gold font-semibold'
                  : 'bg-brand-card border border-brand-border text-brand-text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {splitLocked ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{copy.splitPlanLocked}</p>
        ) : null}
        {!splitMode && !splitLocked ? (
          <p className="text-brand-text-muted text-[13px] mb-2">{copy.splitOptionalHint}</p>
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
              <span className="font-heading text-xl text-brand-gold">{personCount}</span>
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
        ) : null}
      </div>

      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{copy.splitResult}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {results.map((r, i) => {
            const settlementRow = splitDisplayRows[i];
            const rowPaid = splitLocked && lockedPersonNames.has(r.name.trim().toLowerCase());
            const showSettlement = settlementRow != null && splitRowShowsSettlement(settlementRow);
            const settledAmount = showSettlement && settlementRow
              ? splitRowDisplayAmount(settlementRow)
              : null;
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-3"
              >
                <div className="min-w-0 flex-1">
                  {splitMode && (splitMode === 'even' || splitMode === 'by_item' || splitMode === 'custom') ? (
                    editingSplitNameIndex === i ? (
                      <input
                        type="text"
                        autoFocus
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
                          {rowPaid ? (
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
                {splitMode === 'custom' ? (
                  i === customAmounts.length - 1 ? (
                    <span className="text-brand-gold font-medium shrink-0">
                      €{(settledAmount ?? r.amount).toFixed(2)}
                    </span>
                  ) : editingCustomAmountIndex === i ? (
                    <div className="flex items-center justify-end text-brand-gold font-medium text-sm min-w-[92px] shrink-0">
                      <span className="mr-1">€</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={editingCustomAmountValue}
                        onChange={(e) => onEditingCustomAmountValueChange(normalizeAmountInput(e.target.value))}
                        onBlur={() => onCommitInlineAmountEdit(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onCommitInlineAmountEdit(i);
                          }
                          if (e.key === 'Escape') {
                            onCancelInlineAmountEdit();
                          }
                        }}
                        className={customerInlineAmountInputClass}
                        placeholder="0.00"
                      />
                    </div>
                  ) : rowPaid ? (
                    <span className="text-brand-gold font-medium shrink-0">
                      €{(settledAmount ?? customAmounts[i]?.amount ?? 0).toFixed(2)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStartInlineAmountEdit(i)}
                      className="text-brand-gold font-medium hover:text-brand-gold-light transition-colors shrink-0"
                    >
                      €{customAmounts[i]?.amount.toFixed(2) || '0.00'}
                    </button>
                  )
                ) : (
                  <span className="text-brand-gold font-medium shrink-0">
                    €{(settledAmount ?? r.amount).toFixed(2)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {splitMode === 'custom' && !splitLocked ? (
          <button
            type="button"
            onClick={onAddCustomPerson}
            className="mt-3 w-full text-brand-text-muted text-sm py-2 border border-dashed border-brand-border rounded-xl hover:border-brand-gold/50 transition-colors"
          >
            + {copy.addPerson}
          </button>
        ) : null}
      </div>

      {splitValidationMessage ? (
        <p className="px-4 pb-2 text-[13px] text-red-500">{splitValidationMessage}</p>
      ) : null}
    </>
  );
}
