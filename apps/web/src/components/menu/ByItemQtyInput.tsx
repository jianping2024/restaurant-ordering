'use client';

import {
  getQtyPartsRowHint,
  sanitizeQtyDigits,
  type ByItemConsumerRow,
  type QtyPartsLabels,
} from '@/lib/bill-split-by-item';

interface Props {
  row: ByItemConsumerRow;
  labels: QtyPartsLabels;
  invalid: boolean;
  onChange: (patch: Pick<ByItemConsumerRow, 'qtyWhole' | 'qtyNum' | 'qtyDen'>) => void;
}

const INPUT_CLASS =
  'bg-brand-bg border rounded-lg py-2 text-[14px] text-brand-text text-center placeholder:text-brand-muted focus:outline-none focus:ring-2 tabular-nums';
const INPUT_OK = `${INPUT_CLASS} border-brand-border focus:ring-brand-gold/40`;
const INPUT_ALERT = `${INPUT_CLASS} border-red-500 focus:ring-red-500/40`;

export function ByItemQtyInput({ row, labels, invalid, onChange }: Props) {
  const hint = getQtyPartsRowHint(row, labels);
  const fieldClass = invalid || hint ? INPUT_ALERT : INPUT_OK;

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
