'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/ops', label: '概览' },
  { href: '/ops/restaurants', label: '餐厅' },
  { href: '/ops/print/devices', label: '打印' },
  { href: '/ops/audit', label: '审计' },
];

const ADMIN_NAV = { href: '/ops/settings/admins', label: '账号' };

export function OpsShell({
  children,
  displayName,
  role,
}: {
  children: React.ReactNode;
  displayName: string;
  role: 'support' | 'admin';
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/ops/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/ops/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-wide text-amber-400">Mesa Ops</span>
            <nav className="flex gap-3 text-sm">
              {NAV.map((item) => {
                const active =
                  item.href === '/ops'
                    ? pathname === '/ops'
                    : item.href.startsWith('/ops/print')
                      ? pathname.startsWith('/ops/print')
                      : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {role === 'admin' ? (
                <Link
                  href={ADMIN_NAV.href}
                  className={
                    pathname.startsWith(ADMIN_NAV.href)
                      ? 'text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }
                >
                  {ADMIN_NAV.label}
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span>{displayName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
            >
              登出
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
