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
import { formatMenuCatalogItemLabel, formatMenuItemOpenDetailAria } from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import { VegetarianMark } from '@/components/menu/VegetarianMark';
import { DishMotionVideo } from '@/components/menu/DishMotionVideo';

type Props = {
  items: MenuItem[];
  lang: Language;
  title: string;
  treatZeroAsFree?: boolean;
  onOpenDetail: (menuItemId: string) => void;
};

/** Sole poster width. Media height is width / MENU_IMAGE_ASPECT_RATIO (4:3). */
const POSTER_WIDTH_PX = 112;
const POSTER_MEDIA_HEIGHT_PX = POSTER_WIDTH_PX / MENU_IMAGE_ASPECT_RATIO;

/**
 * Sole recommended poster chrome class — motion in globals `.mesa-recommended-poster`
 * (lift / press / focus; no pointer tilt). Do not reuse MenuItemCard / mesa-menu-item-card.
 */
const RECOMMENDED_POSTER_SHELL_CLASS =
  'mesa-recommended-poster flex min-w-0 shrink-0 flex-col text-left';

/** Sole recommended poster image well — pairs with `.mesa-recommended-poster-thumb` CSS. */
const RECOMMENDED_POSTER_THUMB_CLASS = `mesa-recommended-poster-thumb relative block shrink-0 overflow-hidden rounded-lg ${MENU_IMAGE_WELL_BG_CLASS} text-2xl`;

/**
 * Sole customer recommended merchandising: gold-wash band of equal-height
 * poster cards (locked 4:3 well + one-line truncated name + tight price);
 * vegetarian dishes get the same photo-corner `VegetarianMark` as the list card.
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
      className="mb-3 min-w-0 rounded-2xl border border-brand-gold/40 bg-brand-gold/15 px-3 py-2"
      aria-label={title}
    >
      <h2 className="px-0.5 text-[13px] font-semibold text-brand-gold">{title}</h2>
      {/* py gives room so hover lift / shadow is not clipped by mesa-chip-scroll */}
      <div className="mesa-chip-scroll mt-1.5 flex min-w-0 items-start gap-2 py-2">
        {items.map((item) => {
          const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
          const label = formatMenuCatalogItemLabel(item, lang);
          const priceText = formatCustomerMenuItemPrice(item.price, {
            freeLabel: t.itemFree,
            treatZeroAsFree,
          });
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenDetail(item.id)}
              aria-label={formatMenuItemOpenDetailAria(item, lang)}
              title={label}
              className={RECOMMENDED_POSTER_SHELL_CLASS}
              style={{ width: POSTER_WIDTH_PX }}
            >
              <span
                className={RECOMMENDED_POSTER_THUMB_CLASS}
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
                  <span className="mesa-recommended-poster-thumb-emoji flex h-full w-full items-center justify-center">
                    {item.emoji}
                  </span>
                )}
                {imageSrc ? <DishMotionVideo src={item.rail_video_url} /> : null}
                {item.is_vegetarian ? (
                  <VegetarianMark variant="thumb" label={t.itemVegetarianBadge} />
                ) : null}
              </span>
              <span className={CUSTOMER_MENU_TYPE.recommendedName}>{label}</span>
              <span className={CUSTOMER_MENU_TYPE.recommendedPrice}>{priceText}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
