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

// 将餐厅名转换为 slug
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // 去除变音符号
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function RegisterPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).authRegister;
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t.passwordLength);
      return;
    }
    if (!restaurantName.trim()) {
      setError(t.restaurantRequired);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 1. 注册用户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message === 'User already registered'
          ? t.alreadyRegistered
          : t.registerFailed + ': ' + authError.message
        );
        return;
      }

      if (!authData.user) {
        setError(t.registerFailed);
        return;
      }

      // 2. 生成唯一 slug
      const baseSlug = toSlug(restaurantName) || 'restaurant';
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      if (authData.session) {
        // 有 session（无需邮件验证）→ 直接创建餐厅并进后台
        const { error: restaurantError } = await supabase
          .from('restaurants')
          .insert({
            name: restaurantName.trim(),
            slug,
            owner_id: authData.user.id,
          });

        if (restaurantError) {
          setError(t.createFailed + restaurantError.message);
          return;
        }

        router.push('/dashboard');
        router.refresh();
      } else {
        // 无 session（需要邮件验证）→ 先保存餐厅信息，验证后在 dashboard 补建
        localStorage.setItem('mesa-pending-restaurant', JSON.stringify({
          name: restaurantName.trim(),
          slug,
        }));
        setPendingVerification(true);
      }
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  };

  const slug = toSlug(restaurantName);

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-between">
            <Link href="/">
              <span className="font-heading text-4xl text-brand-gold tracking-wider">Mesa</span>
            </Link>
            <LanguageSwitcher compact />
          </div>
          <div className="bg-brand-card border border-brand-border rounded-2xl p-8 mt-8">
            <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="font-heading text-2xl text-brand-text mb-2">{t.verifyTitle}</h2>
            <p className="text-brand-text-muted text-sm leading-relaxed mb-1">
              {t.verifySentTo}
            </p>
            <p className="text-brand-gold text-sm font-medium mb-4">{email}</p>
            <p className="text-brand-text-muted text-xs leading-relaxed">
              {t.verifyTip}
              <br />
              {t.verifySpam}
            </p>
          </div>
          <p className="text-brand-text-muted text-xs mt-6">
            {t.verified}{' '}
            <Link href="/auth/login" className="text-brand-gold hover:underline">
              {t.toLogin}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <span className="font-heading text-4xl text-brand-gold tracking-wider">Mesa</span>
            </Link>
            <LanguageSwitcher compact />
          </div>
          <p className="text-brand-text-muted text-sm mt-2">{t.subtitle}</p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <Input
                label={t.restaurantName}
                type="text"
                placeholder="Casa Portuguesa"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                required
              />
              {slug && (
                <p className="text-brand-text-muted text-xs mt-1 ml-1">
                  {t.menuLink}/{slug}-xxx/menu
                </p>
              )}
            </div>
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
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {t.submit}
            </Button>
          </form>

          <p className="text-center text-brand-text-muted text-sm mt-6">
            {t.hasAccount}{' '}
            <Link href="/auth/login" className="text-brand-gold hover:underline">
              {t.directLogin}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
