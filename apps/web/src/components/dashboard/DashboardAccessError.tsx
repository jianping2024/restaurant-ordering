'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  message: string;
};

export function DashboardAccessError({ message }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).dashboardAccessError;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl mb-4" aria-hidden>
          ⚠️
        </p>
        <h2 className="font-heading text-2xl text-brand-text mb-2">{t.title}</h2>
        <p className="text-brand-text-muted text-sm mb-4">{t.desc}</p>
        {message ? (
          <p className="text-[13px] text-brand-text-muted/80 font-mono bg-brand-card border border-brand-border rounded-lg px-3 py-2 mb-6 break-all">
            {message}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button type="button" onClick={() => window.location.reload()}>
            {t.retry}
          </Button>
          <Button type="button" variant="outline" onClick={handleSignOut}>
            {t.signOut}
          </Button>
        </div>
        <p className="text-brand-text-muted text-xs mt-6">
          <Link href="/auth/login" className="text-brand-gold hover:underline">
            {t.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
