'use client';

import Image from 'next/image';
import type { Language, MenuItem } from '@/types';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import {
  MENU_IMAGE_ASPECT_RATIO,
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';

type Props = {
  items: MenuItem[];
  lang: Language;
  title: string;
  treatZeroAsFree?: boolean;
  onOpenDetail: (menuItemId: string) => void;
};

/** Sole poster width (8.5rem). Media height is width / MENU_IMAGE_ASPECT_RATIO. */
const POSTER_WIDTH_PX = 136;
const POSTER_MEDIA_HEIGHT_PX = POSTER_WIDTH_PX / MENU_IMAGE_ASPECT_RATIO;

/**
 * Sole customer recommended merchandising: gold-wash band of equal-height
 * poster cards (locked 4:3 well + two-line name slot + price on one baseline).
 * Band inset is one py-*. Tap opens detail. Not MenuItemCard, not sticky,
 * not a virtual category, no overlay +, no sold-out row.
 */
export function CustomerRecommendedRail({
  items,
  lang,
  title,
  treatZeroAsFree = false,
  onOpenDetail,
}: Props) {
  if (items.length === 0) return null;
  const t = MENU_PAGE_MESSAGES[lang];

  return (
    <section
      className="mb-5 rounded-2xl border border-brand-gold/40 bg-brand-gold/15 px-3 py-2.5"
      aria-label={title}
    >
      <h2 className="px-0.5 text-sm font-semibold text-brand-gold">{title}</h2>
      <div className="mesa-chip-scroll -mx-3 mt-2 flex items-start gap-2.5 px-3">
        {items.map((item) => {
          const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
          const label = formatMenuCatalogItemLabel(item, lang);
          const priceText = formatCustomerMenuItemPrice(item.price, {
            freeLabel: t.itemFree,
            treatZeroAsFree,
          });
          const openDetailAria = t.itemOpenDetailAria.replace('{name}', label);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenDetail(item.id)}
              aria-label={openDetailAria}
              className="flex shrink-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40"
              style={{ width: POSTER_WIDTH_PX }}
            >
              <span
                className={`relative block shrink-0 overflow-hidden rounded-xl ${MENU_IMAGE_WELL_BG_CLASS} text-3xl`}
                style={{ width: POSTER_WIDTH_PX, height: POSTER_MEDIA_HEIGHT_PX }}
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    className={MENU_IMAGE_OBJECT_FIT_CLASS}
                    sizes={`${POSTER_WIDTH_PX}px`}
                    unoptimized={MENU_IMAGE_UNOPTIMIZED}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">{item.emoji}</span>
                )}
              </span>
              <span className={CUSTOMER_MENU_TYPE.recommendedName}>{label}</span>
              <span className={`mt-0.5 block ${CUSTOMER_MENU_TYPE.moneyAmount}`}>{priceText}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
