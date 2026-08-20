'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { MENU_IMAGE_OBJECT_FIT_CLASS, MENU_IMAGE_UNOPTIMIZED, resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  formatMenuCatalogItemLabel,
  resolveMenuItemLocalizedDescription,
} from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
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
  /** When true, price 0 shows freeLabel (sushi round catalog). */
  treatZeroAsFree?: boolean;
  onOpenDetail: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

type ActionLabels = { add: string; soldOut: string };

export function MenuItemAddButton({
  ariaLabel,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-xl font-medium leading-none text-brand-on-gold transition-colors hover:bg-brand-gold-light active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${CUSTOMER_MENU_TYPE.itemAction}`}
    >
      +
    </button>
  );
}

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
        onDecrement={() => {
          onDecrement();
        }}
        onIncrement={() => {
          onIncrement();
        }}
        incrementDisabled={incrementDisabled}
      />
    );
  }

  return (
    <MenuItemAddButton ariaLabel={labels.add} disabled={incrementDisabled} onClick={onIncrement} />
  );
}

/** Sole catalog card: thumb left, name/desc + price/action row (guest and staff-assisted). */
export function MenuItemCard({
  item,
  lang,
  cartQty,
  limitHint,
  incrementDisabled,
  treatZeroAsFree = false,
  onOpenDetail,
  onIncrement,
  onDecrement,
}: Props) {
  const label = formatMenuCatalogItemLabel(item, lang);
  const desc = resolveMenuItemLocalizedDescription(item, lang);
  const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
  const t = MENU_PAGE_MESSAGES[lang];
  const actionLabels: ActionLabels = { add: t.itemAdd, soldOut: t.itemSoldOut };
  const priceText = formatCustomerMenuItemPrice(item.price, {
    freeLabel: t.itemFree,
    treatZeroAsFree,
  });
  const openDetailAria = t.itemOpenDetailAria.replace('{name}', label);

  return (
    <div
      className={`bg-brand-card border rounded-2xl p-3 flex min-w-0 gap-3 h-full overflow-hidden ${
        item.available ? 'border-brand-border' : 'border-brand-border opacity-50'
      }`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={openDetailAria}
        className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-border text-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className={MENU_IMAGE_OBJECT_FIT_CLASS}
            sizes="72px"
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
          />
        ) : (
          item.emoji
        )}
      </button>

      <div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-between gap-2">
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={openDetailAria}
          className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 rounded-md"
        >
          <h3 className={`text-brand-text ${CUSTOMER_MENU_TYPE.itemName}`}>{label}</h3>
          {desc ? (
            <p className={`text-brand-text-muted ${CUSTOMER_MENU_TYPE.itemDesc} mt-0.5 line-clamp-2`}>
              {desc}
            </p>
          ) : null}
          {limitHint ? (
            <p className="text-[11px] text-brand-text-muted mt-1 leading-snug">{limitHint}</p>
          ) : null}
        </button>

        <div className={MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS}>
          <span className={`shrink-0 ${CUSTOMER_MENU_TYPE.moneyAmount}`}>{priceText}</span>
          <div
            className={MENU_ITEM_CARD_ACTION_SLOT_CLASS}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
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
