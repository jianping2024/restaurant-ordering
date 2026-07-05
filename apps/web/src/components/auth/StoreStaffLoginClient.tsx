'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { AuthLoginForm } from '@/components/auth/AuthLoginForm';

type Props = {
  storeSlug: string;
  restaurantName: string;
};

export function StoreStaffLoginClient({ storeSlug, restaurantName }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin;

  return (
    <AuthPageShell
      variant="login"
      copy={{
        title: t.title,
        subtitle: t.subtitle,
        contextLine: restaurantName,
        securityNote: t.staffSecurityNote,
      }}
    >
      <AuthLoginForm storeSlug={storeSlug} />
    </AuthPageShell>
  );
}
