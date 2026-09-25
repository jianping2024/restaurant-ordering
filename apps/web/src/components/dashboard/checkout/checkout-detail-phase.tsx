'use client';

import type { SplitMode } from '@/types';

export type CheckoutDetailPhase = 'path_chooser' | 'split_edit' | 'settle';

/** Sole staff path choice while whole_table + zero collected (before settle). */
export type StaffCheckoutPathChoice = 'undecided' | 'whole_table' | 'split';

/** Sole phase resolver for checkout detail staff path / split edit / settle. */
export function resolveCheckoutDetailPhase(input: {
  splitMode: SplitMode | string;
  collected: number;
  pathChoice: StaffCheckoutPathChoice;
}): CheckoutDetailPhase {
  const mode = input.splitMode;
  if (mode === 'even' || mode === 'by_item' || mode === 'custom') return 'split_edit';
  if (mode === 'whole_table' && input.collected <= 0) {
    if (input.pathChoice === 'split') return 'split_edit';
    if (input.pathChoice === 'whole_table') return 'settle';
    return 'path_chooser';
  }
  return 'settle';
}

/**
 * Sole gate for path-back「取消」: still whole_table, zero collected,
 * and staff has already left path_chooser (whole_table settle or split_edit).
 */
export function canReturnToCheckoutPathChooser(input: {
  splitMode: SplitMode | string;
  collected: number;
  pathChoice: StaffCheckoutPathChoice;
}): boolean {
  if (input.splitMode !== 'whole_table' || input.collected > 0) return false;
  return input.pathChoice === 'whole_table' || input.pathChoice === 'split';
}

/**
 * Sole close gate for a split checkout.
 * By-item: leftover pool empty and every payable person paid.
 * Even/custom: every person with amount &gt; 0 paid. Whole table is unchanged.
 */
export function checkoutSplitCloseAllowed(input: {
  splitMode: SplitMode | string | null;
  byItemComplete: boolean;
  rows: Array<{ amount: number; paid: boolean }>;
}): boolean {
  const mode = input.splitMode;
  if (mode !== 'even' && mode !== 'custom' && mode !== 'by_item') return true;
  const payableSettled = input.rows.every((row) => row.amount <= 0.001 || row.paid);
  if (mode === 'by_item') return input.byItemComplete && payableSettled;
  return payableSettled;
}

type PathChooserProps = {
  wholeTableLabel: string;
  splitLabel: string;
  resumeLabel: string;
  onWholeTable: () => void;
  onSplit: () => void;
  onResume: () => void;
};

export function CheckoutPathChooser({
  wholeTableLabel,
  splitLabel,
  resumeLabel,
  onWholeTable,
  onSplit,
  onResume,
}: PathChooserProps) {
  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onWholeTable}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-gold text-white"
        >
          {wholeTableLabel}
        </button>
        <button
          type="button"
          onClick={onSplit}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30"
        >
          {splitLabel}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30"
        >
          {resumeLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Sole path-back「取消」control for whole_table settle footer + split_edit.
 */
export function CheckoutPathChooserBackButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
    >
      {props.label}
    </button>
  );
}
