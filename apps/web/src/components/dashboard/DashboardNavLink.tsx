'use client';

import Link from 'next/link';
import { DashboardNavTooltip } from '@/components/dashboard/DashboardNavTooltip';
import { dashboardNavLinkClassName } from '@/components/dashboard/dashboard-nav-link';

function CheckoutBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      className={
        collapsed
          ? 'absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full mesa-badge-danger px-1 text-[10px] font-semibold leading-none'
          : 'ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full mesa-badge-danger px-1.5 text-[11px] font-semibold'
      }
    >
      {label}
    </span>
  );
}

type DashboardNavLinkProps = {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
  external?: boolean;
};

export function DashboardNavLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onNavigate,
  badgeCount = 0,
  external = false,
}: DashboardNavLinkProps) {
  const className = dashboardNavLinkClassName(active, collapsed);
  const a11y = collapsed ? { 'aria-label': label } : undefined;
  const showBadge = badgeCount > 0;

  const content = (
    <>
      <span className={`text-lg ${showBadge && collapsed ? 'relative' : ''}`}>
        {icon}
        {showBadge && collapsed ? <CheckoutBadge count={badgeCount} collapsed /> : null}
      </span>
      <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
      {showBadge && !collapsed ? <CheckoutBadge count={badgeCount} collapsed={false} /> : null}
    </>
  );

  const wrapped = external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...a11y}
    >
      {content}
    </a>
  ) : (
    <Link href={href} onClick={onNavigate} className={className} {...a11y}>
      {content}
    </Link>
  );

  return (
    <DashboardNavTooltip label={label} show={collapsed}>
      {wrapped}
    </DashboardNavTooltip>
  );
}
