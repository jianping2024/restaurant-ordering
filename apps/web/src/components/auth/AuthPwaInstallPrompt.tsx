'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { usePwaInstall } from '@/lib/pwa/use-pwa-install';

/**
 * Sole staff-facing install CTA (login forms only).
 * Customer menu must not mount this. No Service Worker / offline.
 */
export function AuthPwaInstallPrompt() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin.pwaInstall;
  const { surface, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (surface === 'hidden') return null;

  if (surface === 'browser_prompt') {
    return (
      <div className="mt-5 pt-5 border-t border-brand-border/60 text-center space-y-2">
        <p className="text-brand-text-muted text-xs leading-relaxed">{t.hint}</p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          loading={busy}
          onClick={() => {
            setBusy(true);
            void promptInstall().finally(() => setBusy(false));
          }}
        >
          {t.installButton}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-brand-border/60 text-center">
      <p className="text-brand-text-muted text-xs leading-relaxed">{t.manualHint}</p>
    </div>
  );
}
