'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { MENU_IMAGE_UNOPTIMIZED } from '@/lib/menu-image';
import {
  formatMenuCatalogItemLabel,
  resolveMenuItemLocalizedDescription,
} from '@/lib/menu-item-display';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

/**
 * Fixed footprint for add / qty stepper / sold-out so the price column
 * does not reflow when cart qty crosses zero.
 * Sized for the widest face (pt "+ Adicionar") and two-digit qty.
 */
const MENU_ITEM_CARD_ACTION_SHELL =
  'box-border flex h-9 w-[8.5rem] shrink-0 items-stretch';

interface Props {
  item: MenuItem;
  lang: Language;
  layout?: 'list' | 'grid';
  cartQty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

type ActionLabels = { add: string; soldOut: string };

function MenuItemCardAction({
  available,
  cartQty,
  labels,
  onIncrement,
  onDecrement,
}: {
  available: boolean;
  cartQty: number;
  labels: ActionLabels;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  if (!available) {
    return (
      <div className={MENU_ITEM_CARD_ACTION_SHELL}>
        <span
          className={`flex w-full items-center justify-center rounded-lg bg-brand-border px-2 text-brand-muted ${CUSTOMER_MENU_TYPE.itemSoldOut}`}
        >
          {labels.soldOut}
        </span>
      </div>
    );
  }

  if (cartQty > 0) {
    return (
      <div className={MENU_ITEM_CARD_ACTION_SHELL}>
        <CartQtyStepper
          qty={cartQty}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
          variant="menu"
        />
      </div>
    );
  }

  return (
    <div className={MENU_ITEM_CARD_ACTION_SHELL}>
      <button
        type="button"
        onClick={onIncrement}
        className={`flex w-full items-center justify-center rounded-lg bg-brand-border px-2 text-brand-text transition-colors hover:bg-brand-gold/20 ${CUSTOMER_MENU_TYPE.itemAction}`}
      >
        {labels.add}
      </button>
    </div>
  );
}

export function MenuItemCard({
  item,
  lang,
  layout = 'list',
  cartQty,
  onIncrement,
  onDecrement,
}: Props) {
  const label = formatMenuCatalogItemLabel(item, lang);
  const desc = resolveMenuItemLocalizedDescription(item, lang);
  const actionLabels: ActionLabels = {
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
      <div className="flex-shrink-0 w-[4.5rem] h-[4.5rem] bg-brand-border rounded-xl overflow-hidden flex items-center justify-center text-3xl relative">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={label}
            fill
            className="object-cover"
            sizes="72px"
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
          />
        ) : (
          item.emoji
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="min-w-0">
          <h3 className={`text-brand-text ${CUSTOMER_MENU_TYPE.itemName}`}>{label}</h3>
          {desc ? (
            <p className={`text-brand-text-muted ${CUSTOMER_MENU_TYPE.itemDesc} mt-1 line-clamp-2`}>{desc}</p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={CUSTOMER_MENU_TYPE.moneyAmount}>€{item.price.toFixed(2)}</span>
          <MenuItemCardAction
            available={item.available}
            cartQty={cartQty}
            labels={actionLabels}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
        </div>
      </div>
    </div>
  );
}
