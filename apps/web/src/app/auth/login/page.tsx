'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { AuthLoginForm } from '@/components/auth/AuthLoginForm';

export default function LoginPage() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin;

  return (
    <AuthPageShell
      variant="login"
      copy={{
        title: t.title,
        subtitle: t.subtitle,
        securityNote: t.securityNote,
        hero: t.hero,
      }}
    >
      <AuthLoginForm />
    </AuthPageShell>
  );
}
