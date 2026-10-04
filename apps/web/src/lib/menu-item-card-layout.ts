/**
 * Sole menu catalog card + list grid (MenuItemCard — guest and staff-assisted).
 *
 * JD-style list rhythm: square thumb is the height anchor; right column is at least
 * thumb height and may grow when name + flavor + foot exceed it (narrow + flavor on).
 * Slots: name ≤2 lines → flavor ≤1 row (only when flavor hints enabled; empty still reserved)
 * → foot price + action. List never shows description (detail only).
 *
 * Shell never uses overflow-hidden: clip only on thumb / name / flavor. Foot action
 * (bare + or CartQtyStepper density=compact) must stay fully visible inside the
 * rounded face — pad/radius scale with catalog container (see globals.css
 * `.mesa-menu-item-card`): narrow 88px thumb + p-3/rounded-xl; ≥40rem host 112px
 * + p-4/rounded-2xl.
 */

/**
 * Catalog list host — sole container for column queries (not the viewport).
 * Staff「继续点餐」overlay is ~max-w-4xl; viewport `xl:3` would make cards too
 * narrow for price + compact −/n/+. Pair with CUSTOMER_MENU_ITEM_LIST_CLASS.
 */
export const CUSTOMER_MENU_ITEM_LIST_HOST_CLASS = 'mesa-menu-catalog-host';

/**
 * Catalog list grid — sole list class. Columns via @container on the host:
 * 1 → ≥40rem 2 → ≥62rem 3 (see globals.css).
 */
export const CUSTOMER_MENU_ITEM_LIST_CLASS = 'mesa-menu-item-list';

/** Narrow one-column catalog thumb (phone). */
export const MENU_ITEM_CARD_THUMB_PX_NARROW = 88;
/** Wide catalog thumb (≥40rem host / 2–3 cols). */
export const MENU_ITEM_CARD_THUMB_PX_WIDE = 112;
/**
 * Image `sizes` upper bound — sole numeric export for next/image.
 * Live edge length is CSS `--mesa-menu-card-thumb` (88 → 112 at 40rem).
 */
export const MENU_ITEM_CARD_THUMB_PX = MENU_ITEM_CARD_THUMB_PX_WIDE;

/**
 * Card chrome — sole list shell class. Pad/radius/gap/thumb size live in
 * globals `.mesa-menu-item-card` (container-driven). No overflow-hidden.
 * Available vs sold-out border/opacity stay at the call site.
 */
export const MENU_ITEM_CARD_SHELL_CLASS =
  'mesa-menu-item-card bg-brand-card border flex min-w-0 h-full';

/** List thumb: size via `--mesa-menu-card-thumb`, top-aligned. */
export const MENU_ITEM_CARD_THUMB_CLASS =
  'relative flex h-[var(--mesa-menu-card-thumb)] w-[var(--mesa-menu-card-thumb)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--mesa-menu-card-thumb-radius)] self-start';

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

/**
 * Price + action: content-width action; pinned to bottom of thumb-matched body.
 * `relative` anchors the expanded qty pill, which overlays the whole row.
 */
export const MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS =
  'relative mt-auto flex h-9 min-w-0 shrink-0 items-center justify-between gap-2';

/**
 * Sole list price slot — at rest the action is one 36px gold circle (+ or qty),
 * so price stays visible. Pair with `CUSTOMER_MENU_TYPE.moneyAmount` at the call site.
 */
export const MENU_ITEM_CARD_PRICE_CLASS = 'min-w-0 truncate';

/** Sole list action slot — never shrinks; the 36px gold circle stays fully visible. */
export const MENU_ITEM_CARD_ACTION_SLOT_CLASS = 'flex shrink-0 items-center justify-end';

/**
 * Sole list gold circle — bare `+` (qty 0), collapsed qty number, and the pill's `+`
 * share it so the action never moves or changes chrome between states.
 */
export const MENU_ITEM_CARD_GOLD_ACTION_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-on-gold shadow-[0_4px_10px_rgb(139_101_48_/_0.28)] transition-colors hover:bg-brand-gold-light active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

/**
 * Expanded −/qty/+ pill — overlays the full price row (price hidden only while editing);
 * `+` stays at the gold circle's spot. Reveal keyframe in globals `.mesa-menu-qty-pill`.
 */
export const MENU_ITEM_CARD_QTY_PILL_CLASS =
  'mesa-menu-qty-pill absolute inset-0 z-10 flex items-center justify-between rounded-full border border-brand-gold/35 bg-brand-card';

/** Pill `−`: gold ghost circle (same 36px hit target as the gold `+`). */
export const MENU_ITEM_CARD_QTY_DECREMENT_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-gold hover:bg-brand-gold/10 active:scale-95';

/** `+` / `−` glyph face inside the 36px circles (pill and bare add share it). */
export const MENU_ITEM_CARD_ACTION_GLYPH_CLASS = 'text-xl font-medium leading-none';

/**
 * Qty number face — collapsed gold circle and pill center. Three digits (≤ 999 cap)
 * step down one size so the 36px circle keeps air.
 */
export function menuItemCardQtyTextClass(qty: number): string {
  return `${qty >= 100 ? 'text-sm' : 'text-base'} font-semibold tabular-nums`;
}

/** Idle ms before the expanded pill collapses back to the gold qty circle. */
export const MENU_ITEM_CARD_QTY_PILL_COLLAPSE_MS = 3000;

/**
 * Right column: min thumb height so short cards stay image-baseline aligned; grows when
 * reserved slots exceed thumb (keeps price/action inside card pad).
 */
export const MENU_ITEM_CARD_BODY_CLASS =
  'flex min-h-[var(--mesa-menu-card-thumb)] min-w-0 flex-1 flex-col';

/** Optional sushi limit line between flavor and foot — never a description slot. */
export const MENU_ITEM_CARD_LIMIT_HINT_CLASS =
  'mt-0.5 line-clamp-1 text-[11px] leading-snug text-brand-text-muted';
