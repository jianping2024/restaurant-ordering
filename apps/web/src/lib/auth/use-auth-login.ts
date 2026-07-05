'use client';

import { useRef, useState } from 'react';
import { getMessages } from '@/lib/i18n/messages';
import { useLanguage } from '@/components/providers/LanguageProvider';

export type AuthLoginResponse = {
  ok?: boolean;
  kind?: 'owner' | 'onboarding' | 'staff';
  path?: string;
  slug?: string;
  role?: string;
  error?: string;
  retry_after_sec?: number;
};

type Options = {
  storeSlug?: string;
};

export function useAuthLogin(options: Options = {}) {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin;
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account: account.trim(), password }),
      });

      const json = (await res.json().catch(() => ({}))) as AuthLoginResponse;

      if (res.status === 429 || json.error === 'rate_limited') {
        const retrySec = json.retry_after_sec;
        const mins = retrySec ? Math.max(1, Math.ceil(retrySec / 60)) : 5;
        setError(t.rateLimitedWithMinutes.replace('{minutes}', String(mins)));
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (!res.ok || !json.ok || !json.path) {
        if (json.error === 'disabled') {
          setError(t.staffDisabled);
        } else if (json.error === 'incomplete') {
          setError(t.staffIncomplete);
        } else if (json.error === 'restaurant_suspended') {
          setError(t.restaurantSuspended);
        } else if (json.error === 'redirect_failed') {
          setError(t.serverError);
        } else {
          setError(t.invalid);
        }
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (options.storeSlug && json.kind === 'staff' && json.slug !== options.storeSlug) {
        setError(t.wrongStore);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      window.location.assign(json.path);
    } catch {
      setError(t.network);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return {
    account,
    setAccount,
    password,
    setPassword,
    loading,
    error,
    submit,
    t,
  };
}
