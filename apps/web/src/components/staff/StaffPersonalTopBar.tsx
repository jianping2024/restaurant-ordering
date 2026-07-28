'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { ProductTopBarMenu } from '@/components/ui/ProductTopBarMenu';
import type { ProductTopNavItem } from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  logoHref: string;
  restaurantName: string;
  navItems: ProductTopNavItem[];
  settingsMenu: ReactNode;
  navOpen?: boolean;
  onNavOpenChange?: (open: boolean) => void;
  checkoutCount?: number;
  prefetch?: boolean;
  onNavigate?: () => void;
};

/** Sticky personal-app top bar — brand, scroll nav (desktop) / hamburger (mobile), account menu. */
export function StaffPersonalTopBar({
  logoHref,
  restaurantName,
  navItems,
  settingsMenu,
  navOpen: controlledNavOpen,
  onNavOpenChange,
  checkoutCount,
  prefetch,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const [uncontrolledNavOpen, setUncontrolledNavOpen] = useState(false);
  const navOpen = controlledNavOpen ?? uncontrolledNavOpen;
  const setNavOpen = onNavOpenChange ?? setUncontrolledNavOpen;

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <div className={staffTopBarChrome.brandClassName}>
          <ProductTopBarBrand href={logoHref} restaurantName={restaurantName} />
        </div>

        <ProductTopBarMenu
          items={navItems}
          pathname={pathname}
          navT={navT}
          checkoutCount={checkoutCount}
          prefetch={prefetch}
          open={navOpen}
          onOpenChange={setNavOpen}
          onNavigate={onNavigate}
        />

        <ProductTopBarTrailing>{settingsMenu}</ProductTopBarTrailing>
      </div>
    </header>
  );
}
