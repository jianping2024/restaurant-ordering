'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { TAKEAWAY_LINES_MAX, TAKEAWAY_LINE_NAME, parseTakeawayAmount } from '@/lib/checkout-takeaway';
import { normalizeDecimalInput } from '@/lib/number-input';

type Labels = {
  title: string;
  hint: string;
  name: string;
  amount: string;
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
  onConfirm: (amounts: number[]) => void | Promise<void>;
};

type Row = { key: number; raw: string };

/** Sole checkout take-away editor: fixed name rows, amount only, qty 1. */
export function CheckoutTakeawayModal({ open, busy, labels, onClose, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>([{ key: 0, raw: '' }]);
  const nextKey = useRef(1);
  const focusKey = useRef<number | null>(0);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  useEffect(() => {
    if (!open) return;
    nextKey.current = 1;
    focusKey.current = 0;
    setRows([{ key: 0, raw: '' }]);
  }, [open]);

  // New row scrolls into view with the caret on its amount.
  useEffect(() => {
    const key = focusKey.current;
    if (key == null) return;
    const el = inputs.current.get(key);
    if (!el) return;
    focusKey.current = null;
    el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }, [rows]);

  const amounts = rows.map((row) => parseTakeawayAmount(row.raw));
  const allValid = amounts.every((amount) => amount != null);
  const total = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);

  const addRow = () => {
    if (rows.length >= TAKEAWAY_LINES_MAX) return;
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((prev) => [...prev, { key, raw: '' }]);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      title={labels.title}
      size="md"
      dismissOnBackdrop={!busy}
    >
      <div className="space-y-3">
        <p className="text-sm text-brand-text-muted">{labels.hint}</p>
        <div className="hidden gap-x-2 text-[13px] text-brand-text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_8.5rem_2.75rem]">
          <span>{labels.name}</span>
          <span>{labels.amount}</span>
        </div>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((row, index) => {
            const invalid = row.raw !== '' && amounts[index] == null;
            return (
              <div key={row.key}>
                {/* Narrow: name on its own line, amount + × below; ≥sm: name | amount | × in one row. */}
                <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_8.5rem_2.75rem]">
                  <span className="col-span-2 truncate rounded-lg border border-brand-border bg-brand-border/25 px-3 py-2.5 text-sm text-brand-text-muted sm:col-span-1">
                    {TAKEAWAY_LINE_NAME}
                  </span>
                  <label className="flex items-center rounded-lg border border-brand-border bg-brand-bg px-3 focus-within:ring-2 focus-within:ring-brand-gold/40">
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
                      className="w-full min-w-0 bg-transparent py-2 text-right text-lg font-semibold tabular-nums text-brand-text focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                    disabled={busy || rows.length <= 1}
                    aria-label={labels.removeRow}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-brand-text-muted transition-colors hover:text-red-500 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
                {invalid ? (
                  <p className="mt-1 text-[12px] text-red-500">{labels.invalidAmount}</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={busy || rows.length >= TAKEAWAY_LINES_MAX}
          className="text-sm font-semibold text-brand-gold transition-colors hover:text-brand-gold-dark disabled:opacity-40"
        >
          {labels.addRow}
        </button>
        <p className="text-sm text-brand-text-muted">
          {labels.total
            .replace('{n}', String(rows.length))
            .replace('{amount}', total.toFixed(2))}
        </p>
        <ModalConfirmActions
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirm}
          onCancel={() => {
            if (busy) return;
            onClose();
          }}
          onConfirm={() => {
            if (busy || !allValid) return;
            void onConfirm(amounts as number[]);
          }}
          busy={busy}
          confirmDisabled={!allValid}
          divided
        />
      </div>
    </Modal>
  );
}
