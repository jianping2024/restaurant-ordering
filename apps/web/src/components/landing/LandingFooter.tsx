'use client';

import Link from 'next/link';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';
import { PRODUCT_NAME } from '@mesa/shared';

export function LandingFooter() {
  const copy = useLandingCopy().footer;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-border py-8 text-center">
      <p className="text-sm text-brand-muted">
        © {year} {PRODUCT_NAME} · {copy.copyright}
      </p>
      <Link
        href="/auth/login"
        className="mt-3 inline-block text-[13px] text-brand-text-muted transition-colors hover:text-brand-gold"
      >
        {copy.login}
      </Link>
    </footer>
  );
}
