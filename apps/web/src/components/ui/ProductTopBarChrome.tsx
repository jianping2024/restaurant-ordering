import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { ProductTopBarRestaurantName } from '@/components/ui/ProductTopBarRestaurantName';

/** Logo + restaurant name — OULIN ink wordmark + fitted store name (yields width). */
export function ProductTopBarBrand({
  href,
  restaurantName,
  nameSlot,
}: {
  href: string;
  restaurantName: string;
  /** Replaces the plain name (multi-store: the store switcher). */
  nameSlot?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full flex-nowrap items-center gap-2 sm:gap-2.5 lg:w-auto">
      <Link href={href} className="shrink-0 leading-none">
        <ProductLogo size="sm" tone="ink" />
      </Link>
      {nameSlot ?? <ProductTopBarRestaurantName name={restaurantName} />}
    </div>
  );
}

/** Trailing actions slot (account menu, license meta, etc.) — inside `staffTopBarChrome.trailingClassName`. */
export function ProductTopBarTrailing({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 self-stretch">
      {children}
    </div>
  );
}
