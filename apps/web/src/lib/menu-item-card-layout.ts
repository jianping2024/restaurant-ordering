/**
 * Sole menu catalog card + list grid (MenuItemCard — guest and staff-assisted).
 * Single grid contract: price column + 6.75rem action column (compact stepper).
 */

/** Catalog list: 1 col phone, 2 col lg, 3 col xl — sole list container class. */
export const CUSTOMER_MENU_ITEM_LIST_CLASS =
  'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3';

/** Tailwind JIT: keep grid template as one static string. */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-2';

export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex items-center justify-end';
