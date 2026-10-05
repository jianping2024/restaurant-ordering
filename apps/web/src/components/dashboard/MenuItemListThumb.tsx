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

/** Sole staff/kitchen catalog thumb sizes (px). Default 40 = dashboard list; 56 = kitchen rows; 160 = kitchen prep tray hero. */
export type MenuItemListThumbSize = 40 | 56 | 160;

const THUMB_SIZE_CLASS: Record<
  MenuItemListThumbSize,
  { well: string; img: string; emoji: string }
> = {
  40: { well: 'w-10 h-10 text-xl', img: 'w-10 h-10', emoji: 'text-xl' },
  56: { well: 'w-14 h-14 text-2xl', img: 'w-14 h-14', emoji: 'text-2xl' },
  160: { well: 'w-40 h-40 text-6xl', img: 'w-40 h-40', emoji: 'text-6xl' },
};

/** Sole catalog list thumb: photo, else emoji, else empty square. */
export function MenuItemListThumb({
  item,
  size = 40,
}: {
  item: CatalogThumbItem;
  size?: MenuItemListThumbSize;
}) {
  const src = resolveMenuImageDisplayUrl(item.image_url);
  const classes = THUMB_SIZE_CLASS[size];

  return (
    <div
      className={`${classes.well} rounded-lg overflow-hidden ${MENU_IMAGE_WELL_BG_CLASS} flex-shrink-0 flex items-center justify-center ${classes.emoji}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          className={`${MENU_IMAGE_OBJECT_FIT_CLASS} ${classes.img}`}
          unoptimized={MENU_IMAGE_UNOPTIMIZED}
        />
      ) : (
        item.emoji
      )}
    </div>
  );
}
