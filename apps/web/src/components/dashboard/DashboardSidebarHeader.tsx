import Image from 'next/image';
import { ProductLogo } from '@/components/ui/ProductLogo';

type DashboardSidebarHeaderProps = {
  logoUrl?: string | null;
  restaurantName: string;
  onCloseMobile?: () => void;
};

export function DashboardSidebarHeader({
  logoUrl,
  restaurantName,
  onCloseMobile,
}: DashboardSidebarHeaderProps) {
  return (
    <div className="relative shrink-0 border-b border-brand-border px-4 py-5 lg:py-6">
      {onCloseMobile ? (
        <button
          type="button"
          onClick={onCloseMobile}
          className="absolute right-4 top-5 h-8 w-8 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text lg:hidden"
          aria-label="Close menu"
        >
          ×
        </button>
      ) : null}
      <div className="flex w-full flex-col items-center text-center">
        <ProductLogo size="md" />
        {logoUrl ? (
          <div className="mt-2 flex w-full justify-center">
            <Image
              src={logoUrl}
              alt={restaurantName}
              width={192}
              height={48}
              className="h-10 w-auto max-w-full object-contain"
              priority
            />
          </div>
        ) : (
          <p className="mt-1 max-w-full truncate text-center text-sm text-brand-text-muted">
            {restaurantName}
          </p>
        )}
      </div>
    </div>
  );
}
