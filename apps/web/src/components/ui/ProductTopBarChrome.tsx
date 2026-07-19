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
    <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
      <Link href={href} className="shrink-0">
        <ProductLogo size="sm" />
      </Link>
      <span
        className="min-w-0 max-w-[7rem] truncate text-sm font-medium text-brand-text-muted sm:max-w-[12rem] sm:text-[15px]"
        title={restaurantName}
      >
        {restaurantName}
      </span>
    </div>
  );
}

/** Actor role label + settings/actions slot on the right of product top bars. */
export function ProductTopBarTrailing({
  roleLabel,
  children,
}: {
  roleLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      <span
        className="max-w-[4.5rem] truncate text-sm text-brand-text-muted sm:max-w-none"
        title={roleLabel}
      >
        {roleLabel}
      </span>
      {children}
    </div>
  );
}
