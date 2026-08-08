'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { usePwaInstall } from '@/lib/pwa/use-pwa-install';

type Props = {
  /** Login support-row cell — sole staff install CTA presentation. */
  presentation: 'supportLink';
  label: string;
};

/**
 * Sole staff-facing install CTA (login support row only).
 * Customer menu and dashboard shell must not mount this.
 * No Service Worker / offline.
 *
 * Surfaces: browser_prompt → native install; otherwise open steps Modal
 * (`staffPwaInstall.steps` is the only guide copy).
 */
export function StaffPwaInstallPrompt({ presentation, label }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffPwaInstall;
  const { surface, surfaceReady, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  if (presentation !== 'supportLink') return null;

  const onActivate = () => {
    if (surfaceReady && surface === 'browser_prompt') {
      setBusy(true);
      void promptInstall().finally(() => setBusy(false));
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onActivate}
        disabled={busy}
        className="flex flex-col items-center gap-1.5 text-center text-[12px] leading-snug text-brand-text sm:text-[13px] disabled:opacity-60"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-ink/15 text-[13px]"
          aria-hidden
        >
          ⇩
        </span>
        <span>{label}</span>
      </button>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title={t.guideTitle} size="md">
        <ol className="list-decimal space-y-3 pl-5 text-[13px] leading-relaxed text-brand-text-muted">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
