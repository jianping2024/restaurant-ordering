'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { ProductTopBarNav } from '@/components/ui/ProductTopBarNav';
import {
  buildTopNavPresentation,
  isTopBarLogoHrefActive,
  type ProductTopNavItem,
} from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  logoHref: string;
  restaurantName: string;
  navItems: ProductTopNavItem[];
  settingsMenu: ReactNode;
};

/** Sticky personal-app top bar — logo, restaurant, role nav, account menu. */
export function StaffPersonalTopBar({
  logoHref,
  restaurantName,
  navItems,
  settingsMenu,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const { items, quickActions } = buildTopNavPresentation(navItems, logoHref, {
    promoteAllExceptLogo: true,
  });
  const logoActive = isTopBarLogoHrefActive(pathname, logoHref);

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <ProductTopBarBrand
          href={logoHref}
          restaurantName={restaurantName}
          logoActive={logoActive}
        />

        <ProductTopBarNav
          items={items}
          quickActions={quickActions}
          pathname={pathname}
          navT={navT}
        />

        <ProductTopBarTrailing>{settingsMenu}</ProductTopBarTrailing>
      </div>
    </header>
  );
}
