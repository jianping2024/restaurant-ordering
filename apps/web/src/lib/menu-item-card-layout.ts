/**
 * Menu list card — fixed price / action row (MenuItemCard).
 * Single grid contract: price column + 6.75rem action column (compact stepper).
 */

/** Tailwind JIT: keep grid template as one static string. */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-2';

export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex items-center justify-end';
