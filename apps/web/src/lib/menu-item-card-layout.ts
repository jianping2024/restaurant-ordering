import { MESA_RELIEF } from '@/lib/mesa-relief-chrome';

/**
 * Menu list card — fixed price / action row (MenuItemCard).
 * Single grid contract: price column + 6.75rem action column (compact stepper).
 * Shell chrome is gold-relief only (shadow); padding/gap/type stay fixed.
 */

/** Outer card shell — border + relief elevation (no size change). */
export const MENU_ITEM_CARD_SHELL_CLASS =
  `bg-brand-card border border-brand-border rounded-2xl p-3 flex min-w-0 gap-3 h-full overflow-hidden ${MESA_RELIEF.card}`;

/** Tailwind JIT: keep grid template as one static string. */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-2';

export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex items-center justify-end';
