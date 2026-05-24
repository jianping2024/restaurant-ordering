'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export function DashboardSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;

  const isProfile =
    pathname === '/dashboard/settings' || pathname === '/dashboard/settings/';
  const isStaff = pathname.startsWith('/dashboard/settings/staff');
  const isTables = pathname.startsWith('/dashboard/settings/tables');
  const isMenu = pathname.startsWith('/dashboard/settings/menu');
  const isPrintStations = pathname.startsWith('/dashboard/settings/print-stations');
  const isPrintAssistant = pathname.startsWith('/dashboard/settings/print-assistant');
  const isBuffet = pathname.startsWith('/dashboard/settings/buffet');

  const tabClass = (active: boolean) =>
    `px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
      active
        ? 'bg-brand-gold text-brand-on-gold border-brand-gold'
        : 'bg-brand-card text-brand-text-muted border-brand-border hover:text-brand-text hover:border-brand-gold/35'
    }`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-gold">{hub.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{hub.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 pb-1 border-b border-brand-border">
        <Link href="/dashboard/settings" className={tabClass(isProfile)}>
          {hub.tabProfile}
        </Link>
        <Link href="/dashboard/settings/staff" className={tabClass(isStaff)}>
          {hub.tabStaff}
        </Link>
        <Link href="/dashboard/settings/tables" className={tabClass(isTables)}>
          {hub.tabTables}
        </Link>
        <Link href="/dashboard/settings/menu" className={tabClass(isMenu)}>
          {hub.tabMenu}
        </Link>
        <Link href="/dashboard/settings/print-stations" className={tabClass(isPrintStations)}>
          {hub.tabPrintStations}
        </Link>
        <Link href="/dashboard/settings/buffet" className={tabClass(isBuffet)}>
          {hub.tabBuffet}
        </Link>
        <Link href="/dashboard/settings/print-assistant" className={tabClass(isPrintAssistant)}>
          {hub.tabPrintAssistant}
        </Link>
      </div>

      {children}
    </div>
  );
}
