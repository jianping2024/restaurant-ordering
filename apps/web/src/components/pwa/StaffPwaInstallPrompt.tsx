'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { usePwaInstall } from '@/lib/pwa/use-pwa-install';

export type StaffPwaInstallVariant = 'login' | 'shell';

/** Login form footer — one slot height for browser_prompt and manual_entry. */
const LOGIN_INSTALL_SLOT_CLASS =
  'mt-5 border-t border-brand-border/60 pt-5 text-center space-y-2 min-h-[5.75rem] flex flex-col justify-center';

/** Dashboard shell bar — stable min height across surfaces. */
const SHELL_INSTALL_SLOT_CLASS =
  'mb-4 flex min-h-[4.5rem] flex-col gap-2 rounded-lg border border-brand-border/60 bg-brand-card/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between';

/**
 * Sole staff-facing install CTA (login + dashboard shell). Customer menu must not mount this.
 * No Service Worker / offline.
 *
 * Surfaces: hidden | browser_prompt (short hint + button) |
 * manual_entry (short lead + how-to → one steps[] guide in Modal).
 */
export function StaffPwaInstallPrompt({ variant = 'login' }: { variant?: StaffPwaInstallVariant }) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffPwaInstall;
  const { surface, surfaceReady, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  if (!surfaceReady || surface === 'hidden') return null;

  const guideModal = (
    <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title={t.guideTitle} size="md">
      <ol className="list-decimal space-y-3 pl-5 text-[13px] leading-relaxed text-brand-text-muted">
        {t.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Modal>
  );

  if (variant === 'shell') {
    if (surface === 'browser_prompt') {
      return (
        <div className={`${SHELL_INSTALL_SLOT_CLASS} gap-3`} role="status">
          <p className="text-brand-text-muted leading-relaxed">{t.hint}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
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
      <div className={SHELL_INSTALL_SLOT_CLASS} role="status">
        <p className="text-brand-text-muted leading-relaxed">{t.manualLead}</p>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="shrink-0 text-sm text-brand-gold underline-offset-2 hover:underline sm:text-right"
          aria-haspopup="dialog"
        >
          {t.howToInstall}
        </button>
        {guideModal}
      </div>
    );
  }

  if (surface === 'browser_prompt') {
    return (
      <div className={LOGIN_INSTALL_SLOT_CLASS}>
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
    <div className={LOGIN_INSTALL_SLOT_CLASS}>
      <p className="text-brand-text-muted text-xs leading-relaxed">{t.manualLead}</p>
      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="text-xs text-brand-gold underline-offset-2 hover:underline"
        aria-haspopup="dialog"
      >
        {t.howToInstall}
      </button>
      {guideModal}
    </div>
  );
}
