import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { ProductTopBarRestaurantName } from '@/components/ui/ProductTopBarRestaurantName';

/** Logo + restaurant name — FARVOO ink wordmark + fitted store name (yields width). */
export function ProductTopBarBrand({
  href,
  restaurantName,
}: {
  href: string;
  restaurantName: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:gap-2.5">
      <Link href={href} className="shrink-0 leading-none">
        <ProductLogo size="sm" tone="ink" />
      </Link>
      <ProductTopBarRestaurantName name={restaurantName} />
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
