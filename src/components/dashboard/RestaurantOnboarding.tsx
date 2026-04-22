'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// 渲染在 dashboard layout 中：处理"注册时无 session，验邮后补建餐厅"的情况
export function RestaurantOnboarding() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).onboarding;
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  // 挂载时检查 localStorage 是否有待建餐厅信息，有则自动创建
  useEffect(() => {
    const pending = localStorage.getItem('mesa-pending-restaurant');
    if (!pending) {
      setInitializing(false);
      return;
    }

    let cancelled = false;
    const { name, slug } = JSON.parse(pending) as { name: string; slug: string };
    setRestaurantName(name);

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        if (!cancelled) setInitializing(false);
        return;
      }

      const { error } = await supabase.from('restaurants').insert({
        name,
        slug,
        owner_id: user.id,
      });

      if (!error) {
        localStorage.removeItem('mesa-pending-restaurant');
        router.refresh();
        return;
      }
      // 如果报错（如 slug 冲突），静默忽略，让用户手动填写
      if (!cancelled) setInitializing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim()) return;
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const baseSlug = toSlug(restaurantName) || 'restaurant';
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const { error } = await supabase.from('restaurants').insert({
        name: restaurantName.trim(),
        slug,
        owner_id: user.id,
      });

      if (error) {
        setError(t.fail + error.message);
        return;
      }

      router.refresh();
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">⏳</p>
          <h2 className="font-heading text-2xl text-brand-text mb-2">{t.initTitle}</h2>
          <p className="text-brand-text-muted text-sm">
            {t.initDesc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <p className="text-5xl mb-4">🏪</p>
        <h2 className="font-heading text-2xl text-brand-text mb-2">{t.title}</h2>
        <p className="text-brand-text-muted text-sm mb-8">
          {t.desc}
        </p>
        <form onSubmit={handleCreate} className="space-y-4 text-left">
          <Input
            label={t.label}
            type="text"
            placeholder="Casa Portuguesa"
            value={restaurantName}
            onChange={e => setRestaurantName(e.target.value)}
            required
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
      </div>
    </div>
  );
}
