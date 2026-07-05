'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { AuthIconTextRow } from '@/components/auth/AuthIconTextRow';
import { AuthClockIcon, AuthHeadsetIcon, AuthShieldIcon } from '@/components/auth/auth-icons';
import { getMessages } from '@/lib/i18n/messages';

export function AuthTrustBadges() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin.trustBadges;

  const items = [
    { icon: AuthShieldIcon, title: t.secureTitle, body: t.secureBody },
    { icon: AuthClockIcon, title: t.efficientTitle, body: t.efficientBody },
    { icon: AuthHeadsetIcon, title: t.supportTitle, body: t.supportBody },
  ];

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
      {items.map(({ icon, title, body }) => (
        <div
          key={title}
          className="rounded-xl border border-brand-border/80 bg-brand-card/80 px-4 py-3"
        >
          <AuthIconTextRow icon={icon}>
            <p className="text-sm font-medium text-brand-text">{title}</p>
            <p className="text-[12px] text-brand-text-muted mt-1 leading-snug">{body}</p>
          </AuthIconTextRow>
        </div>
      ))}
    </div>
  );
}
