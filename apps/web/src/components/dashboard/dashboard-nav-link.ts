export function dashboardNavLinkClassName(active: boolean): string {
  return [
    'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] leading-6 transition-all',
    active
      ? 'bg-brand-gold/15 text-brand-gold font-medium'
      : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-border/50',
  ].join(' ');
}
