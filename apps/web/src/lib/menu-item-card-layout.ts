/**
 * Sole menu catalog card + list grid (MenuItemCard — guest and staff-assisted).
 *
 * JD-style list rhythm: square thumb is the height anchor; right column matches thumb height.
 * Slots: name ≤2 lines → flavor ≤1 row (only when flavor hints enabled; empty still reserved)
 * → foot price + action. List never shows description (detail only).
 *
 * Shell never uses overflow-hidden: clip only on thumb / name / flavor. Foot action
 * (bare + or CartQtyStepper density=compact) must stay fully visible inside the
 * rounded face — padding must be ≥ border-radius (p-4 with rounded-2xl) so corner
 * buttons do not paint past the card outline.
 */

/** Catalog list: 1 col phone, 2 col lg, 3 col xl — sole list container class. */
export const CUSTOMER_MENU_ITEM_LIST_CLASS =
  'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3';

/** List thumb edge — sole square size (112px). */
export const MENU_ITEM_CARD_THUMB_PX = 112;

/**
 * Card chrome — sole list shell. No overflow-hidden (foot −/n/+ must not be clipped).
 * Padding ≥ radius: p-4 with rounded-2xl keeps corner actions inside the face.
 * Available vs sold-out border/opacity stay at the call site.
 */
export const MENU_ITEM_CARD_SHELL_CLASS =
  'bg-brand-card border rounded-2xl p-4 flex min-w-0 gap-3 h-full';

/** List thumb: 112×112, top-aligned. */
export const MENU_ITEM_CARD_THUMB_CLASS =
  'relative flex h-[7rem] w-[7rem] shrink-0 items-center justify-center overflow-hidden rounded-xl self-start';

/**
 * Name slot: 15px / 1.3 × 2 lines = 39px.
 * Sole list title face for MenuItemCard.
 */
export const MENU_ITEM_CARD_NAME_CLASS =
  'h-[2.4375rem] min-h-[2.4375rem] overflow-hidden break-words text-[15px] font-semibold leading-[1.3] text-brand-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]';

/**
 * Flavor band: one chip row (~22px).
 * Used only while menu_flavor_hints_enabled; empty codes still occupy the slot.
 */
export const MENU_ITEM_CARD_FLAVOR_SLOT_CLASS =
  'flex h-[1.375rem] min-h-[1.375rem] flex-nowrap items-center gap-1 overflow-hidden';

/** Price + action: content-width action; pinned to bottom of thumb-matched body. */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'mt-auto flex h-9 min-w-0 shrink-0 items-center justify-between gap-2';

export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex shrink-0 items-center justify-end';

/**
 * Right column: exact thumb height so name/flavor sit top and price/action sit on the image baseline.
 */
export const MENU_ITEM_CARD_BODY_CLASS =
  'flex h-[7rem] min-h-[7rem] min-w-0 flex-1 flex-col';

/** Optional sushi limit line between flavor and foot — never a description slot. */
export const MENU_ITEM_CARD_LIMIT_HINT_CLASS =
  'mt-0.5 line-clamp-1 text-[11px] leading-snug text-brand-text-muted';
