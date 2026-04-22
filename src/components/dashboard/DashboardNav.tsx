'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Restaurant } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

const navItems = [
  { href: '/dashboard', key: 'overview', icon: '📊', exact: true },
  { href: '/dashboard/menu', key: 'menu', icon: '🍽️', exact: false },
  { href: '/dashboard/tables', key: 'tables', icon: '🪑', exact: false },
  { href: '/dashboard/orders', key: 'orders', icon: '📋', exact: false },
  { href: '/dashboard/settings', key: 'settings', icon: '⚙️', exact: false },
] as const;

export function DashboardNav({ restaurant }: { restaurant: Restaurant }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-brand-card border-r border-brand-border flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-brand-border">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-2xl text-brand-gold">Mesa</span>
          <LanguageSwitcher compact />
        </div>
        <p className="text-brand-text-muted text-xs mt-1 truncate">{restaurant.name}</p>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map(item => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all
                ${active
                  ? 'bg-brand-gold/15 text-brand-gold font-medium'
                  : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-border/50'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              {t[item.key]}
            </Link>
          );
        })}
      </nav>

      {/* 快捷链接 */}
      <div className="px-4 py-3 border-t border-brand-border">
        <a
          href={`/${restaurant.slug}/menu?table=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-xs text-brand-text-muted hover:text-brand-gold transition-colors"
        >
          <span>🔗</span>
          {t.viewMenu}
        </a>
        <a
          href={`/${restaurant.slug}/kitchen`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-xs text-brand-text-muted hover:text-brand-gold transition-colors"
        >
          <span>🍳</span>
          {t.viewKitchen}
        </a>
      </div>

      {/* 退出 */}
      <div className="px-4 py-4 border-t border-brand-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-brand-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <span>🚪</span>
          {t.logout}
        </button>
      </div>
    </aside>
  );
}
