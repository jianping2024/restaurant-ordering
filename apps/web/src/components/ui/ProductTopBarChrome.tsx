import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';

/** MesaGo + restaurant name — shared by dashboard and staff sticky top bars. */
export function ProductTopBarBrand({
  href,
  restaurantName,
}: {
  href: string;
  restaurantName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      <Link href={href} className="shrink-0">
        <ProductLogo size="sm" />
      </Link>
      <span
        className="min-w-0 text-sm font-medium text-brand-text-muted whitespace-nowrap sm:text-[15px]"
        title={restaurantName}
      >
        {restaurantName}
      </span>
    </div>
  );
}

/** Trailing actions slot (account menu, etc.). */
export function ProductTopBarTrailing({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex shrink-0 items-center">{children}</div>;
}
