'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';

interface Props {
  item: MenuItem;
  lang: Language;
  cartQty: number;
  onAdd: () => void;
}

export function MenuItemCard({ item, lang, cartQty, onAdd }: Props) {
  const name = (lang === 'zh' && item.name_zh) || (lang === 'en' && item.name_en) || item.name_pt;
  const desc = lang === 'zh'
    ? (item.description_zh || item.description_en || item.description_pt)
    : lang === 'en'
      ? (item.description_en || item.description_pt)
      : item.description_pt;
  const actionText = {
    zh: { added: '已加入', add: '+ 加入', soldOut: '已售完' },
    en: { added: 'Added', add: '+ Add', soldOut: 'Sold out' },
    pt: { added: 'Adicionado', add: '+ Adicionar', soldOut: 'Esgotado' },
  }[lang];

  return (
    <div className={`bg-brand-card border rounded-2xl p-4 flex gap-4 ${
      item.available ? 'border-brand-border' : 'border-brand-border opacity-50'
    }`}>
      {/* 图片或 Emoji */}
      <div className="flex-shrink-0 w-16 h-16 bg-brand-border rounded-xl overflow-hidden flex items-center justify-center text-3xl relative">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          item.emoji
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-brand-text font-medium text-sm leading-tight">{name}</h3>
            {desc && (
              <p className="text-brand-text-muted text-[13px] mt-1 leading-relaxed line-clamp-2">{desc}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-brand-gold font-semibold">€{item.price.toFixed(2)}</span>

          {item.available ? (
            <button
              onClick={onAdd}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                cartQty > 0
                  ? 'bg-brand-gold text-brand-bg font-semibold'
                  : 'bg-brand-border text-brand-text hover:bg-brand-gold/20'
              }`}
            >
              {cartQty > 0 && (
                <span className="bg-brand-bg text-brand-gold w-4 h-4 rounded-full text-[13px] flex items-center justify-center">
                  {cartQty}
                </span>
              )}
              {cartQty > 0 ? actionText.added : actionText.add}
            </button>
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
