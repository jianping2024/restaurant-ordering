'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function AdminRegisterPage() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authAdminRegister;
  const [adminSecret, setAdminSecret] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');
    setSuccess(false);

    if (password.length < 6) {
      setError(t.passwordLength);
      return;
    }
    if (!restaurantName.trim()) {
      setError(t.restaurantRequired);
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/admin/create-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret,
          restaurantName: restaurantName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setError(t.misconfigured);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (res.status === 403 || data.error === 'invalid_secret') {
        setError(t.invalidSecret);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (res.status === 409 || data.error === 'email_exists') {
        setError(t.duplicateEmail);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (!res.ok) {
        setError(t.fail);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      setSuccess(true);
      setRestaurantName('');
      setEmail('');
      setPassword('');
      setAdminSecret('');
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const slug = toSlug(restaurantName);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <span className="font-heading text-4xl text-brand-gold tracking-wider">Mesa</span>
          </Link>
          <LanguageSwitcher compact />
        </div>
        <p className="text-brand-text-muted text-sm mb-4">{t.subtitle}</p>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          {success ? (
            <div className="text-center space-y-4">
              <p className="text-emerald-400 text-sm">{t.success}</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => setSuccess(false)}>
                {lang === 'zh' ? '继续创建' : lang === 'pt' ? 'Criar outro' : 'Create another'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <Input
                label={t.adminSecret}
                type="password"
                autoComplete="off"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-brand-text-muted text-xs -mt-2">{t.adminSecretHint}</p>

              <Input
                label={t.restaurantName}
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                disabled={loading}
              />
              {slug ? (
                <p className="text-brand-text-muted text-xs -mt-2 ml-1">
                  {t.menuLink}/{slug}-xxx/menu
                </p>
              ) : null}

              <Input
                label={t.email}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
              />
              <Input
                label={t.password}
                type="password"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />

              {error ? (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {t.submit}
              </Button>
            </form>
          )}

          <p className="text-center text-brand-text-muted text-sm mt-6">
            <Link href="/auth/login" className="text-brand-gold hover:underline">
              {lang === 'zh' ? '店主登录' : lang === 'pt' ? 'Login do dono' : 'Owner sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
