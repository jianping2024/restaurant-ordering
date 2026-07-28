'use client';

import { IntegerInput } from '@/components/ui/IntegerInput';

type Props = {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Editable qty field (cart drawer / waiter). Omit for read-only display (menu list). */
  onQtyChange?: (qty: number) => void;
  qtyInputAriaLabel?: string;
  incrementDisabled?: boolean;
};

/** Compact − qty + stepper (menu list, cart drawer, waiter). */
export function CartQtyStepper({
  qty,
  onDecrement,
  onIncrement,
  onQtyChange,
  qtyInputAriaLabel,
  incrementDisabled,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-border text-brand-text hover:bg-brand-gold/20 active:scale-95"
      >
        −
      </button>
      {onQtyChange ? (
        <IntegerInput
          value={qty}
          onChange={onQtyChange}
          min={0}
          clearZeroOnFocus
          aria-label={qtyInputAriaLabel ?? 'Quantity'}
          className="w-8 text-brand-text text-base text-center tabular-nums bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-brand-gold/40 rounded"
        />
      ) : (
        <span className="min-w-[1.25rem] text-center text-base font-semibold tabular-nums text-brand-text">
          {qty}
        </span>
      )}
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-border text-brand-text hover:bg-brand-gold/20 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        +
      </button>
    </div>
  );
}
