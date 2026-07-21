'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { MENU_IMAGE_UNOPTIMIZED } from '@/lib/menu-image';

interface Props {
  item: MenuItem;
  lang: Language;
  layout?: 'list' | 'grid';
  cartQty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function MenuItemCard({
  item,
  lang,
  layout = 'list',
  cartQty,
  onIncrement,
  onDecrement,
}: Props) {
  const name = (lang === 'zh' && item.name_zh) || (lang === 'en' && item.name_en) || item.name_pt;
  const desc = lang === 'zh'
    ? (item.description_zh || item.description_en || item.description_pt)
    : lang === 'en'
      ? (item.description_en || item.description_pt)
      : item.description_pt;
  const actionText = {
    zh: { add: '+ 加入', soldOut: '已售完' },
    en: { add: '+ Add', soldOut: 'Sold out' },
    pt: { add: '+ Adicionar', soldOut: 'Esgotado' },
  }[lang];

  return (
    <div
      className={`bg-brand-card border rounded-2xl p-4 flex gap-4 h-full ${
        layout === 'grid' ? 'flex-col sm:flex-row' : ''
      } ${item.available ? 'border-brand-border' : 'border-brand-border opacity-50'}`}
    >
      <div className="flex-shrink-0 w-16 h-16 bg-brand-border rounded-xl overflow-hidden flex items-center justify-center text-3xl relative">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={name}
            fill
            className="object-cover"
            sizes="64px"
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
          />
        ) : (
          item.emoji
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-brand-text font-semibold text-sm leading-tight">{name}</h3>
            {desc && (
              <p className="text-brand-text-muted text-[13px] mt-1 leading-relaxed line-clamp-2">{desc}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-brand-gold font-semibold tabular-nums">€{item.price.toFixed(2)}</span>

          {item.available ? (
            cartQty > 0 ? (
              <CartQtyStepper
                qty={cartQty}
                onDecrement={onDecrement}
                onIncrement={onIncrement}
                variant="menu"
              />
            ) : (
              <button
                type="button"
                onClick={onIncrement}
                className="px-3 py-1.5 rounded-lg text-sm bg-brand-border text-brand-text hover:bg-brand-gold/20 transition-all"
              >
                {actionText.add}
              </button>
            )
          ) : (
            <span className="text-brand-muted text-[13px] px-3 py-1.5 bg-brand-border rounded-lg">
              {actionText.soldOut}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
