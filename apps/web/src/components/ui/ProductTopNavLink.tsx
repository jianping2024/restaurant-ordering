'use client';

import Link from 'next/link';
import type { getMessages } from '@/lib/i18n/messages';
import {
  dashboardTopNavButtonClass,
  isNavItemActive,
  topNavItemLabel,
  type ProductTopNavItem,
} from '@/lib/dashboard-top-nav';
import { shouldPrefetchDashboardNav } from '@/lib/dashboard-paths';

function CheckoutBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function topNavCheckoutCountBadge(count: number) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

type Props = {
  item: ProductTopNavItem;
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  compact: boolean;
  checkoutCount?: number;
  prefetch?: boolean;
  onNavigate?: () => void;
};

/** Inline top-bar nav link — icon-only below lg, icon + label at lg+. */
export function ProductTopNavLink({
  item,
  pathname,
  navT,
  compact,
  checkoutCount = 0,
  prefetch = false,
  onNavigate,
}: Props) {
  const active = isNavItemActive(pathname, item);
  const label = topNavItemLabel(item, navT);
  const badge = item.checkoutBadge ? checkoutCount : undefined;
  const className = dashboardTopNavButtonClass(active, compact);
  const ariaProps = compact ? { 'aria-label': label } : {};

  const content = (
    <>
      <span aria-hidden>{item.icon}</span>
      {compact ? null : <span>{label}</span>}
      {!compact && badge != null && badge > 0 ? (
        <span className="ml-0.5">{topNavCheckoutCountBadge(badge)}</span>
      ) : null}
      {compact && badge != null ? <CheckoutBadge count={badge} /> : null}
      {!compact && item.external ? (
        <span className="text-[10px] opacity-60" aria-hidden>
          ↗
        </span>
      ) : null}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
        {...ariaProps}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch={prefetch ? shouldPrefetchDashboardNav(item.href) : undefined}
      className={className}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      {...ariaProps}
    >
      {content}
    </Link>
  );
}
