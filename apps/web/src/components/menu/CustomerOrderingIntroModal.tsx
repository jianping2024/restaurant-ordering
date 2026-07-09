'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { CustomerOrderingIntroSplitPreview } from '@/components/menu/CustomerOrderingIntroSplitPreview';
import type { UILanguage } from '@/lib/i18n';
import type { CustomerOrderingIntroCopy } from '@/lib/i18n/customer-ordering-intro-messages';

type Step = {
  title: string;
  body: string;
  icon: string;
  highlight?: boolean;
};

type Props = {
  open: boolean;
  lang: UILanguage;
  copy: CustomerOrderingIntroCopy;
  onDismiss: () => void;
};

const overlayClassName =
  'fixed inset-0 z-[60] flex min-h-0 items-center justify-center overflow-y-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]';

export function CustomerOrderingIntroModal({ open, lang, copy, onDismiss }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) return null;

  const steps: Step[] = [
    { title: copy.stepOrderTitle, body: copy.stepOrderBody, icon: '🛒' },
    { title: copy.stepSplitTitle, body: copy.stepSplitBody, icon: '🧾', highlight: true },
    { title: copy.stepCheckoutTitle, body: copy.stepCheckoutBody, icon: '🔔' },
  ];

  return createPortal(
    <div className={overlayClassName} role="dialog" aria-modal="true" aria-labelledby="customer-ordering-intro-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 mx-auto flex w-full max-w-sm max-h-full flex-col rounded-2xl border border-brand-border bg-brand-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <h2
            id="customer-ordering-intro-title"
            className="font-heading text-center text-xl text-brand-gold sm:text-2xl"
          >
            {copy.title}
          </h2>
          <p className="mt-1 text-center text-sm text-brand-text-muted">{copy.subtitle}</p>

          <ol className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-base"
                  aria-hidden
                >
                  {step.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-text">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-brand-text-muted">{step.body}</p>
                  {step.highlight ? (
                    <div className="mt-2">
                      <CustomerOrderingIntroSplitPreview lang={lang} intro={copy} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          <Button type="button" variant="gold" size="lg" className="mt-6 w-full" onClick={onDismiss}>
            {copy.cta}
          </Button>
          <p className="mt-3 text-center text-[11px] text-brand-text-muted">{copy.footnote}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
