'use client';

import {
  MenuItemListThumb,
  type MenuItemListThumbSize,
} from '@/components/dashboard/MenuItemListThumb';

/** Sole kitchen-board dish thumb control — opens read-only detail; never toggles row select. */
export function KitchenDishThumbButton({
  imageUrl,
  emoji,
  ariaLabel,
  size = 56,
  onOpen,
}: {
  imageUrl: string | null;
  emoji: string;
  ariaLabel: string;
  size?: MenuItemListThumbSize;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-kitchen-dish-thumb=""
      className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
    >
      <MenuItemListThumb item={{ image_url: imageUrl, emoji }} size={size} />
    </button>
  );
}
