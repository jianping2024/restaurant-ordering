'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { ProductTopBarMenu } from '@/components/ui/ProductTopBarMenu';
import type { ProductTopNavItem, StaffTopBarNavSurface } from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  logoHref: string;
  restaurantName: string;
  navItems: ProductTopNavItem[];
  navSurface?: StaffTopBarNavSurface;
  settingsMenu: ReactNode;
};

/** Sticky personal-app top bar — logo, restaurant, hamburger nav, account menu. */
export function StaffPersonalTopBar({
  logoHref,
  restaurantName,
  navItems,
  navSurface = 'hamburger-only',
  settingsMenu,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <div className={staffTopBarChrome.leadingClassName}>
          <ProductTopBarBrand href={logoHref} restaurantName={restaurantName} />

          <ProductTopBarMenu
            items={navItems}
            pathname={pathname}
            navT={navT}
            navSurface={navSurface}
            open={navOpen}
            onOpenChange={setNavOpen}
          />
        </div>

        <ProductTopBarTrailing>{settingsMenu}</ProductTopBarTrailing>
      </div>
    </header>
  );
}
