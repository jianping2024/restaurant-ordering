export function dashboardNavLinkClassName(active: boolean, collapsed = false): string {
  return [
    'relative flex items-center rounded-xl text-[15px] leading-6 transition-all',
    collapsed ? 'mx-auto w-11 justify-center gap-0 px-0 py-3' : 'gap-3 px-4 py-3',
    active
      ? collapsed
        ? 'bg-brand-gold/15 font-medium text-brand-gold before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-gold'
        : 'bg-brand-gold/15 font-medium text-brand-gold'
      : 'text-brand-text-muted hover:bg-brand-border/50 hover:text-brand-text',
  ].join(' ');
}
