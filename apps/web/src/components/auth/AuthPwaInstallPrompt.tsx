'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { usePwaInstall } from '@/lib/pwa/use-pwa-install';

/**
 * Sole staff-facing install CTA (login forms only).
 * Customer menu must not mount this. No Service Worker / offline.
 *
 * Surfaces: hidden | browser_prompt (short hint + button) |
 * manual_entry (short lead + how-to → one steps[] guide in Modal).
 */
export function AuthPwaInstallPrompt() {
  const { lang } = useLanguage();
  const t = getMessages(lang).authLogin.pwaInstall;
  const { surface, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
    <div className="mt-5 pt-5 border-t border-brand-border/60 text-center space-y-2">
      <p className="text-brand-text-muted text-xs leading-relaxed">{t.manualLead}</p>
      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="text-xs text-brand-gold underline-offset-2 hover:underline"
        aria-haspopup="dialog"
      >
        {t.howToInstall}
      </button>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title={t.guideTitle} size="md">
        <ol className="list-decimal space-y-3 pl-5 text-[13px] leading-relaxed text-brand-text-muted">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Modal>
    </div>
  );
}
