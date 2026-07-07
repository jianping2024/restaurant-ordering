'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const NAV_ITEMS = [
  { key: 'solutions' as const, href: '#solutions' },
  { key: 'preview' as const, href: '#preview' },
  { key: 'caseStudy' as const, href: '#case-study' },
  { key: 'contact' as const, href: '#contact' },
];

export function LandingNav() {
  const copy = useLandingCopy();

  return (
    <nav className="sticky top-0 z-40 border-b border-brand-border bg-brand-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <ProductLogo size="sm" href="/" />
        <div className="hidden items-center gap-5 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="text-[14px] text-brand-text-muted transition-colors hover:text-brand-gold"
            >
              {copy.nav[item.key]}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher compact />
          <Link
            href="/auth/login"
            className="text-[13px] text-brand-text-muted transition-colors hover:text-brand-gold sm:text-sm"
          >
            {copy.nav.login}
          </Link>
        </div>
      </div>
    </nav>
  );
}
