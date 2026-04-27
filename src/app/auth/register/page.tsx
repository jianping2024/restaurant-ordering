'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

export default function RegisterClosedPage() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authRegister;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <span className="font-heading text-4xl text-brand-gold tracking-wider">Mesa</span>
          </Link>
          <LanguageSwitcher compact />
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
          <h1 className="font-heading text-2xl text-brand-text mb-3">{t.closedTitle}</h1>
          <p className="text-brand-text-muted text-sm leading-relaxed mb-6">{t.closedBody}</p>
          <Link
            href="/auth/login"
            className="inline-flex w-full justify-center rounded-xl bg-brand-gold text-brand-bg py-3 font-semibold hover:bg-brand-gold-light transition-colors"
          >
            {t.closedToLogin}
          </Link>
        </div>
      </div>
    </div>
  );
}
