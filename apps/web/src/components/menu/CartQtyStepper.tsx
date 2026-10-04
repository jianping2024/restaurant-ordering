'use client';

import { IntegerInput } from '@/components/ui/IntegerInput';
import {
  CART_QTY_STEPPER_GAP_CLASS,
  type CartQtyStepperDensity,
} from '@/lib/cart-qty-stepper-layout';

export type { CartQtyStepperDensity };

type Props = {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Editable qty field (cart drawer / waiter). Omit for read-only display (detail / sushi review). */
  onQtyChange?: (qty: number) => void;
  qtyInputAriaLabel?: string;
  incrementDisabled?: boolean;
  /** Upper bound: `+` disables and typed qty clamps at it (dish lines pass APPEND_CART_QTY_MAX). */
  max?: number;
  /** Freeze − / qty / + (session-write mutex). */
  disabled?: boolean;
  /**
   * Horizontal density. Cart drawer uses `compact`.
   * Detail / waiter / sushi review keep `default`.
   */
  density?: CartQtyStepperDensity;
};

/** Compact − qty + stepper (cart drawer, detail, waiter, sushi review). */
export function CartQtyStepper({
  qty,
  onDecrement,
  onIncrement,
  onQtyChange,
  qtyInputAriaLabel,
  incrementDisabled,
  max,
  disabled = false,
  density = 'default',
}: Props) {
  return (
    <div className={`flex shrink-0 items-center ${CART_QTY_STEPPER_GAP_CLASS[density]}`}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-border text-brand-text hover:bg-brand-gold/20 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        −
      </button>
      {onQtyChange ? (
        <IntegerInput
          value={qty}
          onChange={onQtyChange}
          min={0}
          max={max}
          clearZeroOnFocus
          disabled={disabled}
          aria-label={qtyInputAriaLabel ?? 'Quantity'}
          className="w-8 shrink-0 text-brand-text text-base text-center tabular-nums bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-brand-gold/40 rounded disabled:opacity-40"
        />
      ) : (
        <span className="min-w-[1.25rem] shrink-0 text-center text-base font-semibold tabular-nums text-brand-text">
          {qty}
        </span>
      )}
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled || incrementDisabled || (max != null && qty >= max)}
        aria-label="Increase quantity"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-border text-brand-text hover:bg-brand-gold/20 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        +
      </button>
    </div>
  );
}
