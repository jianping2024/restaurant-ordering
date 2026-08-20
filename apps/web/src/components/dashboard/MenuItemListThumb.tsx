'use client';

import Image from 'next/image';
import {
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import type { MenuItem } from '@/types';

type CatalogThumbItem = Pick<MenuItem, 'image_url' | 'emoji'>;

/** Sole 40×40 staff catalog list thumb: photo, else emoji, else empty square. */
export function MenuItemListThumb({ item }: { item: CatalogThumbItem }) {
  const src = resolveMenuImageDisplayUrl(item.image_url) || item.image_url || null;

  return (
    <div className={`w-10 h-10 rounded-lg overflow-hidden ${MENU_IMAGE_WELL_BG_CLASS} flex-shrink-0 flex items-center justify-center text-xl`}>
      {src ? (
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          className={`${MENU_IMAGE_OBJECT_FIT_CLASS} w-10 h-10`}
          unoptimized={MENU_IMAGE_UNOPTIMIZED}
        />
      ) : (
        item.emoji
      )}
    </div>
  );
}
