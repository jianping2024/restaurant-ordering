'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { resolveStaffSession, staffSignOut } from '@/lib/staff-auth-client';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  isDemo?: boolean;
  children: (ctx: { handleSignOut: () => void; exitLabel: string }) => ReactNode;
}

export function WaiterAuthenticatedShell({ restaurant, isDemo = false, children }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [checkingSession, setCheckingSession] = useState(!isDemo);
  const [asOwner, setAsOwner] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    const syncSession = async () => {
      const state = await resolveStaffSession(restaurant.slug, 'waiter');
      if (cancelled) return;
      if (state.status === 'ok') {
        setAsOwner(!!state.asOwner);
        setAuthenticated(true);
        setCheckingSession(false);
        return;
      }
      if (state.status === 'needs_password_change') {
        router.replace('/auth/staff/change-password');
        return;
      }
      router.replace(`/${restaurant.slug}/staff/login`);
    };
    void syncSession();
    return () => {
      cancelled = true;
    };
  }, [isDemo, restaurant.slug, router]);

  const handleSignOut = async () => {
    if (asOwner) {
      router.push('/dashboard');
      return;
    }
    if (!isDemo) await staffSignOut();
    setAuthenticated(false);
    if (!isDemo) router.replace(`/${restaurant.slug}/staff/login`);
  };

  const exitLabel = asOwner ? t.backToDashboard : t.signOut;

  if (checkingSession || !authenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted text-sm">
        …
      </div>
    );
  }

  return <>{children({ handleSignOut, exitLabel })}</>;
}
