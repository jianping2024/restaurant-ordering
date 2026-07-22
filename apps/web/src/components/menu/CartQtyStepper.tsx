'use client';

import { IntegerInput } from '@/components/ui/IntegerInput';

type Props = {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** When set, drawer variant shows an editable qty field (non-negative integers only). */
  onQtyChange?: (qty: number) => void;
  qtyInputAriaLabel?: string;
  /**
   * `menu` — fills parent action shell on MenuItemCard (gold pill).
   * `drawer` — content-sized neutral circles (cart / waiter).
   */
  variant?: 'menu' | 'drawer';
};

export function CartQtyStepper({
  qty,
  onDecrement,
  onIncrement,
  onQtyChange,
  qtyInputAriaLabel,
  variant = 'menu',
}: Props) {
  if (variant === 'drawer') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDecrement}
          aria-label="Decrease quantity"
          className="w-7 h-7 rounded-full bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-gold/20"
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
          <span className="text-brand-text text-sm w-4 text-center tabular-nums">{qty}</span>
        )}
        <button
          type="button"
          onClick={onIncrement}
          aria-label="Increase quantity"
          className="w-7 h-7 rounded-full bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-gold/20"
        >
          +
        </button>
      </div>
    );
  }

  // Menu list: fill the MenuItemCard action shell (fixed w/h) so add↔qty does not reflow price.
  return (
    <div className="flex h-full w-full items-center overflow-hidden rounded-lg bg-brand-gold text-sm font-semibold text-brand-on-gold">
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className="flex h-full flex-1 items-center justify-center hover:bg-black/10 active:bg-black/15 transition-colors"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center tabular-nums">{qty}</span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase quantity"
        className="flex h-full flex-1 items-center justify-center hover:bg-black/10 active:bg-black/15 transition-colors"
      >
        +
      </button>
    </div>
  );
}
