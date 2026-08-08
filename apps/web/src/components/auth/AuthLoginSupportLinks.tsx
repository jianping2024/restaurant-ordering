'use client';

import { useState } from 'react';
import { StaffPwaInstallPrompt } from '@/components/pwa/StaffPwaInstallPrompt';
import type { AuthShellSupportCopy } from '@/components/auth/auth-shell-variants';

type Props = {
  copy: AuthShellSupportCopy;
};

function SupportGlyph({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-ink/15 text-[13px] text-brand-text"
      aria-hidden
    >
      {children}
    </span>
  );
}

function SupportCellButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-center text-[12px] leading-snug text-brand-text sm:text-[13px]"
    >
      <SupportGlyph>{glyph}</SupportGlyph>
      <span>{label}</span>
    </button>
  );
}

/**
 * Sole login help row: PWA install + forgot/contact (one shared admin tip).
 * Replaces forgotHint paragraph and AuthTrustBadges.
 */
export function AuthLoginSupportLinks({ copy }: Props) {
  const [showAdminHelp, setShowAdminHelp] = useState(false);

  return (
    <div className="mt-4 border-t border-brand-border/80 pt-4 md:mt-5 md:pt-4">
      <nav className="grid grid-cols-3 gap-1 sm:gap-2.5" aria-label={copy.contactAdmin}>
        <StaffPwaInstallPrompt presentation="supportLink" label={copy.install} />
        <SupportCellButton
          label={copy.forgotPassword}
          glyph="?"
          onClick={() => setShowAdminHelp(true)}
        />
        <SupportCellButton
          label={copy.contactAdmin}
          glyph="⌾"
          onClick={() => setShowAdminHelp(true)}
        />
      </nav>
      {showAdminHelp ? (
        <p className="mt-3 text-center text-[12px] leading-relaxed text-brand-text-muted" role="status">
          {copy.adminHelpDetail}
        </p>
      ) : null}
    </div>
  );
}
