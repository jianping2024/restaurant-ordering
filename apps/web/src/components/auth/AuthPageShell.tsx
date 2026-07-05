'use client';

import { ProductLogo } from '@/components/ui/ProductLogo';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AuthTrustBadges } from '@/components/auth/AuthTrustBadges';
import { AUTH_SHELL_VARIANTS, type AuthShellCopy, type AuthShellVariant } from '@/components/auth/auth-shell-variants';

type Props = {
  variant: AuthShellVariant;
  copy: AuthShellCopy;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function ShellSecurityNote({ text }: { text: string }) {
  return (
    <p className="flex items-start justify-center gap-2 text-center text-brand-text-muted text-xs mt-5 leading-relaxed">
      <svg
        className="w-4 h-4 shrink-0 text-brand-gold mt-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="M12 3 4 6v6c0 5 3.5 9 8 9s8-4 8-9V6l-8-3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{text}</span>
    </p>
  );
}

export function AuthPageShell({ variant, copy, toolbar, footer, children }: Props) {
  const { showTrustBadges } = AUTH_SHELL_VARIANTS[variant];

  return (
    <div className="min-h-screen mesa-auth-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher compact />
        </div>

        <div className="rounded-2xl border border-brand-gold/25 bg-brand-card shadow-lg shadow-black/5 p-8">
          {toolbar ? <div className="mb-4">{toolbar}</div> : null}

          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <ProductLogo size="md" />
            </div>
            <h1 className="font-heading text-3xl text-brand-gold mb-2">{copy.title}</h1>
            {copy.subtitle ? (
              <p className="text-brand-text-muted text-sm">{copy.subtitle}</p>
            ) : null}
            {copy.contextLine ? (
              <p className="text-brand-text text-sm font-medium mt-2">{copy.contextLine}</p>
            ) : null}
          </div>

          {children}

          {copy.forgotHint ? (
            <p className="text-center text-brand-text-muted text-xs mt-4">{copy.forgotHint}</p>
          ) : null}

          {copy.securityNote ? <ShellSecurityNote text={copy.securityNote} /> : null}

          {copy.complianceNote ? (
            <p className="text-center text-brand-text-muted text-xs mt-4 leading-relaxed">{copy.complianceNote}</p>
          ) : null}

          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>

        {showTrustBadges ? (
          <div className="flex justify-center">
            <AuthTrustBadges />
          </div>
        ) : null}
      </div>
    </div>
  );
}
