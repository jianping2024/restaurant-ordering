'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(t.invalid);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <span className="font-heading text-4xl text-brand-gold tracking-wider">Mesa</span>
            </Link>
            <LanguageSwitcher compact />
          </div>
          <p className="text-brand-text-muted text-sm mt-2">{t.subtitle}</p>
        </div>

        {/* 表单 */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label={t.email}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label={t.password}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {t.login}
            </Button>
          </form>

          <p className="text-center text-brand-text-muted text-sm mt-6">
            {t.noAccount}{' '}
            <Link href="/auth/register" className="text-brand-gold hover:underline">
              {t.register}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
