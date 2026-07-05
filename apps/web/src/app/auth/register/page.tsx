'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { AuthPageShell } from '@/components/auth/AuthPageShell';

export default function RegisterClosedPage() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authRegister;

  return (
    <AuthPageShell
      variant="info"
      copy={{
        title: t.closedTitle,
        subtitle: t.closedBody,
      }}
    >
      <Link
        href="/auth/login"
        className="inline-flex w-full justify-center rounded-xl bg-brand-gold text-brand-on-gold py-3 font-semibold hover:bg-brand-gold-light transition-colors"
      >
        {t.closedToLogin}
      </Link>
    </AuthPageShell>
  );
}
