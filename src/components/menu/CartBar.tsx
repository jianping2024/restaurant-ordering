'use client';

interface CartBarProps {
  qty: number;
  total: number;
  onClick: () => void;
}

// 底部固定购物车栏
export function CartBar({ qty, total, onClick }: CartBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20">
      <button
        onClick={onClick}
        className="w-full bg-brand-gold text-brand-bg rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl shadow-brand-gold/20 active:scale-95 transition-transform"
      >
        <div className="flex items-center gap-3">
          <span className="bg-brand-bg text-brand-gold w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center">
            {qty}
          </span>
          <span className="font-semibold text-sm">查看购物车</span>
        </div>
        <span className="font-heading text-lg font-semibold">€{total.toFixed(2)}</span>
      </button>
    </div>
  );
}
