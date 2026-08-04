'use client';

import type { ReactNode, MouseEvent } from 'react';
import { showToast } from '@/components/ui/Toast';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { openHttpUrlPreferBrowser } from '@/lib/pwa/open-prefer-browser';

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Sole staff UI control for opening customer-facing / scan URLs.
 * Browser tab → new tab; installed app shell → clipboard + toast (no second PWA window).
 */
export function PreferBrowserHttpLink({ href, className, children }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;

  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const result = await openHttpUrlPreferBrowser(href);
    if (result.mode === 'clipboard') {
      showToast(
        result.ok ? t.openInBrowserCopied : t.openInBrowserCopyFail,
        result.ok ? 'success' : 'error',
      );
    }
  };

  return (
    <a href={href} className={className} onClick={onClick} rel="noreferrer">
      {children}
    </a>
  );
}
