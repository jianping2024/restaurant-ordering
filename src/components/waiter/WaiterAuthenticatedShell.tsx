'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { useLanguage } from '@/components/providers/LanguageProvider';

const WAITER_UNLOCK_TTL_MS = 8 * 60 * 60 * 1000;

interface Props {
  restaurant: { id: string; name: string; waiter_password: string };
  isDemo?: boolean;
  children: (ctx: { handleLock: () => void }) => ReactNode;
}

export function WaiterAuthenticatedShell({ restaurant, isDemo = false, children }: Props) {
  const waiterUnlockStorageKey = `mesa_waiter_unlock_${restaurant.id}`;
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    const raw = window.localStorage.getItem(waiterUnlockStorageKey);
    if (!raw) return;
    const unlockedAt = Number(raw);
    if (!Number.isFinite(unlockedAt)) {
      window.localStorage.removeItem(waiterUnlockStorageKey);
      return;
    }
    if (Date.now() - unlockedAt <= WAITER_UNLOCK_TTL_MS) {
      setAuthenticated(true);
      return;
    }
    window.localStorage.removeItem(waiterUnlockStorageKey);
  }, [isDemo, waiterUnlockStorageKey]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === restaurant.waiter_password) {
      setAuthenticated(true);
      setPwError(false);
      if (!isDemo) window.localStorage.setItem(waiterUnlockStorageKey, String(Date.now()));
    } else {
      setPwError(true);
      setPassword('');
    }
  };

  const handleLock = () => {
    if (!isDemo) window.localStorage.removeItem(waiterUnlockStorageKey);
    setAuthenticated(false);
    setPassword('');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">{isDemo ? t.demoTitle : t.regularTitle}</h1>
          <p className="text-brand-text-muted text-sm text-center mb-6">{restaurant.name}</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-brand-text-muted block mb-1.5">{t.passwordLabel}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-brand-text focus:outline-none focus:border-brand-gold/50"
                placeholder="••••"
                autoFocus
              />
            </div>
            {pwError && <p className="text-red-400 text-sm text-center">{t.wrongPassword}</p>}
            <button
              type="submit"
              className="w-full bg-brand-gold text-brand-bg py-3 rounded-xl font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {isDemo ? t.enterDemo : t.enterRegular}
            </button>
          </form>
          {isDemo && (
            <p className="mt-3 text-center text-[13px] text-brand-text-muted">
              {t.passwordHint} <span className="text-brand-gold font-semibold">0000</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children({ handleLock })}
    </>
  );
}
