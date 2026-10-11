'use client';

import Image from 'next/image';
import {
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import type { PeerFloatThumb } from '@/lib/table-order-round/sushi-peer-float-display';

/** Sole guest dish thumb (peer float + 已点): photo else emoji, 28×28. */
export function PeerFloatDishThumb({ thumb }: { thumb: PeerFloatThumb }) {
  const src = resolveMenuImageDisplayUrl(thumb.imageUrl);
  return (
    <span
      className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-[15px] leading-none ${MENU_IMAGE_WELL_BG_CLASS}`}
      data-peer-float-thumb={src ? 'photo' : 'emoji'}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className={MENU_IMAGE_OBJECT_FIT_CLASS}
          sizes="28px"
          unoptimized={MENU_IMAGE_UNOPTIMIZED}
        />
      ) : (
        thumb.emoji
      )}
    </span>
  );
}
