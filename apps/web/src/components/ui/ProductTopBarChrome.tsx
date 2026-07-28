import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { dashboardTopNavButtonClass } from '@/lib/dashboard-top-nav';

/** MesaGo + restaurant name — shared by dashboard and staff sticky top bars. */
export function ProductTopBarBrand({
  href,
  restaurantName,
  logoActive = false,
}: {
  href: string;
  restaurantName: string;
  logoActive?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
      <Link
        href={href}
        className={`shrink-0 rounded-lg transition-colors ${
          logoActive ? dashboardTopNavButtonClass(true, true) : ''
        }`}
        aria-current={logoActive ? 'page' : undefined}
      >
        <ProductLogo size="sm" />
      </Link>
      <span
        className="min-w-0 truncate text-sm font-medium text-brand-text-muted sm:text-[15px]"
        title={restaurantName}
      >
        {restaurantName}
      </span>
    </div>
  );
}

/** Trailing actions slot (account menu, etc.). */
export function ProductTopBarTrailing({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center">{children}</div>;
}
