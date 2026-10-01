/**
 * Sole menu catalog card + list grid (MenuItemCard — guest and staff-assisted).
 *
 * Right column fixed slots (stable list rhythm):
 * name ≤2 lines → flavor band ≤2 rows (only when flavor hints enabled; empty still reserved)
 * → desc ≤2 lines (empty reserved) → foot price + action (content-width, bottom-pinned).
 */

/** Catalog list: 1 col phone, 2 col lg, 3 col xl — sole list container class. */
export const CUSTOMER_MENU_ITEM_LIST_CLASS =
  'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3';

/** List thumb: 88×88, top-aligned (not vertically centered against tall copy). */
export const MENU_ITEM_CARD_THUMB_CLASS =
  'relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl self-start';

/**
 * Name slot: 15px / 1.3 × 2 lines = 39px.
 * Sole list title face for MenuItemCard.
 */
export const MENU_ITEM_CARD_NAME_CLASS =
  'h-[2.4375rem] min-h-[2.4375rem] overflow-hidden break-words text-[15px] font-semibold leading-[1.3] text-brand-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]';

/**
 * Flavor band: chip row height ~22px × 2 + gap → 49px.
 * Used only while menu_flavor_hints_enabled; empty codes still occupy the slot.
 */
export const MENU_ITEM_CARD_FLAVOR_SLOT_CLASS =
  'flex h-[3.0625rem] min-h-[3.0625rem] flex-wrap content-start gap-1 overflow-hidden';

/** Description slot: 12px / 1.4 × 2 lines ≈ 33.6px; empty still reserved. */
export const MENU_ITEM_CARD_DESC_CLASS =
  'h-[2.1rem] min-h-[2.1rem] overflow-hidden break-words text-xs leading-[1.4] text-brand-text-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]';

/** Price + action: content-width action (no empty 6.75rem stepper column for bare +). */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'mt-auto flex h-9 shrink-0 items-center justify-between gap-2';

export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex shrink-0 items-center justify-end';

/** Right column shell: grow with slots; foot stays bottom via mt-auto on price row. */
export const MENU_ITEM_CARD_BODY_CLASS =
  'flex min-w-0 flex-1 flex-col gap-1.5';
