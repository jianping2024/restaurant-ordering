'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import {
  focusByItemConsumerNameInCard,
  shouldFocusFirstByItemConsumerNameOnExpand,
} from '@/lib/by-item-line-expansion';
import { useByItemLineExpansion } from '@/lib/use-by-item-line-expansion';
import {
  formatByItemSplitQuantityLabel,
  type BillSplitOrderLine,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item-lines';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import type { UILanguage } from '@/lib/i18n';
import type { LockedPersonLineMins } from '@/lib/checkout-split-continuation';
import { ByItemDishAllocator, type ByItemDishAllocatorLabels } from '@/components/menu/ByItemDishAllocator';

interface Props {
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  consumerRoster: string[];
  labels: ByItemDishAllocatorLabels & { byItemProgress: string };
  itemCodeByMenuId?: Record<string, string>;
  lockedPersonLineMins?: LockedPersonLineMins;
  onAllocationChange: (key: string, rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
  progress: { complete: number; total: number };
}

export function ByItemSplitSection({
  lang,
  lineSpecs,
  orderLines,
  byItemAllocations,
  consumerRoster,
  labels,
  itemCodeByMenuId = {},
  lockedPersonLineMins,
  onAllocationChange,
  onRememberConsumerName,
  progress,
}: Props) {
  const {
    expandedKey,
    holdWhileEditing,
    isLineExpanded,
    toggleLineExpanded,
    onExpandedCardFocusIn,
    onExpandedCardFocusOut,
  } = useByItemLineExpansion(lineSpecs, byItemAllocations);
  const prevExpandedKeyRef = useRef<string | null | undefined>(undefined);

  useLayoutEffect(() => {
    // Do not scroll/focus while the open card is mid-edit — that fights the soft keyboard.
    if (holdWhileEditing) {
      prevExpandedKeyRef.current = expandedKey;
      return;
    }
    const previous = prevExpandedKeyRef.current;
    if (!expandedKey || expandedKey === previous) {
      prevExpandedKeyRef.current = expandedKey;
      return;
    }
    const focusName = shouldFocusFirstByItemConsumerNameOnExpand(previous, expandedKey);
    prevExpandedKeyRef.current = expandedKey;
    const card = document.querySelector<HTMLElement>(
      `[data-by-item-line-key="${CSS.escape(expandedKey)}"]`,
    );
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focusName) {
      focusByItemConsumerNameInCard(expandedKey);
    }
  }, [expandedKey, holdWhileEditing]);

  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );

  return (
    <div
      className="space-y-3"
      onFocusCapture={onExpandedCardFocusIn}
      onBlurCapture={onExpandedCardFocusOut}
    >
      {progress.total > 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-brand-text-muted text-[13px]">{labels.byItemProgress}</span>
            <span
              className={`text-[13px] font-medium tabular-nums ${
                progress.complete === progress.total ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {progress.complete} / {progress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
            <div
              className={`h-full transition-all ${
                progress.complete === progress.total ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{
                width: `${Math.round((progress.complete / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {lineSpecs.map((spec) => {
        const item = orderLineByKey[spec.key];
        if (!item) return null;
        const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
        const lineLabel = formatLocalizedMenuItemLabel(item, lang, itemCode);
        return (
          <ByItemDishAllocator
            key={spec.key}
            spec={spec}
            rows={byItemAllocations[spec.key] ?? []}
            consumerRoster={consumerRoster}
            labels={labels}
            lockedPersonLineMins={lockedPersonLineMins}
            expanded={isLineExpanded(spec.key)}
            onToggleExpand={() => toggleLineExpanded(spec.key)}
            onChange={(rows) => onAllocationChange(spec.key, rows)}
            onRememberConsumerName={onRememberConsumerName}
            title={(
              <>
                {lineLabel} {formatByItemSplitQuantityLabel(spec, item)}
              </>
            )}
          />
        );
      })}
    </div>
  );
}
