/** Typography tokens for the customer menu ordering surface (list, cart, footer, drawers). */
export const CUSTOMER_MENU_TYPE = {
  /** Left rail primary category label (narrow column). */
  categoryTop: 'text-xs leading-snug',
  categoryTopActive: 'font-semibold',
  categorySub: 'text-sm',

  /** Recommended poster caption — two-line slot so prices share one baseline. */
  recommendedName: 'mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-brand-text',
  itemDesc: 'text-sm leading-relaxed',
  /** Dish price, cart line total, footer session total — body face via `.mesa-money`. */
  moneyAmount: 'mesa-money text-[15px] text-brand-gold',
  itemAction: 'text-base',
  itemSoldOut: 'text-xs font-medium text-brand-text-muted',
  cartLineName: 'text-lg font-semibold',
  footerAmountLabel: 'text-base font-medium text-brand-text',
  footerHint: 'truncate text-base text-brand-text-muted',
  footerPrimaryAction: 'text-base font-semibold',
  drawerTitle: 'font-heading text-xl text-brand-gold',
  cartDrawerTotal: 'mesa-money text-2xl text-brand-gold',
} as const;
