'use client';

type Props = {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** List card uses compact gold pill; drawer uses neutral circles. */
  variant?: 'menu' | 'drawer';
};

export function CartQtyStepper({ qty, onDecrement, onIncrement, variant = 'menu' }: Props) {
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
        <span className="text-brand-text text-sm w-4 text-center tabular-nums">{qty}</span>
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

  return (
    <div className="flex items-center gap-1 rounded-lg bg-brand-gold text-brand-on-gold font-semibold text-sm overflow-hidden">
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className="px-2.5 py-1.5 hover:bg-black/10 active:bg-black/15 transition-colors"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center tabular-nums">{qty}</span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase quantity"
        className="px-2.5 py-1.5 hover:bg-black/10 active:bg-black/15 transition-colors"
      >
        +
      </button>
    </div>
  );
}
