/** Typography tokens for the customer menu ordering surface (list, cart, footer, drawers). */
export const CUSTOMER_MENU_TYPE = {
  categoryTop: 'text-lg',
  categoryTopActive: 'font-medium',
  categorySub: 'text-base',
  itemName: 'text-lg font-semibold leading-tight',
  itemDesc: 'text-sm leading-relaxed',
  /** Dish price, cart line total, footer session total. */
  moneyAmount: 'text-base font-semibold tabular-nums text-brand-gold',
  itemAction: 'text-base',
  itemSoldOut: 'text-base',
  cartLineName: 'text-lg font-semibold',
  footerSummary: 'truncate text-base font-semibold text-brand-text',
  footerAmountLabel: 'text-base font-medium text-brand-text',
  footerHint: 'truncate text-base text-brand-text-muted',
  footerPrimaryAction: 'text-base font-semibold',
  drawerTitle: 'font-heading text-xl text-brand-gold',
  cartDrawerTotal: 'font-heading text-2xl font-semibold tabular-nums text-brand-gold',
} as const;
