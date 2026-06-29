'use client';

import { useMemo } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { formatOrderItemQuantityLabel, orderListGuestLabelsFromLang } from '@/lib/order-list-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import type { UILanguage } from '@/lib/i18n';
import { ByItemDishAllocator, type ByItemDishAllocatorLabels } from '@/components/menu/ByItemDishAllocator';

interface Props {
  lang: UILanguage;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  consumerRoster: string[];
  labels: ByItemDishAllocatorLabels & { byItemProgress: string };
  itemCodeByMenuId?: Record<string, string>;
  lockedLineKeys?: ReadonlySet<string>;
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
  lockedLineKeys,
  onAllocationChange,
  onRememberConsumerName,
  progress,
}: Props) {
  const lineQtyLabel = (item: BillSplitOrderLine) =>
    formatOrderItemQuantityLabel(item, {
      headcountStyle: 'localized',
      guestLabels: orderListGuestLabelsFromLang(lang),
    });

  const orderLineByKey = useMemo(
    () => Object.fromEntries(orderLines.map((line) => [line.key, line])),
    [orderLines],
  );

  return (
    <div className="space-y-3">
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
        return (
          <ByItemDishAllocator
            key={spec.key}
            spec={spec}
            rows={byItemAllocations[spec.key] ?? []}
            consumerRoster={consumerRoster}
            labels={labels}
            readOnly={lockedLineKeys?.has(spec.key)}
            onChange={(rows) => onAllocationChange(spec.key, rows)}
            onRememberConsumerName={onRememberConsumerName}
            title={(
              <>
                {item.emoji}{' '}
                {itemCode && (
                  <span className="font-mono text-[11px] text-brand-gold tabular-nums mr-1">[{itemCode}]</span>
                )}
                {(item.name || item.name_pt)} {lineQtyLabel(item)}
              </>
            )}
          />
        );
      })}
    </div>
  );
}
