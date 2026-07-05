/** Fixed dashboard sidebar width (224px). */
export const DASHBOARD_SIDEBAR_WIDTH = 'w-56';

export function dashboardNavLinkClassName(active: boolean): string {
  return [
    'relative flex w-full items-center justify-center gap-3 px-4 py-3 rounded-xl text-[15px] leading-6 transition-all',
    active
      ? 'bg-brand-gold/15 text-brand-gold font-medium'
      : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-border/50',
  ].join(' ');
}

export const dashboardNavCheckoutBadgeClassName =
  'absolute right-2 top-1/2 inline-flex h-5 min-w-[20px] -translate-y-1/2 items-center justify-center rounded-full mesa-badge-danger px-1.5 text-[11px] font-semibold';
