'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Language, MenuItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailBackButtonClass,
  customerMenuItemDetailBodyClass,
  customerMenuItemDetailFooterClass,
  customerMenuItemDetailFooterRowClass,
  customerMenuItemDetailShellClass,
  customerMenuItemDetailShellEnteredClass,
  customerMenuItemDetailShellExitedClass,
} from '@/lib/customer-menu-item-detail-layout';
import { MENU_IMAGE_UNOPTIMIZED, resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  formatMenuCatalogItemLabel,
  resolveMenuItemLocalizedDescription,
} from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import { resolveMenuItemAllergenPresentation } from '@/lib/allergens';
import { isSushiRoundFreeMenuPrice } from '@/lib/table-order-round/settings';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

type DetailLabels = Pick<
  (typeof MENU_PAGE_MESSAGES)[Language],
  | 'itemDetailBack'
  | 'itemFree'
  | 'itemBadgeRound'
  | 'itemBadgePaid'
  | 'itemAllergensTitle'
  | 'itemAllergensUnmarked'
  | 'itemDetailDescriptionTitle'
  | 'itemDetailDescriptionEmpty'
  | 'itemDetailAddToRound'
  | 'itemDetailAddToCart'
  | 'itemDetailDone'
  | 'itemSoldOut'
  | 'itemAdd'
>;

type Props = {
  open: boolean;
  item: MenuItem | null;
  lang: Language;
  cartQty: number;
  /** Sushi guest/staff catalog: zero-price dishes use free + round/paid badges. */
  treatZeroAsFree: boolean;
  limitHint?: string | null;
  incrementDisabled?: boolean;
  onClose: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

/** Sole customer fullscreen dish detail (list open → hero + allergens + order CTA). */
export function CustomerMenuItemDetailSheet({
  open,
  item,
  lang,
  cartQty,
  treatZeroAsFree,
  limitHint,
  incrementDisabled,
  onClose,
  onIncrement,
  onDecrement,
}: Props) {
  const t = MENU_PAGE_MESSAGES[lang] as DetailLabels;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    document.body.style.overflow = 'hidden';
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  const label = formatMenuCatalogItemLabel(item, lang);
  const desc = resolveMenuItemLocalizedDescription(item, lang);
  const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
  const priceText = formatCustomerMenuItemPrice(item.price, {
    freeLabel: t.itemFree,
    treatZeroAsFree,
  });
  const isRoundFree = treatZeroAsFree && isSushiRoundFreeMenuPrice(item.price);
  const allergens = resolveMenuItemAllergenPresentation(item.allergen_codes, lang);

  const primaryLabel = !item.available
    ? t.itemSoldOut
    : cartQty > 0
      ? t.itemDetailDone
      : isRoundFree
        ? t.itemDetailAddToRound
        : t.itemDetailAddToCart;

  const onPrimary = () => {
    if (!item.available) return;
    if (cartQty <= 0) onIncrement();
    onClose();
  };

  return (
    <div
      className={`${customerMenuItemDetailShellClass} ${
        entered ? customerMenuItemDetailShellEnteredClass : customerMenuItemDetailShellExitedClass
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className={CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS}>
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={label}
            fill
            className="object-cover"
            sizes="(max-width: 430px) 100vw, 430px"
            priority
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">{item.emoji}</div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.itemDetailBack}
          className={customerMenuItemDetailBackButtonClass}
        >
          ←
        </button>
      </div>

      <div className={customerMenuItemDetailBodyClass}>
        <h1 className={`text-brand-text ${CUSTOMER_MENU_TYPE.drawerTitle}`}>{label}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={CUSTOMER_MENU_TYPE.moneyAmount}>{priceText}</span>
          {treatZeroAsFree ? (
            <span className="rounded-full border border-brand-border bg-brand-border/25 px-2.5 py-0.5 text-xs font-medium text-brand-text-muted">
              {isRoundFree ? t.itemBadgeRound : t.itemBadgePaid}
            </span>
          ) : null}
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-semibold text-brand-text">{t.itemDetailDescriptionTitle}</h2>
          {desc ? (
            <p className={`mt-2 text-brand-text ${CUSTOMER_MENU_TYPE.itemDesc}`}>{desc}</p>
          ) : (
            <p className="mt-2 text-sm text-brand-text-muted">{t.itemDetailDescriptionEmpty}</p>
          )}
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-semibold text-brand-text">{t.itemAllergensTitle}</h2>
          {allergens.status === 'unmarked' ? (
            <p className="mt-2 text-sm text-brand-text-muted">{t.itemAllergensUnmarked}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {allergens.items.map((entry) => (
                <span
                  key={entry.code}
                  className="rounded-full border border-amber-600/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-brand-text"
                >
                  {entry.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {limitHint ? (
          <p className="mt-4 text-[13px] leading-snug text-brand-text-muted">{limitHint}</p>
        ) : null}
      </div>

      <div className={customerMenuItemDetailFooterClass}>
        <div className={customerMenuItemDetailFooterRowClass}>
          <div className="min-w-[6.75rem] shrink-0">
            {item.available ? (
              cartQty > 0 ? (
                <CartQtyStepper
                  qty={cartQty}
                  onDecrement={onDecrement}
                  onIncrement={onIncrement}
                  incrementDisabled={incrementDisabled}
                />
              ) : (
                <button
                  type="button"
                  onClick={onIncrement}
                  disabled={incrementDisabled}
                  aria-label={t.itemAdd}
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold text-xl font-medium leading-none text-brand-on-gold transition-colors hover:bg-brand-gold-light active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${CUSTOMER_MENU_TYPE.itemAction}`}
                >
                  +
                </button>
              )
            ) : (
              <span className={CUSTOMER_MENU_TYPE.itemSoldOut}>{t.itemSoldOut}</span>
            )}
          </div>
          <Button
            type="button"
            variant="gold"
            size="md"
            className="min-h-11 flex-1"
            disabled={!item.available}
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
