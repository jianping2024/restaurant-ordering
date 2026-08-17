'use client';

import Image from 'next/image';
import type { Language, MenuItem } from '@/types';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import {
  MENU_IMAGE_ASPECT_RATIO,
  MENU_IMAGE_UNOPTIMIZED,
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

/**
 * Sole customer recommended merchandising: gold-wash band of poster cards
 * (4:3 photo + catalog label + price). Tap opens detail. Not MenuItemCard,
 * not sticky, not a virtual category, no overlay +.
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
      className="mb-5 overflow-hidden rounded-2xl border border-brand-gold/40 bg-brand-gold/15 px-3 pb-3 pt-2.5"
      aria-label={title}
    >
      <h2 className="px-0.5 text-sm font-semibold text-brand-gold">{title}</h2>
      <div className="mesa-chip-scroll -mx-3 mt-2 flex gap-2.5 px-3">
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
              className={`w-[8.5rem] shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 ${
                item.available ? '' : 'opacity-50'
              }`}
            >
              <span
                className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-brand-border text-3xl"
                style={{ aspectRatio: String(MENU_IMAGE_ASPECT_RATIO) }}
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="136px"
                    unoptimized={MENU_IMAGE_UNOPTIMIZED}
                  />
                ) : (
                  item.emoji
                )}
              </span>
              <span className={`mt-1.5 line-clamp-2 ${CUSTOMER_MENU_TYPE.recommendedName}`}>{label}</span>
              <span className={`mt-0.5 block ${CUSTOMER_MENU_TYPE.moneyAmount}`}>{priceText}</span>
              {item.available ? null : (
                <span className={`mt-0.5 block ${CUSTOMER_MENU_TYPE.itemSoldOut}`}>{t.itemSoldOut}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
