'use client';

import Image from 'next/image';
import type { Language, MenuItem } from '@/types';
import { MenuItemAddButton } from '@/components/menu/MenuItemCard';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { MENU_IMAGE_UNOPTIMIZED, resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';

type Props = {
  items: MenuItem[];
  lang: Language;
  title: string;
  incrementDisabledForItem?: (item: MenuItem) => boolean;
  onOpenDetail: (menuItemId: string) => void;
  onIncrement: (item: MenuItem) => void;
};

const TILE_CLASS =
  'relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-2xl bg-brand-border';

/**
 * Sole customer recommended merchandising: horizontal photo tiles below the
 * category strip. Not sticky and not a virtual category.
 */
export function CustomerRecommendedRail({
  items,
  lang,
  title,
  incrementDisabledForItem,
  onOpenDetail,
  onIncrement,
}: Props) {
  if (items.length === 0) return null;
  const t = MENU_PAGE_MESSAGES[lang];

  return (
    <section className="mb-4" aria-label={title}>
      <h2 className="px-0.5 text-base font-semibold text-brand-text">{title}</h2>
      <div className="mesa-chip-scroll -mx-4 mt-2 flex gap-2 px-4">
        {items.map((item) => {
          const imageSrc = resolveMenuImageDisplayUrl(item.image_url);
          const label = formatMenuCatalogItemLabel(item, lang);
          const openDetailAria = t.itemOpenDetailAria.replace('{name}', label);
          return (
            <div
              key={item.id}
              className={`${TILE_CLASS} ${item.available ? '' : 'opacity-50'}`}
            >
              <button
                type="button"
                onClick={() => onOpenDetail(item.id)}
                aria-label={openDetailAria}
                className="absolute inset-0 flex items-center justify-center text-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40"
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="76px"
                    unoptimized={MENU_IMAGE_UNOPTIMIZED}
                  />
                ) : (
                  item.emoji
                )}
              </button>
              {item.available ? (
                <div className="absolute bottom-1 right-1 z-10">
                  <MenuItemAddButton
                    ariaLabel={t.itemAdd}
                    disabled={incrementDisabledForItem?.(item)}
                    onClick={() => onIncrement(item)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
