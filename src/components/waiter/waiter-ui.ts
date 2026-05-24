/** Shared waiter surface styles (borderless pills; avoids harsh 1px outlines on gold buttons). */
export const waiterUi = {
  btnPrimary:
    'inline-flex items-center border-0 outline-none no-underline text-[14px] font-semibold px-4 py-2.5 rounded-xl bg-brand-gold text-brand-bg shadow-sm shadow-black/10 hover:bg-brand-gold-light active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-brand-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-card',
  btnSecondary:
    'border-0 outline-none rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/30',
  btnGhost: 'bg-brand-border/35 text-brand-text hover:bg-brand-border/55',
  btnWarm: 'bg-amber-500/14 text-amber-950/90 hover:bg-amber-500/24',
  btnDanger: 'bg-rose-500/12 text-rose-900/90 hover:bg-rose-500/22',
  btnGoldSoft:
    'inline-flex border-0 outline-none no-underline rounded-lg px-3 py-1.5 text-[12px] font-medium bg-brand-gold/14 text-brand-gold-dark hover:bg-brand-gold/24 transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/35',
  btnBuffet:
    'border-0 outline-none text-[12px] px-3 py-2 rounded-lg bg-brand-gold text-brand-bg font-medium shadow-sm shadow-black/8 hover:bg-brand-gold-light disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/40',
  badgePending: 'px-2.5 py-0.5 rounded-full border-0 bg-red-500/12 text-red-800',
  badgeCooking: 'px-2.5 py-0.5 rounded-full border-0 bg-amber-500/14 text-amber-900',
  badgeReady: 'px-2.5 py-0.5 rounded-full border-0 bg-emerald-500/14 text-emerald-900',
  navLink:
    'inline-flex border-0 no-underline text-[13px] rounded-lg px-3 py-1.5 text-brand-text-muted bg-brand-border/25 hover:bg-brand-border/45 hover:text-brand-text transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/30',
} as const;
