'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { APPEND_CART_QTY_MAX, type Language, type MenuItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CustomerCartItemNoteFields } from '@/components/menu/CustomerCartItemNoteFields';
import type { MenuNotePresetCatalog } from '@/lib/menu-note-presets';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailBackdropClass,
  customerMenuItemDetailBodyClass,
  customerMenuItemDetailCloseButtonClass,
  customerMenuItemDetailContentClass,
  customerMenuItemDetailFooterClass,
  customerMenuItemDetailFooterRowClass,
  customerMenuItemDetailHostClass,
  customerMenuItemDetailPanelClass,
  customerMenuItemDetailPanelEnteredClass,
  customerMenuItemDetailPanelExitedClass,
} from '@/lib/customer-menu-item-detail-layout';
import { MENU_IMAGE_OBJECT_FIT_CLASS, MENU_IMAGE_UNOPTIMIZED, resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  formatMenuCatalogItemLabel,
  resolveMenuItemLocalizedDescription,
} from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import { resolveMenuItemAllergenPresentation } from '@/lib/allergens';
import { MenuItemFlavorChips } from '@/components/menu/MenuItemFlavorChips';
import { isSushiRoundFreeMenuPrice } from '@/lib/table-order-round/settings';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

type DetailLabels = Pick<
  (typeof MENU_PAGE_MESSAGES)[Language],
  | 'itemDetailClose'
  | 'itemFree'
  | 'itemBadgeRound'
  | 'itemBadgePaid'
  | 'itemAllergensTitle'
  | 'itemAllergensUnmarked'
  | 'itemVegetarianBadge'
  | 'itemDetailNotesTitle'
  | 'itemDetailDescriptionTitle'
  | 'itemDetailDescriptionEmpty'
  | 'itemDetailAddToRound'
  | 'itemDetailAddToCart'
  | 'itemDetailDone'
  | 'itemSoldOut'
>;

type Props = {
  open: boolean;
  item: MenuItem | null;
  lang: Language;
  cartQty: number;
  treatZeroAsFree: boolean;
  limitHint?: string | null;
  incrementDisabled?: boolean;
  /** Store feature menu_flavor_hints_enabled. */
  flavorHintsEnabled?: boolean;
  notePresetCatalog: MenuNotePresetCatalog;
  note: string;
  selectedNotePresetIds: readonly string[];
  onUpdateNote: (note: string) => void;
  onToggleNotePreset: (presetId: string) => void;
  onClose: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

/** Sole customer dish detail (phone fullscreen / lg+ centered dialog). */
export function CustomerMenuItemDetailSheet({
  open,
  item,
  lang,
  cartQty,
  treatZeroAsFree,
  limitHint,
  incrementDisabled,
  flavorHintsEnabled = false,
  notePresetCatalog,
  note,
  selectedNotePresetIds,
  onUpdateNote,
  onToggleNotePreset,
  onClose,
  onIncrement,
  onDecrement,
}: Props) {
  const t = MENU_PAGE_MESSAGES[lang] as DetailLabels;
  const [entered, setEntered] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(id);
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
    <div className={customerMenuItemDetailHostClass} role="presentation">
      <div
        className={customerMenuItemDetailBackdropClass}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`${customerMenuItemDetailPanelClass} ${
          entered
            ? customerMenuItemDetailPanelEnteredClass
            : customerMenuItemDetailPanelExitedClass
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.itemDetailClose}
          className={customerMenuItemDetailCloseButtonClass}
        >
          ✕
        </button>

        <div className={customerMenuItemDetailBodyClass}>
          <div className={CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS}>
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={label}
                fill
                className={MENU_IMAGE_OBJECT_FIT_CLASS}
                sizes="(max-width: 1023px) 100vw, 32rem"
                priority
                unoptimized={MENU_IMAGE_UNOPTIMIZED}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-7xl">{item.emoji}</div>
            )}
            <MenuItemFlavorChips
              flavorCodes={item.flavor_codes}
              lang={lang}
              enabled={flavorHintsEnabled}
              variant="onImage"
              className="absolute bottom-2.5 left-2.5 right-12 z-[1] max-w-[calc(100%-3.5rem)]"
            />
          </div>

          <div className={customerMenuItemDetailContentClass}>
            <h1 className={`text-brand-text ${CUSTOMER_MENU_TYPE.drawerTitle}`}>{label}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={CUSTOMER_MENU_TYPE.moneyAmount}>{priceText}</span>
              {item.is_vegetarian ? (
                <span className="rounded-full border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  {t.itemVegetarianBadge}
                </span>
              ) : null}
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

            <div className="mt-5">
              <h2 className="text-sm font-semibold text-brand-text">{t.itemDetailNotesTitle}</h2>
              <div className="mt-2">
                <CustomerCartItemNoteFields
                  lang={lang}
                  notePresetCatalog={notePresetCatalog}
                  notePresetGroupIds={item.note_preset_group_ids || []}
                  selectedNotePresetIds={selectedNotePresetIds}
                  note={note}
                  disabled={!item.available}
                  onUpdateNote={onUpdateNote}
                  onToggleNotePreset={onToggleNotePreset}
                />
              </div>
            </div>

            {limitHint ? (
              <p className="mt-4 text-[13px] leading-snug text-brand-text-muted">{limitHint}</p>
            ) : null}
          </div>
        </div>

        <div className={customerMenuItemDetailFooterClass}>
          <div className={customerMenuItemDetailFooterRowClass}>
            <div className="min-w-[6.75rem] shrink-0">
              {item.available ? (
                <CartQtyStepper
                  qty={cartQty}
                  max={APPEND_CART_QTY_MAX}
                  onDecrement={onDecrement}
                  onIncrement={onIncrement}
                  incrementDisabled={incrementDisabled}
                />
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
    </div>
  );
}
