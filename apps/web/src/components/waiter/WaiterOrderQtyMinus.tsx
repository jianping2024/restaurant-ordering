'use client';

type Props = {
  onDecrement: () => void;
  disabled?: boolean;
  busy?: boolean;
};

/** Minus-only control for waiter table order lines (no increment). */
export function WaiterOrderQtyMinus({ onDecrement, disabled = false, busy = false }: Props) {
  return (
    <button
      type="button"
      onClick={onDecrement}
      disabled={disabled || busy}
      aria-label="Decrease quantity"
      className="w-7 h-7 shrink-0 rounded-full bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-gold/20 disabled:opacity-50"
    >
      −
    </button>
  );
}
