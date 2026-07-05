'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M12 3 4 6v6c0 5 3.5 9 8 9s8-4 8-9V6l-8-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 12a8 8 0 0 1 16 0v4a3 3 0 0 1-3 3h-1v-5h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v1a3 3 0 0 0 3 3h1v-4H4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AuthTrustBadges() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin.trustBadges;

  const items = [
    { icon: ShieldIcon, title: t.secureTitle, body: t.secureBody },
    { icon: ClockIcon, title: t.efficientTitle, body: t.efficientBody },
    { icon: HeadsetIcon, title: t.supportTitle, body: t.supportBody },
  ];

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
      {items.map(({ icon: Icon, title, body }) => (
        <div
          key={title}
          className="rounded-xl border border-brand-border/80 bg-brand-card/80 px-4 py-3 text-center sm:text-left"
        >
          <Icon className="w-5 h-5 text-brand-gold mx-auto sm:mx-0 mb-2" />
          <p className="text-sm font-medium text-brand-text">{title}</p>
          <p className="text-[12px] text-brand-text-muted mt-1 leading-snug">{body}</p>
        </div>
      ))}
    </div>
  );
}
