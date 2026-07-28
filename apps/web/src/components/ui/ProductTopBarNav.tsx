'use client';

import type { getMessages } from '@/lib/i18n/messages';
import { ProductTopNavLink } from '@/components/ui/ProductTopNavLink';
import type { ProductTopNavItem } from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  items: ProductTopNavItem[];
  quickActions: ProductTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount?: number;
  prefetch?: boolean;
  onNavigate?: () => void;
};

/** Shared inline nav row for dashboard and staff personal top bars. */
export function ProductTopBarNav({
  items,
  quickActions,
  pathname,
  navT,
  checkoutCount = 0,
  prefetch = false,
  onNavigate,
}: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={navT.mainNav} className={staffTopBarChrome.navClassName}>
      {quickActions.length > 0 ? (
        <div className="flex items-center gap-1 lg:hidden">
          {quickActions.map((item) => (
            <ProductTopNavLink
              key={item.id}
              item={item}
              pathname={pathname}
              navT={navT}
              compact
              checkoutCount={checkoutCount}
              prefetch={prefetch}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
      <div className="hidden lg:flex items-center gap-1.5">
        {items.map((item) => (
          <ProductTopNavLink
            key={item.id}
            item={item}
            pathname={pathname}
            navT={navT}
            compact={false}
            checkoutCount={checkoutCount}
            prefetch={prefetch}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}
