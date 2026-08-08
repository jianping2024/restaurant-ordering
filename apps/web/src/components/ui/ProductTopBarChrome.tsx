import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

/** Logo + restaurant name — FARVOO ink wordmark + ink-soft store name (floor mockup). */
export function ProductTopBarBrand({
  href,
  restaurantName,
}: {
  href: string;
  restaurantName: string;
}) {
  return (
    <div className="flex min-w-0 w-full items-baseline gap-2 sm:gap-2.5">
      <Link href={href} className="shrink-0 leading-none">
        <ProductLogo size="sm" tone="ink" />
      </Link>
      <span
        className={staffTopBarChrome.restaurantNameClassName}
        title={restaurantName}
      >
        {restaurantName}
      </span>
    </div>
  );
}

/** Trailing actions slot (account menu, license meta, etc.) — inside `staffTopBarChrome.rightClusterClassName`. */
export function ProductTopBarTrailing({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 self-stretch">
      {children}
    </div>
  );
}
