'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { composeStaffEmail } from '@/lib/staff-account';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffRole } from '@/lib/staff-account';

type Props = {
  mode: 'store' | 'global';
  slug?: string;
  restaurantName?: string;
  expectedRole?: StaffRole;
};

export function StaffLoginForm({ mode, slug, restaurantName, expectedRole }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);

    const email = composeStaffEmail(login, mode);

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        path?: string;
        must_change_password?: boolean;
        role?: StaffRole;
        slug?: string;
        error?: string;
      };

      if (res.status === 429 || json.error === 'rate_limited') {
        setError(t.rateLimited);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (!res.ok || !json.ok) {
        if (json.error === 'redirect_failed') {
          setError(t.serverError);
        } else {
          setError(t.invalid);
        }
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (expectedRole && json.role !== expectedRole) {
        setError(t.wrongRole);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (mode === 'store' && slug && json.slug !== slug) {
        setError(t.wrongStore);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (json.path) {
        window.location.assign(json.path);
        return;
      }
    } catch {
      setError(t.network);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">{t.title}</h1>
          {restaurantName ? (
            <p className="text-brand-text-muted text-sm text-center mb-6">{restaurantName}</p>
          ) : (
            <p className="text-brand-text-muted text-sm text-center mb-6">{t.subtitle}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <Input
              label={mode === 'global' ? t.email : t.loginName}
              type={mode === 'global' ? 'email' : 'text'}
              autoComplete={mode === 'global' ? 'email' : 'username'}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              disabled={loading}
              placeholder={mode === 'global' ? t.emailPlaceholder : t.loginNamePlaceholder}
            />
            <Input
              label={t.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            {error ? <p className="mesa-text-danger text-sm text-center">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {t.submit}
            </Button>
          </form>

          {mode === 'store' && slug ? (
            <p className="mt-4 text-center text-[13px] text-brand-text-muted">
              <Link href="/auth/staff/login" className="text-brand-gold hover:underline">
                {t.globalLoginLink}
              </Link>
            </p>
          ) : null}
        </div>
    </div>
  );
}
