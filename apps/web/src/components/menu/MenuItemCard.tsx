'use client';

import Image from 'next/image';
import type { MenuItem, Language } from '@/types';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import {
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_BODY_CLASS,
  MENU_ITEM_CARD_LIMIT_HINT_CLASS,
  MENU_ITEM_CARD_NAME_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
  MENU_ITEM_CARD_PRICE_CLASS,
  MENU_ITEM_CARD_SHELL_CLASS,
  MENU_ITEM_CARD_THUMB_CLASS,
  MENU_ITEM_CARD_THUMB_PX,
} from '@/lib/menu-item-card-layout';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { MenuItemFlavorChips } from '@/components/menu/MenuItemFlavorChips';

interface Props {
  item: MenuItem;
  lang: Language;
  cartQty: number;
  limitHint?: string | null;
  incrementDisabled?: boolean;
  /** When true, price 0 shows freeLabel (sushi round catalog). */
  treatZeroAsFree?: boolean;
  /** Store feature menu_flavor_hints_enabled. */
  flavorHintsEnabled?: boolean;
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-xl font-medium leading-none text-brand-on-gold shadow-[0_4px_10px_rgb(139_101_48_/_0.28)] transition-colors hover:bg-brand-gold-light active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${CUSTOMER_MENU_TYPE.itemAction}`}
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
        density="compact"
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

/**
 * Sole catalog card: thumb left; right column height-locked to thumb
 * (name → optional one-line flavor → price/action). List has no description.
 */
export function MenuItemCard({
  item,
  lang,
  cartQty,
  limitHint,
  incrementDisabled,
  treatZeroAsFree = false,
  flavorHintsEnabled = false,
  onOpenDetail,
  onIncrement,
  onDecrement,
}: Props) {
  const label = formatMenuCatalogItemLabel(item, lang);
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
      className={`${MENU_ITEM_CARD_SHELL_CLASS} ${
        item.available ? 'border-brand-border' : 'border-brand-border opacity-50'
      }`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={openDetailAria}
        className={`${MENU_ITEM_CARD_THUMB_CLASS} ${MENU_IMAGE_WELL_BG_CLASS} text-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40`}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className={MENU_IMAGE_OBJECT_FIT_CLASS}
            sizes={`${MENU_ITEM_CARD_THUMB_PX}px`}
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
          />
        ) : (
          item.emoji
        )}
      </button>

      <div className={MENU_ITEM_CARD_BODY_CLASS}>
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={openDetailAria}
          className="flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 rounded-md"
        >
          <h3 className={MENU_ITEM_CARD_NAME_CLASS}>
            {label}
            {item.is_vegetarian ? (
              <span className="ml-1.5 align-middle rounded-full border border-emerald-600/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                {t.itemVegetarianBadge}
              </span>
            ) : null}
          </h3>
          <MenuItemFlavorChips
            flavorCodes={item.flavor_codes}
            lang={lang}
            enabled={flavorHintsEnabled}
            variant="inline"
            reserveSlot
          />
          {limitHint ? <p className={MENU_ITEM_CARD_LIMIT_HINT_CLASS}>{limitHint}</p> : null}
        </button>

        <div className={MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS}>
          <span className={`${MENU_ITEM_CARD_PRICE_CLASS} ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
            {priceText}
          </span>
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
