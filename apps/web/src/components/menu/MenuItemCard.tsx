'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { MENU_IMAGE_UNOPTIMIZED, resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  formatMenuCatalogItemLabel,
  resolveMenuItemLocalizedDescription,
} from '@/lib/menu-item-display';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
} from '@/lib/menu-item-card-layout';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

interface Props {
  item: MenuItem;
  lang: Language;
  cartQty: number;
  limitHint?: string | null;
  incrementDisabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}

type ActionLabels = { add: string; soldOut: string };

function MenuItemCardAction({
  available,
  cartQty,
  labels,
  incrementDisabled,
  onIncrement,
  onDecrement,
}: {
  available: boolean;
  cartQty: number;
  labels: ActionLabels;
  incrementDisabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  if (!available) {
    return (
      <span className={`block text-right ${CUSTOMER_MENU_TYPE.itemSoldOut}`}>{labels.soldOut}</span>
    );
  }

  if (cartQty > 0) {
    return (
      <CartQtyStepper
        qty={cartQty}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        incrementDisabled={incrementDisabled}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onIncrement}
      disabled={incrementDisabled}
      aria-label={labels.add}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-xl font-medium leading-none text-brand-on-gold transition-colors hover:bg-brand-gold-light active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${CUSTOMER_MENU_TYPE.itemAction}`}
    >
      +
    </button>
  );
}

/** Sole catalog card: thumb left, name/desc + price/action row (guest and staff-assisted). */
export function MenuItemCard({
  item,
  lang,
  cartQty,
  limitHint,
  incrementDisabled,
  onIncrement,
  onDecrement,
}: Props) {
  const label = formatMenuCatalogItemLabel(item, lang);
  const desc = resolveMenuItemLocalizedDescription(item, lang);
  const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
  const t = MENU_PAGE_MESSAGES[lang];
  const actionLabels: ActionLabels = { add: t.itemAdd, soldOut: t.itemSoldOut };

  return (
    <div
      className={`bg-brand-card border rounded-2xl p-3 flex min-w-0 gap-3 h-full overflow-hidden ${
        item.available ? 'border-brand-border' : 'border-brand-border opacity-50'
      }`}
    >
      <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-border text-3xl">
        {imageSrc ? (
          <Image
            src={imageSrc}
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

      <div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`text-brand-text ${CUSTOMER_MENU_TYPE.itemName}`}>{label}</h3>
          {desc ? (
            <p className={`text-brand-text-muted ${CUSTOMER_MENU_TYPE.itemDesc} mt-0.5 line-clamp-2`}>
              {desc}
            </p>
          ) : null}
          {limitHint ? (
            <p className="text-[11px] text-brand-text-muted mt-1 leading-snug">{limitHint}</p>
          ) : null}
        </div>

        <div className={MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS}>
          <span className={`min-w-0 truncate ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
            €{item.price.toFixed(2)}
          </span>
          <div className={MENU_ITEM_CARD_ACTION_SLOT_CLASS}>
            <MenuItemCardAction
              available={item.available}
              cartQty={cartQty}
              labels={actionLabels}
              incrementDisabled={incrementDisabled}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
