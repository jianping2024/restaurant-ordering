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

interface Props {
  row: ByItemConsumerRow;
  labels: QtyPartsLabels;
  invalid: boolean;
  onChange: (patch: Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>) => void;
}

export function ByItemQtyInput({ row, labels, invalid, onChange }: Props) {
  const hint = getQtyPartsRowHint(row, labels);
  const fieldClass = invalid || hint ? customerQtyInputAlertClass : customerQtyInputClass;

  const setWhole = (raw: string) => onChange({ qtyWhole: sanitizeQtyDigits(raw), qtyNum: row.qtyNum, qtyDen: row.qtyDen });
  const setNum = (raw: string) => onChange({ qtyWhole: row.qtyWhole, qtyNum: sanitizeQtyDigits(raw), qtyDen: row.qtyDen });
  const setDen = (raw: string) => onChange({ qtyWhole: row.qtyWhole, qtyNum: row.qtyNum, qtyDen: sanitizeQtyDigits(raw) });

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyWhole}
          onChange={(e) => setWhole(e.target.value)}
          placeholder={labels.wholePlaceholder}
          aria-label={labels.wholePlaceholder}
          className={`w-9 px-1 ${fieldClass}`}
        />
        <span className="text-brand-text-muted text-[11px] px-0.5">+</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyNum}
          onChange={(e) => setNum(e.target.value)}
          placeholder={labels.numPlaceholder}
          aria-label={labels.numPlaceholder}
          className={`w-7 px-0.5 ${fieldClass}`}
        />
        <span className="text-brand-text-muted text-[12px] px-0.5" aria-hidden>/</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={row.qtyDen}
          onChange={(e) => setDen(e.target.value)}
          placeholder={labels.denPlaceholder}
          aria-label={labels.denPlaceholder}
          className={`w-7 px-0.5 ${fieldClass}`}
        />
      </div>
      {hint ? (
        <p className="text-[11px] text-red-500 mt-0.5 text-center leading-tight max-w-[108px]">{hint}</p>
      ) : null}
    </div>
  );
}
