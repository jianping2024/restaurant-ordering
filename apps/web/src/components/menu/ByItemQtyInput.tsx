'use client';

import {
  getQtyPartsRowHint,
  sanitizeQtyDigits,
  type ByItemConsumerRow,
  type QtyPartsLabels,
} from '@/lib/bill-split-by-item';
import {
  customerQtyInputAlertClass,
  customerQtyInputClass,
} from '@/components/menu/customer-form-input-styles';

type QtyField = 'qtyWhole' | 'qtyNum' | 'qtyDen';

interface Props {
  row: ByItemConsumerRow;
  labels: QtyPartsLabels;
  /** Line-level over-allocation; field-part issues are owned inside this control. */
  overAllocated?: boolean;
  onChange: (patch: Pick<ByItemConsumerRow, QtyField>) => void;
  onCommit?: () => void;
}

export function ByItemQtyColumnHeader({ labels }: { labels: QtyPartsLabels }) {
  return (
    <div
      className="shrink-0 text-[11px] text-brand-text-muted text-center leading-tight whitespace-nowrap select-none"
      aria-hidden
    >
      {labels.wholeLabel}
      {' + '}
      {labels.numLabel}
      {' / '}
      {labels.denLabel}
    </div>
  );
}

export function ByItemQtyInput({
  row,
  labels,
  overAllocated = false,
  onChange,
  onCommit,
}: Props) {
  const hint = getQtyPartsRowHint(row, labels);
  const fieldClass = overAllocated || hint ? customerQtyInputAlertClass : customerQtyInputClass;

  const patchQty = (field: QtyField, raw: string) => {
    const digits = sanitizeQtyDigits(raw);
    onChange({
      qtyWhole: field === 'qtyWhole' ? digits : row.qtyWhole,
      qtyNum: field === 'qtyNum' ? digits : row.qtyNum,
      qtyDen: field === 'qtyDen' ? digits : row.qtyDen,
    });
  };

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyWhole}
          onChange={(e) => patchQty('qtyWhole', e.target.value)}
          onBlur={() => onCommit?.()}
          aria-label={labels.wholeLabel}
          className={`w-9 px-1 ${fieldClass}`}
        />
        <span className="text-brand-text-muted text-[11px] px-0.5">+</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyNum}
          onChange={(e) => patchQty('qtyNum', e.target.value)}
          onBlur={() => onCommit?.()}
          aria-label={labels.numLabel}
          className={`w-7 px-0.5 ${fieldClass}`}
        />
        <span className="text-brand-text-muted text-[12px] px-0.5" aria-hidden>/</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyDen}
          onChange={(e) => patchQty('qtyDen', e.target.value)}
          onBlur={() => onCommit?.()}
          aria-label={labels.denLabel}
          className={`w-7 px-0.5 ${fieldClass}`}
        />
      </div>
      {hint ? (
        <p className="text-[11px] text-red-500 mt-0.5 text-center leading-tight max-w-[9.5rem]">{hint}</p>
      ) : null}
    </div>
  );
}
