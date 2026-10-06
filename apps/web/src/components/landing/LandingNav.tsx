'use client';

import Link from 'next/link';
import { LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import { LanguageSwitcherIconChrome } from '@/components/ui/LanguageSwitcher';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const NAV_ITEMS = [
  { key: 'solutions' as const, href: '#solutions' },
  { key: 'flow' as const, href: '#flow' },
  { key: 'features' as const, href: '#features' },
  { key: 'team' as const, href: '#team' },
  { key: 'caseStudy' as const, href: '#case-study' },
];

export function LandingNav() {
  const copy = useLandingCopy();

  return (
    <nav className="sticky top-0 z-40 border-b border-brand-border/60 bg-brand-bg/90 backdrop-blur-md">
      <div className={`${LANDING_WRAP_CLASS} flex min-h-[68px] items-center justify-between gap-4 py-2`}>
        <div className="flex min-w-0 items-center gap-8">
          <ProductLogo size="sm" href="/" />
          <div className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="text-[14px] font-medium text-brand-text-muted transition-colors hover:text-brand-text"
              >
                {copy.nav[item.key]}
              </a>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <LanguageSwitcherIconChrome />
          <Link
            href="/auth/login"
            className="text-[13px] font-medium text-brand-text-muted transition-colors hover:text-brand-gold sm:text-sm"
          >
            {copy.nav.login}
          </Link>
          <a
            href="#contact"
            className="hidden h-10 items-center whitespace-nowrap sm:inline-flex rounded-[10px] border border-white/15 bg-[#16222b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0d161c]"
          >
            {copy.nav.demo}
          </a>
        </div>
      </div>
    </nav>
  );
}
