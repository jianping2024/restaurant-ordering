'use client';

import { useEffect, useRef, useState } from 'react';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { RowRemoveIconButton } from '@/components/menu/RowRemoveIconButton';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { RightPushPanel } from '@/components/ui/RightPushPanel';
import {
  TAKEAWAY_LINE_NAME,
  TAKEAWAY_LINES_MAX,
  TAKEAWAY_QTY_MAX,
  parseTakeawayAmount,
  type TakeawayLineInput,
} from '@/lib/checkout-takeaway';
import { normalizeDecimalInput } from '@/lib/number-input';

type Labels = {
  title: string;
  name: string;
  amount: string;
  qty: string;
  lineTotal: string;
  addRow: string;
  removeRow: string;
  total: string;
  invalidAmount: string;
  confirm: string;
  cancel: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  labels: Labels;
  onClose: () => void;
  onConfirm: (lines: TakeawayLineInput[]) => void | Promise<void>;
};

type Row = { key: number; raw: string; qty: number };

/** Controls row under the fixed name: unit price | qty | subtotal | trash. */
const CONTROLS_GRID =
  'grid grid-cols-[minmax(5.5rem,1fr)_auto_minmax(4rem,auto)_auto] items-center gap-x-2';

/** Sole checkout take-away editor: right-push panel, unit price + qty, read-only line total. */
export function CheckoutTakeawayModal({ open, busy, labels, onClose, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>([{ key: 0, raw: '', qty: 1 }]);
  const nextKey = useRef(1);
  const focusKey = useRef<number | null>(0);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  useEffect(() => {
    if (!open) return;
    nextKey.current = 1;
    focusKey.current = 0;
    setRows([{ key: 0, raw: '', qty: 1 }]);
  }, [open]);

  useEffect(() => {
    const key = focusKey.current;
    if (key == null) return;
    const el = inputs.current.get(key);
    if (!el) return;
    focusKey.current = null;
    el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }, [rows]);

  const parsed = rows.map((row) => ({
    amount: parseTakeawayAmount(row.raw),
    qty: row.qty,
  }));
  const allValid = parsed.every((line) => line.amount != null && line.qty >= 1);
  const total = parsed.reduce(
    (sum, line) => sum + (line.amount != null ? line.amount * line.qty : 0),
    0,
  );

  const addRow = () => {
    if (rows.length >= TAKEAWAY_LINES_MAX) return;
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((prev) => [...prev, { key, raw: '', qty: 1 }]);
  };

  const setQty = (key: number, qty: number) => {
    const next = Math.min(TAKEAWAY_QTY_MAX, Math.max(1, Math.floor(qty) || 1));
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, qty: next } : r)));
  };

  return (
    <RightPushPanel
      open={open}
      title={labels.title}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      closeDisabled={busy}
      width="form"
      titleId="checkout-takeaway-panel-title"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className={`hidden text-[13px] text-brand-text-muted sm:grid ${CONTROLS_GRID} px-0`}>
            <span>{labels.amount}</span>
            <span className="text-center">{labels.qty}</span>
            <span className="text-right">{labels.lineTotal}</span>
            <span className="w-11" aria-hidden />
          </div>
          {rows.map((row, index) => {
            const amount = parsed[index]?.amount ?? null;
            const invalid = row.raw !== '' && amount == null;
            const lineTotal = amount != null ? amount * row.qty : 0;
            return (
              <div
                key={row.key}
                className="space-y-1.5 border-b border-brand-border/40 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-brand-text">
                    {TAKEAWAY_LINE_NAME}
                  </span>
                  <span className="sr-only">{labels.name}</span>
                </div>
                <div className={CONTROLS_GRID}>
                  <label className="flex min-w-0 items-center rounded-lg border border-brand-border bg-brand-bg px-2 focus-within:ring-2 focus-within:ring-brand-gold/40">
                    <span className="text-brand-text-muted">€</span>
                    <input
                      ref={(el) => {
                        if (el) inputs.current.set(row.key, el);
                        else inputs.current.delete(row.key);
                      }}
                      value={row.raw}
                      onChange={(e) => {
                        const raw = normalizeDecimalInput(e.target.value);
                        setRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, raw } : r)),
                        );
                      }}
                      disabled={busy}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      aria-label={labels.amount}
                      className="w-full min-w-0 bg-transparent py-2 text-right text-base font-semibold tabular-nums text-brand-text focus:outline-none"
                    />
                  </label>
                  <CartQtyStepper
                    qty={row.qty}
                    density="compact"
                    disabled={busy}
                    max={TAKEAWAY_QTY_MAX}
                    onDecrement={() => {
                      if (row.qty <= 1) return;
                      setQty(row.key, row.qty - 1);
                    }}
                    onIncrement={() => setQty(row.key, row.qty + 1)}
                  />
                  <span className="text-right text-sm font-semibold tabular-nums text-brand-text">
                    €{lineTotal.toFixed(2)}
                  </span>
                  <RowRemoveIconButton
                    large
                    removable={rows.length > 1}
                    disabled={busy}
                    ariaLabel={labels.removeRow}
                    onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  />
                </div>
                {invalid ? (
                  <p className="text-[12px] text-red-500">{labels.invalidAmount}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 space-y-3 border-t border-brand-border px-4 py-3">
          <p className="text-sm text-brand-text-muted">
            {labels.total
              .replace('{n}', String(rows.length))
              .replace('{amount}', total.toFixed(2))}
          </p>
          <button
            type="button"
            onClick={addRow}
            disabled={busy || rows.length >= TAKEAWAY_LINES_MAX}
            className="w-full rounded-xl border border-dashed border-brand-gold/50 py-2.5 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:opacity-40"
          >
            {labels.addRow}
          </button>
          <ModalConfirmActions
            cancelLabel={labels.cancel}
            confirmLabel={labels.confirm}
            onCancel={() => {
              if (busy) return;
              onClose();
            }}
            onConfirm={() => {
              if (busy || !allValid) return;
              void onConfirm(
                parsed.map((line) => ({
                  amount: line.amount as number,
                  qty: line.qty,
                })),
              );
            }}
            busy={busy}
            confirmDisabled={!allValid}
          />
        </div>
      </div>
    </RightPushPanel>
  );
}
