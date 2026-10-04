'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { APPEND_CART_QTY_MAX, type MenuItem, type Language } from '@/types';
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
  MENU_ITEM_CARD_ACTION_GLYPH_CLASS,
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_BODY_CLASS,
  MENU_ITEM_CARD_GOLD_ACTION_CLASS,
  MENU_ITEM_CARD_LIMIT_HINT_CLASS,
  MENU_ITEM_CARD_NAME_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
  MENU_ITEM_CARD_PRICE_CLASS,
  MENU_ITEM_CARD_QTY_DECREMENT_CLASS,
  MENU_ITEM_CARD_QTY_PILL_CLASS,
  MENU_ITEM_CARD_QTY_PILL_COLLAPSE_MS,
  MENU_ITEM_CARD_SHELL_CLASS,
  MENU_ITEM_CARD_THUMB_CLASS,
  MENU_ITEM_CARD_THUMB_PX,
  menuItemCardQtyTextClass,
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

type ActionLabels = {
  add: string;
  soldOut: string;
  qtyEdit: string;
  decrease: string;
  increase: string;
};

/** Sole list gold circle — `+` at qty 0, the collapsed qty number, and the pill `+`. */
function MenuItemGoldActionButton({
  ariaLabel,
  disabled,
  onClick,
  children,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${MENU_ITEM_CARD_GOLD_ACTION_CLASS} ${CUSTOMER_MENU_TYPE.itemAction}`}
    >
      {children}
    </button>
  );
}

/**
 * Rest: one gold circle (`+` or qty) so price stays visible. Tap → −/qty/+ pill over
 * the price row; collapses after idle, outside tap, or qty back to 0.
 */
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
  const [expanded, setExpanded] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const pillOpen = expanded && available && cartQty > 0;

  // Idle collapse keyed on the flag (not pillOpen) so a blocked first add or qty→0 also
  // clears it; qty in deps restarts the window on every −/+.
  useEffect(() => {
    if (!expanded) return;
    const timer = window.setTimeout(() => setExpanded(false), MENU_ITEM_CARD_QTY_PILL_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [expanded, cartQty]);

  useEffect(() => {
    if (!pillOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pillRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pillOpen]);

  if (!available) {
    return (
      <span className={`block text-right ${CUSTOMER_MENU_TYPE.itemSoldOut}`}>{labels.soldOut}</span>
    );
  }

  if (pillOpen) {
    return (
      <div ref={pillRef} className={MENU_ITEM_CARD_QTY_PILL_CLASS}>
        <button
          type="button"
          onClick={onDecrement}
          aria-label={labels.decrease}
          className={`${MENU_ITEM_CARD_QTY_DECREMENT_CLASS} ${CUSTOMER_MENU_TYPE.itemAction}`}
        >
          <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>−</span>
        </button>
        <span
          aria-live="polite"
          className={`min-w-0 flex-1 text-center text-brand-text ${menuItemCardQtyTextClass(cartQty)}`}
        >
          {cartQty}
        </span>
        <MenuItemGoldActionButton
          ariaLabel={labels.increase}
          disabled={incrementDisabled || cartQty >= APPEND_CART_QTY_MAX}
          onClick={onIncrement}
        >
          <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>+</span>
        </MenuItemGoldActionButton>
      </div>
    );
  }

  if (cartQty > 0) {
    return (
      <MenuItemGoldActionButton
        ariaLabel={labels.qtyEdit.replace('{qty}', String(cartQty))}
        onClick={() => setExpanded(true)}
      >
        <span className={menuItemCardQtyTextClass(cartQty)}>{cartQty}</span>
      </MenuItemGoldActionButton>
    );
  }

  return (
    <MenuItemGoldActionButton
      ariaLabel={labels.add}
      disabled={incrementDisabled}
      onClick={() => {
        onIncrement();
        setExpanded(true);
      }}
    >
      <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>+</span>
    </MenuItemGoldActionButton>
  );
}

/**
 * Sole catalog card: thumb left; right column min-height = thumb
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
  const actionLabels: ActionLabels = {
    add: t.itemAdd,
    soldOut: t.itemSoldOut,
    qtyEdit: t.itemQtyEditAria,
    decrease: t.itemDecreaseAria,
    increase: t.itemIncreaseAria,
  };
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
