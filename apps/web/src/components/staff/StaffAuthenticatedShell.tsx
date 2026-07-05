'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { StaffRole } from '@/lib/staff-account';
import { staffSignOut } from '@/lib/staff-auth-client';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export type StaffShellContext = {
  handleSignOut: () => void;
  exitLabel: string;
  confirmBeforeSignOut: boolean;
};

type Props = {
  restaurant: { id: string; name: string; slug: string };
  expectedRole: StaffRole;
  asOwner?: boolean;
  isDemo?: boolean;
  children: (ctx: StaffShellContext) => ReactNode;
};

function exitLabels(lang: UILanguage, role: StaffRole) {
  if (role === 'kitchen') {
    const k = getMessages(lang).kitchen;
    return { signOut: k.signOut, backToDashboard: k.backToDashboard };
  }
  const w = WAITER_TEXT[lang];
  return { signOut: w.signOut, backToDashboard: w.backToDashboard };
}

export function StaffAuthenticatedShell({
  restaurant,
  expectedRole,
  asOwner = false,
  isDemo = false,
  children,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const labels = exitLabels(lang, expectedRole);

  const handleSignOut = async () => {
    if (asOwner) {
      router.push('/dashboard');
      return;
    }
    if (!isDemo) await staffSignOut();
    if (!isDemo) router.replace(`/${restaurant.slug}/staff/login`);
  };

  const exitLabel = asOwner ? labels.backToDashboard : labels.signOut;
  const confirmBeforeSignOut = !asOwner && !isDemo;

  return <>{children({ handleSignOut, exitLabel, confirmBeforeSignOut })}</>;
}
