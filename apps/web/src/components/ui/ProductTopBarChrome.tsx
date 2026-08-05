import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';

/** Logo + restaurant name — name truncates on narrow viewports; full name in title. */
export function ProductTopBarBrand({
  href,
  restaurantName,
}: {
  href: string;
  restaurantName: string;
}) {
  return (
    <div className="flex min-w-0 w-full items-center gap-1.5 sm:gap-2">
      <Link href={href} className="shrink-0">
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

/** Trailing actions slot (account menu, license meta, etc.) — fixed on the right, never shrinks the row wide. */
export function ProductTopBarTrailing({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 self-stretch">
      {children}
    </div>
  );
}
