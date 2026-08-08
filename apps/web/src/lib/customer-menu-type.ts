/** Typography tokens for the customer menu ordering surface (list, cart, footer, drawers). */
export const CUSTOMER_MENU_TYPE = {
  categoryTop: 'text-lg',
  categoryTopActive: 'font-medium',
  categorySub: 'text-base',
  itemName: 'text-lg font-semibold leading-tight',
  itemDesc: 'text-sm leading-relaxed',
  /** Dish price, cart line total, footer session total — body face via `.mesa-money`. */
  moneyAmount: 'mesa-money text-[15px] text-brand-gold',
  itemAction: 'text-base',
  itemSoldOut: 'text-xs font-medium text-brand-text-muted',
  cartLineName: 'text-lg font-semibold',
  footerSummary: 'truncate text-base font-semibold text-brand-text',
  footerAmountLabel: 'text-base font-medium text-brand-text',
  footerHint: 'truncate text-base text-brand-text-muted',
  footerPrimaryAction: 'text-base font-semibold',
  drawerTitle: 'font-heading text-xl text-brand-gold',
  cartDrawerTotal: 'mesa-money text-2xl text-brand-gold',
} as const;
