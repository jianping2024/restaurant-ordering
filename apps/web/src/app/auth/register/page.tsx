'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { ButtonLink } from '@/components/ui/Button';

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
      <ButtonLink href="/auth/login" size="action" className="w-full">
        {t.closedToLogin}
      </ButtonLink>
    </AuthPageShell>
  );
}
